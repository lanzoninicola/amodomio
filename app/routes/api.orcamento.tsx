import { MenuItemSize } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { redisDel, redisGetJson, redisSetJson } from "~/lib/cache/redis.server";

import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { bairroEntity, BairroWithFeeAndDistance } from "~/domain/delivery/bairro.entity.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import getSearchParam from "~/utils/get-search-param";
import { badRequest, noContent, ok } from "~/utils/http-response.server";

type MenuItemPriceSummary = {
  menuItemId: string;
  name: string;
  ingredients: string;
  groupName?: string;
  priceAmount: number;
  previousPriceAmount: number;
  discountPercentage: number;
  profitActualPerc: number;
  profitExpectedPerc: number;
  priceExpectedAmount: number;
};

const ORCAMENTO_CACHE_KEY = "api:orcamento:v1";
const ORCAMENTO_CACHE_TTL_SECONDS = Number(process.env.ORCAMENTO_CACHE_TTL_SECONDS ?? 120);


export async function loader({ request, params }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return noContent(undefined, {
      cors: true,
      corsOrigin: "*"
    });
  }

  const { success, retryIn } = await restApi.rateLimitCheck(request);

  if (!success) {
    const seconds = retryIn ? Math.ceil(retryIn / 1000) : 60;
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(seconds) },
    });
  }

  const invalidateCacheSearchParam = getSearchParam({ request, paramName: "invalidate-cache" })

  if (invalidateCacheSearchParam === "true") {
    await redisDel(ORCAMENTO_CACHE_KEY);
  }

  const apiKey = request.headers.get("x-api-key");
  const authResp = restApi.authorize(apiKey);
  if (authResp.status >= 399) {
    return badRequest(authResp.message);
  }

  const cached = await redisGetJson<{
    options: Record<string, MenuItemPriceSummary[]>;
    sizes: MenuItemSize[];
    bairros: BairroWithFeeAndDistance[];
  }>(ORCAMENTO_CACHE_KEY);

  // Se tudo estiver em cache, retorna direto
  if (cached) {
    return ok({
      options: cached.options,
      sizes: cached.sizes.filter(size => size.key !== "pizza-slice"),
      bairros: cached.bairros,
    }, {
      cors: true,
      corsOrigin: "*",
    });
  }

  // Processa apenas o que não está em cache
  const items = await menuItemPrismaEntity.findManyWithSellPriceVariations(
    { where: { active: true } },
    "cardapio",
    { includeAuditRecords: false }
  );

  const map: Record<string, MenuItemPriceSummary[]> = {};

  for (const item of items) {
    for (const variation of item.sellPriceVariations) {
      const sizeKey = variation.sizeKey;
      if (!sizeKey) continue;

      const entry: MenuItemPriceSummary = {
        menuItemId: item.menuItemId,
        name: item.name,
        ingredients: item.ingredients || "",
        groupName: item.group?.name ?? undefined,
        priceAmount: variation.priceAmount,
        previousPriceAmount: variation.previousPriceAmount,
        discountPercentage: variation.discountPercentage,
        profitActualPerc: variation.profitActualPerc,
        profitExpectedPerc: variation.profitExpectedPerc,
        priceExpectedAmount: variation.priceExpectedAmount,
      };

      if (!map[sizeKey]) map[sizeKey] = [];
      map[sizeKey].push(entry);
    }
  }

  delete map["pizza-slice"];

  const [sizesRaw, bairros] = await Promise.all([
    menuItemSizePrismaEntity.findAll(),
    bairroEntity.findManyWithFees()
  ]);

  // Armazena em cache
  await redisSetJson(ORCAMENTO_CACHE_KEY, {
    options: map,
    sizes: sizesRaw,
    bairros
  }, Number.isFinite(ORCAMENTO_CACHE_TTL_SECONDS) ? ORCAMENTO_CACHE_TTL_SECONDS : 120);

  return ok({
    options: map,
    sizes: sizesRaw.filter(size => size.key !== "pizza-slice"),
    bairros,
  }, {
    cors: true,
    corsOrigin: "*",
  });
}
