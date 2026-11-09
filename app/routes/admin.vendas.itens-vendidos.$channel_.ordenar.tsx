import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  GripVertical,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import {
  MENU_ENGINEERING_QUADRANT_TAGS,
  MENU_ENGINEERING_TAG_NAMES,
  resolveMenuEngineeringTag,
  type MenuEngineeringTagDisplay,
} from "~/domain/menu-engineering/menu-engineering-tags";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [
  { title: "Vendas | Ordenar itens por canal" },
];

type ChannelOption = {
  id: string;
  key: string;
  name: string;
};

type SortableSellingItem = {
  id: string;
  linkId: string;
  name: string;
  active: boolean;
  canSell: boolean;
  visible: boolean;
  upcoming: boolean;
  groupId: string;
  groupName: string | null;
  groupDescription: string | null;
  groupSortOrderIndex: number;
  categoryName: string | null;
  sortOrderIndex: number;
  menuEngineeringTag: MenuEngineeringTagDisplay | null;
  revenueAmount: number;
  revenueQuantity: number;
  revenueScore: number;
  marginAmount: number | null;
  marginPerc: number | null;
  marginScore: number;
  interestCounts: InterestCounts;
  interestRawScore: number;
  interestScore: number;
};

type SortableSellingGroup = {
  id: string;
  name: string;
  description: string | null;
  sortOrderIndex: number;
  items: SortableSellingItem[];
};

type InterestCounts = {
  view_list: number;
  open_detail: number;
  like: number;
  share: number;
};

const UNGROUPED_GROUP_ID = "__sem_grupo__";
const EMPTY_INTEREST_COUNTS: InterestCounts = {
  view_list: 0,
  open_detail: 0,
  like: 0,
  share: 0,
};
const TACTICAL_SCORE_BY_MENU_ENGINEERING_TAG: Record<string, number> = {
  [MENU_ENGINEERING_QUADRANT_TAGS.potential.tagName]: 100,
  [MENU_ENGINEERING_QUADRANT_TAGS.champions.tagName]: 90,
  [MENU_ENGINEERING_QUADRANT_TAGS.volume.tagName]: 55,
  [MENU_ENGINEERING_QUADRANT_TAGS.lowPriority.tagName]: 10,
};

function getMenuEngineeringNote(tagName?: string | null) {
  if (!tagName) return "";
  const tag = Object.values(MENU_ENGINEERING_QUADRANT_TAGS).find(
    (candidate) => candidate.tagName === tagName
  );
  return tag?.note || "";
}

function getTacticalOrdering(item: SortableSellingItem) {
  const tagName = item.menuEngineeringTag?.tagName || "";
  const reasons: string[] = [];
  const menuEngineeringScore =
    TACTICAL_SCORE_BY_MENU_ENGINEERING_TAG[tagName] ?? 25;
  let score = Math.round(
    menuEngineeringScore * 0.3 +
      item.marginScore * 0.25 +
      item.interestScore * 0.2 +
      item.revenueScore * 0.15
  );

  if (item.menuEngineeringTag) {
    const note = getMenuEngineeringNote(tagName);
    reasons.push(
      note
        ? `${item.menuEngineeringTag.title}: ${note}`
        : item.menuEngineeringTag.title
    );
  } else {
    reasons.push("Sem tag de Menu Engineering");
  }

  if (item.revenueAmount > 0) {
    reasons.push(`faturamento ${formatCurrency(item.revenueAmount)}`);
  }

  if (item.marginAmount != null) {
    reasons.push(
      `margem ${formatCurrency(item.marginAmount)}${
        item.marginPerc != null ? ` (${formatPercent(item.marginPerc)})` : ""
      }`
    );
  }

  if (item.interestRawScore > 0) {
    reasons.push(`interesse ${item.interestRawScore} pts`);
  }

  if (item.visible) {
    score += 8;
    reasons.push("visível no canal");
  } else {
    score -= 80;
    reasons.push("oculto no canal");
  }

  if (!item.active) {
    score -= 80;
    reasons.push("item inativo");
  }

  if (!item.canSell) {
    score -= 80;
    reasons.push("sem venda ativa");
  }

  if (item.upcoming) {
    score -= 60;
    reasons.push("marcado como em breve");
  }

  return { score, reasons };
}

function normalizeChannelKey(value: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeMetricKey(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCompactMetricKey(value: string | null | undefined) {
  return normalizeMetricKey(value).replace(/\s+/g, "");
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreByMax(value: number, max: number) {
  if (!(max > 0) || !(value > 0)) return 0;
  return clampScore((value / max) * 100);
}

function calculateInterestScore(counts: InterestCounts) {
  return (
    Number(counts.view_list || 0) * 1 +
    Number(counts.open_detail || 0) * 4 +
    Number(counts.like || 0) * 6 +
    Number(counts.share || 0) * 9
  );
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toFixed(0)}%`;
}

function compareOrderRows(a: SortableSellingItem, b: SortableSellingItem) {
  return (
    Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
    a.name.localeCompare(b.name, "pt-BR") ||
    a.id.localeCompare(b.id)
  );
}

function compareGroupedOrderRows(
  a: SortableSellingItem,
  b: SortableSellingItem
) {
  return (
    Number(a.groupSortOrderIndex || 0) - Number(b.groupSortOrderIndex || 0) ||
    String(a.groupName || "Sem grupo").localeCompare(
      String(b.groupName || "Sem grupo"),
      "pt-BR"
    ) ||
    compareOrderRows(a, b)
  );
}

function compareTacticalOrderRows(
  a: SortableSellingItem,
  b: SortableSellingItem
) {
  return (
    getTacticalOrdering(b).score - getTacticalOrdering(a).score ||
    compareOrderRows(a, b)
  );
}

function buildItemNameLookup(rows: any[]) {
  const exact = new Map<string, string>();
  const compact = new Map<string, string>();

  rows.forEach((row: any) => {
    const itemId = String(row.itemId || "");
    const name = String(row.Item?.name || "");
    if (!itemId || !name) return;

    const exactKey = normalizeMetricKey(name);
    const compactKey = normalizeCompactMetricKey(name);
    if (exactKey && !exact.has(exactKey)) exact.set(exactKey, itemId);
    if (compactKey && !compact.has(compactKey)) compact.set(compactKey, itemId);
  });

  return { exact, compact };
}

function resolveRevenueMetricsByItemId(rows: any[], latestImport: any) {
  const revenueByItemId = new Map<
    string,
    { revenueAmount: number; revenueQuantity: number }
  >();
  const lookup = buildItemNameLookup(rows);

  (latestImport?.items || []).forEach((importItem: any) => {
    const exactKey = normalizeMetricKey(importItem?.topping);
    const compactKey = normalizeCompactMetricKey(importItem?.topping);
    const itemId =
      lookup.exact.get(exactKey) || lookup.compact.get(compactKey) || "";
    if (!itemId) return;

    const current = revenueByItemId.get(itemId) || {
      revenueAmount: 0,
      revenueQuantity: 0,
    };
    current.revenueAmount += Number(importItem?.value || 0);
    current.revenueQuantity += Number(importItem?.quantity || 0);
    revenueByItemId.set(itemId, current);
  });

  return revenueByItemId;
}

function getGroupCount(row: { _count?: { _all?: number } | number }) {
  if (typeof row._count === "number") return row._count;
  return row._count?._all ?? 0;
}

function buildInterestCountsByItemId(
  eventRows: any[],
  likeRows: any[],
  shareRows: any[]
) {
  const countsByItemId = new Map<string, InterestCounts>();

  eventRows.forEach((row: any) => {
    const itemId = String(row.itemId || "");
    if (!itemId) return;
    const current = countsByItemId.get(itemId) || { ...EMPTY_INTEREST_COUNTS };
    if (row.type in current) {
      current[row.type as keyof InterestCounts] = getGroupCount(row);
    }
    countsByItemId.set(itemId, current);
  });

  likeRows.forEach((row: any) => {
    const itemId = String(row.itemId || "");
    if (!itemId) return;
    const current = countsByItemId.get(itemId) || { ...EMPTY_INTEREST_COUNTS };
    current.like = Number(row._sum?.amount || 0);
    countsByItemId.set(itemId, current);
  });

  shareRows.forEach((row: any) => {
    const itemId = String(row.itemId || "");
    if (!itemId) return;
    const current = countsByItemId.get(itemId) || { ...EMPTY_INTEREST_COUNTS };
    current.share = getGroupCount(row);
    countsByItemId.set(itemId, current);
  });

  return countsByItemId;
}

function resolveMarginMetrics(row: any) {
  const prices = row.Item?.ItemSellingPriceVariation || [];
  const activeSheets = row.Item?.ItemCostSheet || [];
  const sheetByVariationId = new Map(
    activeSheets.map((sheet: any) => [String(sheet.itemVariationId), sheet])
  );

  const candidates = prices
    .map((price: any) => {
      const itemVariationId = String(price.itemVariationId || "");
      const sheet = sheetByVariationId.get(itemVariationId) || null;
      const priceAmount = Number(price.priceAmount || 0);
      const costAmount = sheet ? Number((sheet as any).costAmount || 0) : null;
      const marginAmount =
        costAmount == null || !(priceAmount > 0)
          ? null
          : priceAmount - costAmount;
      const marginPerc =
        marginAmount == null || !(priceAmount > 0)
          ? null
          : (marginAmount / priceAmount) * 100;

      return {
        isReference: Boolean(price.ItemVariation?.isReference),
        priceAmount,
        marginAmount,
        marginPerc,
      };
    })
    .filter((candidate: any) => candidate.priceAmount > 0);

  const selected =
    candidates.find((candidate: any) => candidate.isReference) ||
    [...candidates].sort(
      (a: any, b: any) => Number(b.marginAmount || 0) - Number(a.marginAmount || 0)
    )[0] ||
    null;

  return {
    marginAmount: selected?.marginAmount ?? null,
    marginPerc: selected?.marginPerc ?? null,
  };
}

async function invalidateIfCardapio(channelId: string) {
  const db = prismaClient as any;
  const channel = await db.itemSellingChannel.findUnique({
    where: { id: channelId },
    select: { key: true },
  });

  if (normalizeChannelKey(channel?.key) === "cardapio") {
    await invalidateCardapioIndexCache();
  }
}

async function saveChannelOrder(channelId: string, orderedItemIds: string[]) {
  const db = prismaClient as any;
  const currentRows = await db.itemSellingChannelItem.findMany({
    where: { itemSellingChannelId: channelId },
    select: {
      id: true,
      itemId: true,
      sortOrderIndex: true,
      Item: { select: { name: true } },
    },
  });

  const currentItemIds = new Set(
    currentRows.map((row: any) => String(row.itemId))
  );
  const requested = Array.from(new Set(orderedItemIds.map(String))).filter(
    (id) => currentItemIds.has(id)
  );
  const requestedSet = new Set(requested);
  const missing = currentRows
    .filter((row: any) => !requestedSet.has(String(row.itemId)))
    .sort((a: any, b: any) => {
      const aItem = {
        id: String(a.itemId),
        name: a.Item?.name || "",
        sortOrderIndex: Number(a.sortOrderIndex || 0),
      };
      const bItem = {
        id: String(b.itemId),
        name: b.Item?.name || "",
        sortOrderIndex: Number(b.sortOrderIndex || 0),
      };
      return compareOrderRows(
        aItem as SortableSellingItem,
        bItem as SortableSellingItem
      );
    })
    .map((row: any) => String(row.itemId));

  const nextOrder = [...requested, ...missing];
  const linkIdByItemId = new Map(
    currentRows.map((row: any) => [String(row.itemId), String(row.id)])
  );

  await db.$transaction(
    nextOrder.map((itemId, index) =>
      db.itemSellingChannelItem.update({
        where: { id: linkIdByItemId.get(itemId) },
        data: { sortOrderIndex: index + 1 },
      })
    )
  );

  await invalidateIfCardapio(channelId);
  return nextOrder.length;
}

async function replicateChannelOrder(
  targetChannelId: string,
  sourceChannelId: string
) {
  if (targetChannelId === sourceChannelId) return 0;
  const db = prismaClient as any;

  const [targetRows, sourceRows] = await Promise.all([
    db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: targetChannelId },
      select: {
        id: true,
        itemId: true,
        sortOrderIndex: true,
        Item: { select: { name: true } },
      },
    }),
    db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: sourceChannelId },
      select: {
        itemId: true,
        sortOrderIndex: true,
        Item: { select: { name: true } },
      },
    }),
  ]);

  const sourceIndexByItemId = new Map(
    sourceRows
      .sort(
        (a: any, b: any) =>
          Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
          String(a.Item?.name || "").localeCompare(
            String(b.Item?.name || ""),
            "pt-BR"
          )
      )
      .map((row: any, index: number) => [String(row.itemId), index + 1])
  );

  const nextRows = targetRows.sort((a: any, b: any) => {
    const aSourceIndex = sourceIndexByItemId.get(String(a.itemId));
    const bSourceIndex = sourceIndexByItemId.get(String(b.itemId));
    if (aSourceIndex && bSourceIndex) return aSourceIndex - bSourceIndex;
    if (aSourceIndex) return -1;
    if (bSourceIndex) return 1;
    return (
      Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
      String(a.Item?.name || "").localeCompare(
        String(b.Item?.name || ""),
        "pt-BR"
      )
    );
  });

  await db.$transaction(
    nextRows.map((row: any, index: number) =>
      db.itemSellingChannelItem.update({
        where: { id: row.id },
        data: { sortOrderIndex: index + 1 },
      })
    )
  );

  await invalidateIfCardapio(targetChannelId);
  return nextRows.length;
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const selectedChannelKey = normalizeChannelKey(params.channel || "");

    const channels = (await db.itemSellingChannel.findMany({
      select: { id: true, key: true, name: true },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    })) as ChannelOption[];

    const selectedChannel =
      channels.find(
        (channel) => normalizeChannelKey(channel.key) === selectedChannelKey
      ) || null;

    if (!selectedChannel) {
      if (channels[0]?.key) {
        return redirect(
          `/admin/vendas/itens-vendidos/${normalizeChannelKey(
            channels[0].key
          )}/ordenar`
        );
      }

      return ok({ channels: [], selectedChannel: null, items: [] });
    }

    const rows = await db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: selectedChannel.id },
      select: {
        id: true,
        itemId: true,
        visible: true,
        sortOrderIndex: true,
        Item: {
          select: {
            id: true,
            name: true,
            active: true,
            canSell: true,
            Category: { select: { name: true } },
            ItemSellingInfo: {
              select: {
                upcoming: true,
                Category: { select: { name: true } },
                ItemGroup: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    sortOrderIndex: true,
                  },
                },
              },
            },
            ItemSellingPriceVariation: {
              where: { itemSellingChannelId: selectedChannel.id },
              select: {
                itemVariationId: true,
                priceAmount: true,
                ItemVariation: {
                  select: {
                    isReference: true,
                  },
                },
              },
            },
            ItemCostSheet: {
              where: {
                isActive: true,
                status: "active",
              },
              select: {
                itemVariationId: true,
                costAmount: true,
                activatedAt: true,
                updatedAt: true,
              },
              orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }],
            },
            ItemTag: {
              where: {
                deletedAt: null,
                Tag: {
                  name: { in: MENU_ENGINEERING_TAG_NAMES },
                  deletedAt: null,
                },
              },
              select: {
                menuEngineeringLinkedAt: true,
                Tag: {
                  select: {
                    name: true,
                    colorHEX: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const itemIds = rows.map((row: any) => String(row.itemId)).filter(Boolean);
    const interestStart = new Date();
    interestStart.setDate(interestStart.getDate() - 30);

    const [latestMenuEngineeringImport, interestEvents, likes, shares] =
      await Promise.all([
        db.menuEngineeringImport.findFirst({
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            items: {
              select: {
                topping: true,
                quantity: true,
                value: true,
              },
            },
          },
          orderBy: [{ periodStart: "desc" }, { periodEnd: "desc" }],
        }),
        itemIds.length
          ? db.itemInterestEvent.groupBy({
              by: ["itemId", "type"],
              _count: { _all: true },
              where: {
                itemId: { in: itemIds },
                createdAt: { gte: interestStart },
              },
            })
          : [],
        itemIds.length
          ? db.itemLike.groupBy({
              by: ["itemId"],
              _sum: { amount: true },
              where: {
                itemId: { in: itemIds },
                createdAt: { gte: interestStart },
                deletedAt: null,
                amount: { gt: 0, lte: 1 },
              },
            })
          : [],
        itemIds.length
          ? db.itemShare.groupBy({
              by: ["itemId"],
              _count: { _all: true },
              where: {
                itemId: { in: itemIds },
                createdAt: { gte: interestStart },
              },
            })
          : [],
      ]);

    const revenueByItemId = resolveRevenueMetricsByItemId(
      rows,
      latestMenuEngineeringImport
    );
    const interestByItemId = buildInterestCountsByItemId(
      interestEvents,
      likes,
      shares
    );
    const rawItems = rows.map((row: any) => {
      const itemId = String(row.itemId);
      const revenueMetrics = revenueByItemId.get(itemId) || {
        revenueAmount: 0,
        revenueQuantity: 0,
      };
      const marginMetrics = resolveMarginMetrics(row);
      const interestCounts = interestByItemId.get(itemId) || {
        ...EMPTY_INTEREST_COUNTS,
      };
      return {
        row,
        itemId,
        revenueMetrics,
        marginMetrics,
        interestCounts,
        interestRawScore: calculateInterestScore(interestCounts),
      };
    });
    const maxRevenueAmount = Math.max(
      0,
      ...rawItems.map((item: any) => item.revenueMetrics.revenueAmount)
    );
    const maxMarginAmount = Math.max(
      0,
      ...rawItems.map((item: any) => Number(item.marginMetrics.marginAmount || 0))
    );
    const maxInterestScore = Math.max(
      0,
      ...rawItems.map((item: any) => item.interestRawScore)
    );

    const items: SortableSellingItem[] = rawItems
      .map((row: any) => {
        const sourceRow = row.row;
        const menuEngineeringTagRow = (sourceRow.Item?.ItemTag || [])
          .filter((itemTag: any) => Boolean(itemTag?.Tag?.name))
          .sort(
            (a: any, b: any) =>
              new Date(b.menuEngineeringLinkedAt || 0).getTime() -
              new Date(a.menuEngineeringLinkedAt || 0).getTime()
          )[0];
        const menuEngineeringTag = resolveMenuEngineeringTag(
          menuEngineeringTagRow?.Tag?.name,
          menuEngineeringTagRow?.Tag?.colorHEX
        );

        return {
          id: row.itemId,
          linkId: String(sourceRow.id),
          name: sourceRow.Item?.name || "Item sem nome",
          active: Boolean(sourceRow.Item?.active),
          canSell: Boolean(sourceRow.Item?.canSell),
          visible: sourceRow.visible === true,
          upcoming: sourceRow.Item?.ItemSellingInfo?.upcoming === true,
          groupId:
            sourceRow.Item?.ItemSellingInfo?.ItemGroup?.id ||
            UNGROUPED_GROUP_ID,
          groupName: sourceRow.Item?.ItemSellingInfo?.ItemGroup?.name || null,
          groupDescription:
            sourceRow.Item?.ItemSellingInfo?.ItemGroup?.description || null,
          groupSortOrderIndex:
            typeof sourceRow.Item?.ItemSellingInfo?.ItemGroup
              ?.sortOrderIndex === "number"
              ? sourceRow.Item.ItemSellingInfo.ItemGroup.sortOrderIndex
              : Number.MAX_SAFE_INTEGER,
          categoryName:
            sourceRow.Item?.ItemSellingInfo?.Category?.name ||
            sourceRow.Item?.Category?.name ||
            null,
          sortOrderIndex: Number(sourceRow.sortOrderIndex || 0),
          menuEngineeringTag,
          revenueAmount: row.revenueMetrics.revenueAmount,
          revenueQuantity: row.revenueMetrics.revenueQuantity,
          revenueScore: scoreByMax(
            row.revenueMetrics.revenueAmount,
            maxRevenueAmount
          ),
          marginAmount: row.marginMetrics.marginAmount,
          marginPerc: row.marginMetrics.marginPerc,
          marginScore: scoreByMax(
            Number(row.marginMetrics.marginAmount || 0),
            maxMarginAmount
          ),
          interestCounts: row.interestCounts,
          interestRawScore: row.interestRawScore,
          interestScore: scoreByMax(row.interestRawScore, maxInterestScore),
        };
      })
      .sort(compareGroupedOrderRows);

    return ok({ channels, selectedChannel, items });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "").trim();
    const channelId = String(formData.get("channelId") || "").trim();

    const selectedChannel = channelId
      ? await db.itemSellingChannel.findUnique({
        where: { id: channelId },
        select: { id: true, key: true },
      })
      : null;
    if (!selectedChannel) return badRequest("Canal de venda inválido.");

    if (actionName === "save-order") {
      const orderedItemIds = String(formData.get("orderedItemIds") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const total = await saveChannelOrder(channelId, orderedItemIds);
      return ok(`Ordem salva para ${total} item(ns).`);
    }

    if (actionName === "replicate-order") {
      const sourceChannelId = String(
        formData.get("sourceChannelId") || ""
      ).trim();
      const sourceChannel = sourceChannelId
        ? await db.itemSellingChannel.findUnique({
          where: { id: sourceChannelId },
          select: { id: true },
        })
        : null;
      if (!sourceChannel)
        return badRequest("Escolha um canal de origem válido.");
      if (sourceChannelId === channelId)
        return badRequest(
          "Escolha um canal de origem diferente do canal atual."
        );

      const total = await replicateChannelOrder(channelId, sourceChannelId);
      return ok(`Ordenamento replicado para ${total} item(ns).`);
    }

    return badRequest("Ação inválida.");
  } catch (error) {
    return serverError(error);
  }
}

function SortableItemRow({
  item,
  position,
  visiblePosition,
  scopeTotal,
  onMove,
}: {
  item: SortableSellingItem;
  position: number;
  visiblePosition: number;
  scopeTotal: number;
  onMove: (itemId: string, direction: "top" | "up" | "down" | "bottom") => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const tacticalOrdering = getTacticalOrdering(item);
  const tacticalReason = tacticalOrdering.reasons[0] || "Sem critério tático";
  const openDetailRate =
    item.interestCounts.view_list > 0
      ? item.interestCounts.open_detail / item.interestCounts.view_list
      : null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[2.75rem_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-100 bg-white px-4 py-3",
        isDragging && "relative z-10 shadow-lg"
      )}
    >
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        aria-label={`Arrastar ${item.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-950">
          {item.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {item.groupName ? <span>{item.groupName}</span> : null}
          {item.categoryName ? <span>{item.categoryName}</span> : null}
          {!item.active ? (
            <Badge
              variant="outline"
              className="border-slate-200 text-slate-500"
            >
              inativo
            </Badge>
          ) : null}
          {!item.canSell ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700"
            >
              sem venda
            </Badge>
          ) : null}
          {item.upcoming ? (
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700"
            >
              em breve
            </Badge>
          ) : null}
          {!item.visible ? (
            <Badge
              variant="outline"
              className="border-slate-200 text-slate-500"
            >
              oculto
            </Badge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {item.menuEngineeringTag ? (
            <Badge
              variant="outline"
              className="border-slate-200 bg-white"
              style={{
                borderColor: item.menuEngineeringTag.colorHEX,
                color: item.menuEngineeringTag.colorHEX,
              }}
            >
              {item.menuEngineeringTag.title}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-slate-200 text-slate-500"
            >
              sem análise
            </Badge>
          )}
          <span className="text-slate-400">
            score {tacticalOrdering.score} · {tacticalReason}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            fat. {formatCurrency(item.revenueAmount)}
          </Badge>
          <Badge
            variant="outline"
            className="border-sky-200 bg-sky-50 text-sky-700"
          >
            margem{" "}
            {item.marginAmount == null
              ? "-"
              : `${formatCurrency(item.marginAmount)} · ${formatPercent(
                  item.marginPerc
                )}`}
          </Badge>
          <Badge
            variant="outline"
            className="border-violet-200 bg-violet-50 text-violet-700"
          >
            interesse {item.interestRawScore}
            {openDetailRate != null
              ? ` · abre ${formatPercent(openDetailRate * 100)}`
              : ""}
          </Badge>
        </div>
      </div>

      <div className="font-mono text-xs text-slate-400">#{position}</div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Mover para o topo"
          disabled={visiblePosition <= 1}
          onClick={() => onMove(item.id, "top")}
        >
          <ChevronsUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Subir uma posição"
          disabled={visiblePosition <= 1}
          onClick={() => onMove(item.id, "up")}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Descer uma posição"
          disabled={visiblePosition >= scopeTotal}
          onClick={() => onMove(item.id, "down")}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Mover para o fim"
          disabled={visiblePosition >= scopeTotal}
          onClick={() => onMove(item.id, "bottom")}
        >
          <ChevronsDown className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

export default function AdminVendasItensVendidosOrdenarPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const payload = (loaderData?.payload || {}) as {
    channels: ChannelOption[];
    selectedChannel: ChannelOption | null;
    items: SortableSellingItem[];
  };
  const channels = payload.channels || [];
  const selectedChannel = payload.selectedChannel;
  const sourceChannels = channels.filter(
    (channel) => channel.id !== selectedChannel?.id
  );
  const [items, setItems] = useState(payload.items || []);
  const [viewMode, setViewMode] = useState<"visible" | "hidden" | "all">(
    "visible"
  );
  const [sourceChannelId, setSourceChannelId] = useState(
    sourceChannels[0]?.id || ""
  );
  const orderedIds = useMemo(
    () => items.map((item) => item.id).join(","),
    [items]
  );
  const visibleItems = useMemo(
    () => items.filter((item) => item.visible),
    [items]
  );
  const hiddenItems = useMemo(
    () => items.filter((item) => !item.visible),
    [items]
  );
  const scopedItems = useMemo(() => {
    if (viewMode === "hidden") return hiddenItems;
    if (viewMode === "all") return items;
    return visibleItems;
  }, [hiddenItems, items, viewMode, visibleItems]);
  const scopedGroups = useMemo(
    () => groupSellingItemsForDisplay(scopedItems),
    [scopedItems]
  );

  useEffect(() => {
    setItems(payload.items || []);
  }, [payload.selectedChannel?.id, payload.items]);

  useEffect(() => {
    setSourceChannelId(sourceChannels[0]?.id || "");
  }, [selectedChannel?.id]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((currentItems) => {
      return moveItemWithinGroup(
        currentItems,
        String(active.id),
        String(over.id)
      );
    });
  }

  function handleChannelChange(channelKey: string) {
    navigate(`/admin/vendas/itens-vendidos/${channelKey}/ordenar`);
  }

  function handleMoveItem(
    itemId: string,
    direction: "top" | "up" | "down" | "bottom"
  ) {
    setItems((currentItems) => {
      const scope = resolveScopeItems(currentItems, viewMode);
      const sourceItem = currentItems.find((item) => item.id === itemId);
      if (!sourceItem) return currentItems;
      const groupScope = scope.filter(
        (item) => item.groupId === sourceItem.groupId
      );
      const currentScopeIndex = groupScope.findIndex(
        (item) => item.id === itemId
      );
      if (currentScopeIndex < 0) return currentItems;

      const targetScopeIndex =
        direction === "top"
          ? 0
          : direction === "bottom"
            ? groupScope.length - 1
            : direction === "up"
              ? currentScopeIndex - 1
              : currentScopeIndex + 1;

      const targetItem = groupScope[targetScopeIndex];
      if (!targetItem || targetItem.id === itemId) return currentItems;
      return moveItemWithinGroup(currentItems, itemId, targetItem.id);
    });
  }

  function handleApplyTacticalOrder(groupId?: string) {
    setItems((currentItems) =>
      applyTacticalOrdering(currentItems, viewMode, groupId)
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-16">
      <section className="space-y-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/admin/vendas/itens-vendidos/${selectedChannel?.key || "cardapio"
              }`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            voltar para itens vendidos
          </Link>

          <Link
            to="/admin/gerenciamento/cardapio/dashboard/menu-engineering"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950"
          >
            <Sparkles className="h-4 w-4" />
            Menu Engineering
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">
            Ordenar itens no canal
          </h1>
          <p className="text-sm text-slate-500">
            {selectedChannel
              ? `${selectedChannel.name} · ${visibleItems.length} visível(is) · ${hiddenItems.length} oculto(s)`
              : "Nenhum canal cadastrado"}
          </p>
          <p className="max-w-3xl text-xs leading-relaxed text-slate-500">
            No cardápio público, os itens aparecem primeiro pela ordem do grupo
            e depois pela ordem do item dentro do canal. Esta tela separa as
            seções para evitar uma ordem global que não existe na visualização
            final. A ordem das seções é editada em{" "}
            <Link
              to="/admin/gerenciamento/cardapio/groups"
              className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-950"
            >
              grupos do cardápio
            </Link>
            .
          </p>
          <p className="max-w-3xl text-xs leading-relaxed text-slate-500">
            A sugestão tática combina Menu Engineering, faturamento do último
            import, margem estimada por preço/custo ativo e interesse dos
            últimos 30 dias no cardápio.
          </p>
        </div>
      </section>

      {actionData?.message ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            actionData.status >= 400
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {actionData.message}
        </div>
      ) : null}

      <section className="grid grid-cols-2">
        <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="selectedChannelId"
            >
              Selecionar o canal
            </label>
            <Select
              value={selectedChannel?.key || ""}
              onValueChange={handleChannelChange}
            >
              <SelectTrigger className="h-9  bg-white">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.key}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Form method="post">
            <input type="hidden" name="_action" value="save-order" />
            <input
              type="hidden"
              name="channelId"
              value={selectedChannel?.id || ""}
            />
            <input type="hidden" name="orderedItemIds" value={orderedIds} />
            <Button
              type="submit"
              className="h-9 gap-2 bg-slate-900 hover:bg-slate-700"
              disabled={!selectedChannel || items.length === 0}
            >
              <Save className="h-4 w-4" />
              Salvar ordem
            </Button>
          </Form>
        </div>

        <div className="grid gap-3  p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="sourceChannelId"
            >
              Replicar ordenamento de outro canal
            </label>
            <Select value={sourceChannelId} onValueChange={setSourceChannelId}>
              <SelectTrigger id="sourceChannelId" className="h-9 bg-white">
                <SelectValue placeholder="Escolha o canal de origem" />
              </SelectTrigger>
              <SelectContent>
                {sourceChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Form method="post">
            <input type="hidden" name="_action" value="replicate-order" />
            <input
              type="hidden"
              name="channelId"
              value={selectedChannel?.id || ""}
            />
            <input type="hidden" name="sourceChannelId" value={sourceChannelId} />
            <Button
              type="submit"
              variant="outline"
              className="h-9 gap-2 bg-white"
              disabled={!selectedChannel || !sourceChannelId}
            >
              <Copy className="h-4 w-4" />
              Replicar
            </Button>
          </Form>
        </div>
      </section>



      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
            <Button
              type="button"
              variant={viewMode === "visible" ? "secondary" : "ghost"}
              className="h-8 px-3 text-sm"
              onClick={() => setViewMode("visible")}
            >
              Visíveis ({visibleItems.length})
            </Button>
            <Button
              type="button"
              variant={viewMode === "hidden" ? "secondary" : "ghost"}
              className="h-8 px-3 text-sm"
              onClick={() => setViewMode("hidden")}
            >
              Ocultos ({hiddenItems.length})
            </Button>
            <Button
              type="button"
              variant={viewMode === "all" ? "secondary" : "ghost"}
              className="h-8 px-3 text-sm"
              onClick={() => setViewMode("all")}
            >
              Todos ({items.length})
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-2 bg-white text-sm"
              disabled={scopedItems.length === 0}
              onClick={() => handleApplyTacticalOrder()}
            >
              <Sparkles className="h-4 w-4" />
              Sugestão tática
            </Button>
            <div className="text-xs text-slate-500">
              Use o arraste para ajustes curtos ou os botões de seta para
              deslocamentos longos.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {scopedGroups.map((group) => (
            <section
              key={group.id}
              className="overflow-hidden rounded-md border border-slate-200 bg-white"
            >
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-950">
                      {group.name}
                    </h2>
                    {group.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs text-slate-500">
                    {group.items.length} item(ns)
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 gap-2 bg-white text-xs"
                    onClick={() => handleApplyTacticalOrder(group.id)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Sugerir grupo
                  </Button>
                </div>
              </div>

              <SortableContext
                items={group.items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol>
                  {group.items.map((item, index) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      position={index + 1}
                      visiblePosition={index + 1}
                      scopeTotal={group.items.length}
                      onMove={handleMoveItem}
                    />
                  ))}
                </ol>
              </SortableContext>
            </section>
          ))}

          {scopedItems.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
              {viewMode === "hidden"
                ? "Nenhum item oculto neste canal."
                : viewMode === "visible"
                  ? "Nenhum item visível neste canal."
                  : "Nenhum item vinculado a este canal."}
            </div>
          ) : null}
        </div>
      </DndContext>
    </div>
  );
}

function resolveScopeItems(
  items: SortableSellingItem[],
  viewMode: "visible" | "hidden" | "all"
) {
  if (viewMode === "hidden") return items.filter((item) => !item.visible);
  if (viewMode === "all") return items;
  return items.filter((item) => item.visible);
}

function groupSellingItemsForDisplay(items: SortableSellingItem[]) {
  const groups = items.reduce((acc, item) => {
    const groupId = item.groupId || UNGROUPED_GROUP_ID;
    if (!acc.has(groupId)) {
      acc.set(groupId, {
        id: groupId,
        name: item.groupName || "Sem grupo",
        description: item.groupDescription || null,
        sortOrderIndex: item.groupSortOrderIndex,
        items: [],
      });
    }

    acc.get(groupId)?.items.push(item);
    return acc;
  }, new Map<string, SortableSellingGroup>());

  return Array.from(groups.values())
    .sort(
      (a, b) =>
        Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
        a.name.localeCompare(b.name, "pt-BR")
    )
    .map((group) => ({
      ...group,
      items: [...group.items],
    }));
}

function applyTacticalOrdering(
  items: SortableSellingItem[],
  viewMode: "visible" | "hidden" | "all",
  targetGroupId?: string
) {
  const scopedItems = resolveScopeItems(items, viewMode);
  const groups = groupSellingItemsForDisplay(scopedItems).filter((group) =>
    targetGroupId ? group.id === targetGroupId : true
  );

  return groups.reduce((currentItems, group) => {
    const scopedIds = new Set(group.items.map((item) => item.id));
    const tacticalItems = [...group.items].sort(compareTacticalOrderRows);
    let tacticalIndex = 0;

    return currentItems.map((item) => {
      if (item.groupId !== group.id || !scopedIds.has(item.id)) return item;
      const nextItem = tacticalItems[tacticalIndex];
      tacticalIndex += 1;
      return nextItem || item;
    });
  }, items);
}

function moveItemWithinGroup(
  items: SortableSellingItem[],
  sourceItemId: string,
  targetItemId: string
) {
  const oldIndex = items.findIndex((item) => item.id === sourceItemId);
  const newIndex = items.findIndex((item) => item.id === targetItemId);
  if (oldIndex < 0 || newIndex < 0) return items;
  if (items[oldIndex].groupId !== items[newIndex].groupId) return items;
  return arrayMove(items, oldIndex, newIndex);
}
