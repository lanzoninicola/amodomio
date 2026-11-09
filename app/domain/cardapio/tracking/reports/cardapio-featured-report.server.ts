import prismaClient from "~/lib/prisma/client.server";
import {
  CARDAPIO_FEATURED_CTA_EVENT,
  CARDAPIO_FEATURED_EVENTS,
  CARDAPIO_FEATURED_EXPAND_EVENT,
  CARDAPIO_FEATURED_IMPRESSION_EVENT,
  CARDAPIO_FEATURED_SLIDE_EVENT,
  type CardapioFeaturedEventName,
} from "../cardapio-tracking-events";
import {
  readCardapioTrackingCounts,
  readCardapioTrackingVisitors,
} from "../cardapio-tracking-records.server";
import { CONTENT_POST_CHANNELS } from "~/domain/content-post/content-post.shared";

type Period = {
  start: Date;
  end: Date;
};

const percentage = (part: number, total: number) =>
  total > 0 ? (part / total) * 100 : 0;

export async function readCardapioFeaturedReport({
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
    prismaClient.contentPublicationTarget.findMany({
      where: {
        channel: CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
        deletedAt: null,
        ContentPost: { deletedAt: null },
      },
      select: {
        id: true,
        status: true,
        ContentPost: {
          select: { title: true, key: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { ContentPost: { title: "asc" } }],
    }),
    readCardapioTrackingCounts({
      eventNames: [...CARDAPIO_FEATURED_EVENTS],
      period: currentPeriod,
      value: sectionKey,
    }),
    readCardapioTrackingCounts({
      eventNames: [...CARDAPIO_FEATURED_EVENTS],
      period: previousPeriod,
      value: sectionKey,
    }),
    readCardapioTrackingVisitors({
      eventName: CARDAPIO_FEATURED_IMPRESSION_EVENT,
      period: currentPeriod,
      value: sectionKey,
      distinguishValue: true,
    }),
    readCardapioTrackingVisitors({
      eventName: CARDAPIO_FEATURED_IMPRESSION_EVENT,
      period: previousPeriod,
      value: sectionKey,
    }),
  ]);

  const totalByEvent = (
    rows: typeof currentRows,
    eventName: CardapioFeaturedEventName
  ) =>
    rows
      .filter((row) => row.eventName === eventName)
      .reduce((sum, row) => sum + row._count._all, 0);
  const previousByEvent = (eventName: CardapioFeaturedEventName) =>
    previousRows.find((row) => row.eventName === eventName)?._count._all ?? 0;

  const impressions = totalByEvent(
    currentRows,
    CARDAPIO_FEATURED_IMPRESSION_EVENT
  );
  const expands = totalByEvent(currentRows, CARDAPIO_FEATURED_EXPAND_EVENT);
  const slideViews = totalByEvent(currentRows, CARDAPIO_FEATURED_SLIDE_EVENT);
  const ctaClicks = totalByEvent(currentRows, CARDAPIO_FEATURED_CTA_EVENT);
  const previousImpressions = previousByEvent(
    CARDAPIO_FEATURED_IMPRESSION_EVENT
  );
  const previousCtaClicks = previousByEvent(CARDAPIO_FEATURED_CTA_EVENT);

  const normalizedSections = sections.map((section) => ({
    id: section.id,
    title: section.ContentPost.title,
    key: section.ContentPost.key,
    published: section.status === "active",
  }));
  const sectionMap = new Map(
    normalizedSections.map((section) => [section.key, section])
  );
  const sectionKeys = new Set([
    ...normalizedSections
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
        CARDAPIO_FEATURED_IMPRESSION_EVENT
      );
      const sectionExpands = totalByEvent(rows, CARDAPIO_FEATURED_EXPAND_EVENT);
      const sectionCtaClicks = totalByEvent(rows, CARDAPIO_FEATURED_CTA_EVENT);

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
    "bio_card",
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
            row.eventName === CARDAPIO_FEATURED_CTA_EVENT
        )
        .reduce((sum, row) => sum + row._count._all, 0),
    }))
    .filter((row) => row.total > 0);

  return {
    sections: normalizedSections,
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
