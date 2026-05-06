import type { Tag } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { redisGetJson, redisSetJson } from "~/lib/cache/redis.server";
import { CARDAPIO_INDEX_CACHE_KEY } from "~/domain/cardapio/cardapio-cache.server";
import { notifyCardapioContingencyByWhatsapp } from "~/domain/cardapio/cardapio-contingency-alert.server";
import { findAllCardapioItemsGroupedByGroupLight } from "~/domain/cardapio/cardapio-items-source.server";
import { getEngagementSettings } from "~/domain/cardapio/engagement-settings.server";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import { parseBooleanSetting } from "~/utils/parse-boolean-setting";

const REELS_SETTING_KEY = "reel.urls";
const REELS_ENABLED_SETTING_NAME = "reels.enabled";
const REELS_SETTING_CONTEXT = "cardapio";
const MENU_ITEM_INTEREST_SETTING_CONTEXT = "cardapio";
const MENU_ITEM_INTEREST_SETTING_NAME = "menu-item-interest-enabled";
const SIMULATE_ERROR_SETTING_CONTEXT = "cardapio";
const SIMULATE_ERROR_SETTING_NAME = "contingencia.simula.erro";
const CARDAPIO_INDEX_CACHE_TTL_SECONDS = Number(process.env.CARDAPIO_INDEX_CACHE_TTL_SECONDS ?? 60);

export type CardapioIndexLoaderData = {
    items: Awaited<ReturnType<typeof findAllCardapioItemsGroupedByGroupLight>>;
    tags: Tag[];
    reelUrls: string[];
    reelsEnabled: boolean;
    menuItemInterestEnabled: boolean;
    likesEnabled: boolean;
    sharesEnabled: boolean;
};

export async function loadCardapioIndexData(request: Request): Promise<CardapioIndexLoaderData> {
    const url = new URL(request.url);
    const simulateError = url.searchParams.get("simularErro");
    const simulateErrorByQuery = simulateError === "cardapio-index" || simulateError === "cardapio";
    let simulateErrorBySetting = false;

    try {
        const simulateErrorSetting = await prismaClient.setting.findFirst({
            where: {
                context: SIMULATE_ERROR_SETTING_CONTEXT,
                name: SIMULATE_ERROR_SETTING_NAME,
            },
            orderBy: [{ createdAt: "desc" }],
        });

        simulateErrorBySetting = parseBooleanSetting(simulateErrorSetting?.value, false);
    } catch (error) {
        console.error("[cardapio._index] non-blocking contingencia.simula.erro load failed, using default", error);
    }

    if (simulateErrorByQuery || simulateErrorBySetting) {
        const simulationError = new Error("SIMULACAO_ERRO_CARDAPIO_INDEX");
        await notifyCardapioContingencyByWhatsapp({
            requestUrl: request.url,
            error: simulationError,
            ignoreCooldown: simulateErrorBySetting,
        });
        throw simulationError;
    }

    try {
        const cachedPayload = await redisGetJson<CardapioIndexLoaderData>(CARDAPIO_INDEX_CACHE_KEY);

        const reelsEnabledSetting = await prismaClient.setting.findFirst({
            where: {
                context: REELS_SETTING_CONTEXT,
                name: REELS_ENABLED_SETTING_NAME,
            },
            orderBy: [{ createdAt: "desc" }],
        });
        const reelsEnabled = parseBooleanSetting(reelsEnabledSetting?.value, true);

        if (cachedPayload) {
            return {
                ...cachedPayload,
                reelsEnabled,
                reelUrls: reelsEnabled ? cachedPayload.reelUrls : [],
            };
        }

        const itemsPromise = findAllCardapioItemsGroupedByGroupLight(
            {
                where: {
                    visible: true,
                    active: true,
                    upcoming: false,
                },
                option: {
                    sorted: true,
                    direction: "asc",
                },
            },
            {
                imageTransform: true,
                imageScaleWidth: 375,
            }
        );

        const tagsPromise = tagPrismaEntity.findAll({
            public: true,
        });

        let reelUrls: string[] = [];
        if (reelsEnabled) {
            reelUrls = await loadReelUrls(request);
        }

        const menuItemInterestSetting = await prismaClient.setting.findFirst({
            where: {
                context: MENU_ITEM_INTEREST_SETTING_CONTEXT,
                name: MENU_ITEM_INTEREST_SETTING_NAME,
            },
            orderBy: [{ createdAt: "desc" }],
        });
        const menuItemInterestEnabled = parseBooleanSetting(menuItemInterestSetting?.value, true);
        const { likesEnabled, sharesEnabled } = await getEngagementSettings();
        const [items, tags] = await Promise.all([itemsPromise, tagsPromise]);

        const payload: CardapioIndexLoaderData = {
            items,
            tags,
            reelUrls,
            reelsEnabled,
            menuItemInterestEnabled,
            likesEnabled,
            sharesEnabled,
        };

        await redisSetJson(
            CARDAPIO_INDEX_CACHE_KEY,
            payload,
            Number.isFinite(CARDAPIO_INDEX_CACHE_TTL_SECONDS) ? CARDAPIO_INDEX_CACHE_TTL_SECONDS : 60
        );

        return payload;
    } catch (error) {
        await notifyCardapioContingencyByWhatsapp({
            requestUrl: request.url,
            error,
        });
        throw error;
    }
}

function parseReelUrls(raw?: string | null) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.filter((url) => typeof url === "string" && url.trim().length > 0);
        }
        if (typeof parsed === "string" && parsed.trim().length > 0) return [parsed.trim()];
    } catch {
        return raw
            .split(/\r?\n|,/g)
            .map((url) => url.trim())
            .filter(Boolean);
    }
    return [];
}

async function loadReelUrls(request: Request) {
    const endpoint = new URL("/api/media/folder-assets?folder=reels&kind=video", request.url).toString();

    try {
        const response = await fetch(endpoint, { method: "GET" });
        if (response.ok) {
            const payload = await response.json().catch(() => null);
            const urls = parseReelUrlsFromMediaPayload(payload);
            if (urls.length > 0) return urls;
        }
    } catch (error) {
        console.warn("[cardapio._index] failed loading reels from media API, trying settings fallback", error);
    }

    const reelSetting = await prismaClient.setting.findFirst({
        where: {
            context: REELS_SETTING_CONTEXT,
            name: REELS_SETTING_KEY,
        },
        orderBy: [{ createdAt: "desc" }],
    });

    return parseReelUrls(reelSetting?.value);
}

function parseReelUrlsFromMediaPayload(payload: unknown) {
    if (!payload || typeof payload !== "object") return [];
    const items = (payload as { items?: unknown }).items;
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => {
            if (!item || typeof item !== "object") return "";
            const url = (item as { url?: unknown }).url;
            return typeof url === "string" ? url.trim() : "";
        })
        .filter(Boolean);
}
