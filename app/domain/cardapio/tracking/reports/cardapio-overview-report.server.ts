import { Prisma } from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { CARDAPIO_ORDER_INTENT_EVENT } from "../cardapio-tracking-events";

type Period = { start: Date; end: Date };

type FunnelRow = {
  itemViews: number | bigint;
  visitors: number | bigint;
  detailVisitors: number | bigint;
  engagedVisitors: number | bigint;
};

type FunnelSummary = {
  itemViews: number;
  visitors: number;
  detailVisitors: number;
  engagedVisitors: number;
  orderIntentVisitors: number;
};

const toNumber = (value: number | bigint | null | undefined) =>
  Number(value ?? 0);

async function readFunnelSummary(period: Period): Promise<FunnelSummary> {
  const [interestRows, orderIntentVisitors] = await Promise.all([
    prismaClient.$queryRaw<FunnelRow[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE type = 'view_list')::int AS "itemViews",
        COUNT(DISTINCT client_id) FILTER (
          WHERE type = 'view_list' AND client_id IS NOT NULL
        )::int AS visitors,
        COUNT(DISTINCT client_id) FILTER (
          WHERE type = 'open_detail' AND client_id IS NOT NULL
        )::int AS "detailVisitors",
        COUNT(DISTINCT client_id) FILTER (
          WHERE type IN ('like', 'share') AND client_id IS NOT NULL
        )::int AS "engagedVisitors"
      FROM (
        SELECT type, client_id
        FROM item_interest_events
        WHERE created_at >= ${period.start} AND created_at < ${period.end}

        UNION ALL

        SELECT type, client_id
        FROM menu_item_interest_events
        WHERE created_at >= ${period.start} AND created_at < ${period.end}
      ) interest_events
    `),
    prismaClient.cardapioInteractionEvent.findMany({
      where: {
        eventName: CARDAPIO_ORDER_INTENT_EVENT,
        clientId: { not: null },
        createdAt: { gte: period.start, lt: period.end },
      },
      distinct: ["clientId"],
      select: { clientId: true },
    }),
  ]);

  const row = interestRows[0];
  return {
    itemViews: toNumber(row?.itemViews),
    visitors: toNumber(row?.visitors),
    detailVisitors: toNumber(row?.detailVisitors),
    engagedVisitors: toNumber(row?.engagedVisitors),
    orderIntentVisitors: orderIntentVisitors.length,
  };
}

async function readTopItem(period: Period) {
  const rows = await prismaClient.itemInterestEvent.groupBy({
    by: ["itemId"],
    _count: { _all: true },
    where: {
      type: "open_detail",
      createdAt: { gte: period.start, lt: period.end },
    },
    orderBy: { _count: { itemId: "desc" } },
    take: 1,
  });
  const winner = rows[0];
  if (!winner) return null;

  const item = await prismaClient.item.findUnique({
    where: { id: winner.itemId },
    select: { name: true },
  });

  return item
    ? { name: item.name, openings: toNumber(winner._count._all) }
    : null;
}

async function readTopCategory(period: Period) {
  const rows = await prismaClient.cardapioInteractionEvent.groupBy({
    by: ["value"],
    _count: { _all: true },
    where: {
      eventName: "cardapio_navigation_click",
      control: "category",
      createdAt: { gte: period.start, lt: period.end },
    },
    orderBy: { _count: { value: "desc" } },
    take: 1,
  });
  const winner = rows[0];
  return winner
    ? { name: winner.value, clicks: toNumber(winner._count._all) }
    : null;
}

export async function readCardapioOverviewReport({
  currentPeriod,
  previousPeriod,
}: {
  currentPeriod: Period;
  previousPeriod: Period;
}) {
  const [current, previous, topItem, topCategory] = await Promise.all([
    readFunnelSummary(currentPeriod),
    readFunnelSummary(previousPeriod),
    readTopItem(currentPeriod),
    readTopCategory(currentPeriod),
  ]);

  return { current, previous, topItem, topCategory };
}
