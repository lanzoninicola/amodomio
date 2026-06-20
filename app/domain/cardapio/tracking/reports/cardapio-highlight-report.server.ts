import prismaClient from "~/lib/prisma/client.server";
import {
  CARDAPIO_HIGHLIGHT_CTA_EVENT,
  CARDAPIO_HIGHLIGHT_EVENTS,
  CARDAPIO_HIGHLIGHT_EXPAND_EVENT,
  CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT,
  CARDAPIO_HIGHLIGHT_SLIDE_EVENT,
  type CardapioHighlightEventName,
} from "../cardapio-tracking-events";
import {
  readCardapioTrackingCounts,
  readCardapioTrackingVisitors,
} from "../cardapio-tracking-records.server";

type Period = {
  start: Date;
  end: Date;
};

const percentage = (part: number, total: number) =>
  total > 0 ? (part / total) * 100 : 0;

export async function readCardapioHighlightReport({
  currentPeriod,
  previousPeriod,
  sectionKey,
}: {
  currentPeriod: Period;
  previousPeriod: Period;
  sectionKey: string | null;
}) {
  const [
    sections,
    currentRows,
    previousRows,
    currentVisitors,
    previousVisitors,
  ] = await Promise.all([
    prismaClient.cardapioHighlightSection.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, key: true, published: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    readCardapioTrackingCounts({
      eventNames: [...CARDAPIO_HIGHLIGHT_EVENTS],
      period: currentPeriod,
      value: sectionKey,
    }),
    readCardapioTrackingCounts({
      eventNames: [...CARDAPIO_HIGHLIGHT_EVENTS],
      period: previousPeriod,
      value: sectionKey,
    }),
    readCardapioTrackingVisitors({
      eventName: CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT,
      period: currentPeriod,
      value: sectionKey,
      distinguishValue: true,
    }),
    readCardapioTrackingVisitors({
      eventName: CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT,
      period: previousPeriod,
      value: sectionKey,
    }),
  ]);

  const totalByEvent = (
    rows: typeof currentRows,
    eventName: CardapioHighlightEventName
  ) =>
    rows
      .filter((row) => row.eventName === eventName)
      .reduce((sum, row) => sum + row._count._all, 0);
  const previousByEvent = (eventName: CardapioHighlightEventName) =>
    previousRows.find((row) => row.eventName === eventName)?._count._all ?? 0;

  const impressions = totalByEvent(
    currentRows,
    CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT
  );
  const expands = totalByEvent(currentRows, CARDAPIO_HIGHLIGHT_EXPAND_EVENT);
  const slideViews = totalByEvent(currentRows, CARDAPIO_HIGHLIGHT_SLIDE_EVENT);
  const ctaClicks = totalByEvent(currentRows, CARDAPIO_HIGHLIGHT_CTA_EVENT);
  const previousImpressions = previousByEvent(
    CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT
  );
  const previousCtaClicks = previousByEvent(CARDAPIO_HIGHLIGHT_CTA_EVENT);

  const sectionMap = new Map(sections.map((section) => [section.key, section]));
  const sectionKeys = new Set([
    ...sections
      .filter((section) =>
        sectionKey ? section.key === sectionKey : section.published
      )
      .map((section) => section.key),
    ...currentRows.map((row) => row.value),
    ...currentVisitors.map((row) => row.value),
  ]);
  const bySection = Array.from(sectionKeys)
    .map((key) => {
      const rows = currentRows.filter((row) => row.value === key);
      const sectionImpressions = totalByEvent(
        rows,
        CARDAPIO_HIGHLIGHT_IMPRESSION_EVENT
      );
      const sectionExpands = totalByEvent(
        rows,
        CARDAPIO_HIGHLIGHT_EXPAND_EVENT
      );
      const sectionCtaClicks = totalByEvent(rows, CARDAPIO_HIGHLIGHT_CTA_EVENT);

      return {
        key,
        title: sectionMap.get(key)?.title ?? key,
        published: sectionMap.get(key)?.published ?? false,
        visitors: currentVisitors.filter((row) => row.value === key).length,
        impressions: sectionImpressions,
        expands: sectionExpands,
        ctaClicks: sectionCtaClicks,
        expandRate: percentage(sectionExpands, sectionImpressions),
        ctr: percentage(sectionCtaClicks, sectionImpressions),
      };
    })
    .sort((a, b) => b.impressions - a.impressions);

  const byPlacement = [
    "mobile_card",
    "mobile_modal",
    "desktop_card",
    "desktop_modal",
  ]
    .map((placement) => ({
      placement,
      total: currentRows
        .filter((row) => row.placement === placement)
        .reduce((sum, row) => sum + row._count._all, 0),
      clicks: currentRows
        .filter(
          (row) =>
            row.placement === placement &&
            row.eventName === CARDAPIO_HIGHLIGHT_CTA_EVENT
        )
        .reduce((sum, row) => sum + row._count._all, 0),
    }))
    .filter((row) => row.total > 0);

  return {
    sections,
    metrics: {
      impressions,
      visitors: new Set(currentVisitors.map((row) => row.clientId)).size,
      expands,
      slideViews,
      ctaClicks,
      expandRate: percentage(expands, impressions),
      ctr: percentage(ctaClicks, impressions),
      previousCtr: percentage(previousCtaClicks, previousImpressions),
      previousVisitors: previousVisitors.length,
    },
    bySection,
    byPlacement,
  };
}
