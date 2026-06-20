import { CARDAPIO_NAVIGATION_EVENT } from "../cardapio-tracking-events";
import {
  readCardapioCatalogVisitors,
  readCardapioTrackingCounts,
  readCardapioTrackingVisitors,
} from "../cardapio-tracking-records.server";

type Period = {
  start: Date;
  end: Date;
};

export async function readCardapioNavigationReport({
  currentPeriod,
  previousPeriod,
}: {
  currentPeriod: Period;
  previousPeriod: Period;
}) {
  const [
    currentRows,
    previousRows,
    currentUsers,
    previousUsers,
    currentVisitors,
    previousVisitors,
  ] = await Promise.all([
    readCardapioTrackingCounts({
      eventNames: [CARDAPIO_NAVIGATION_EVENT],
      period: currentPeriod,
    }),
    readCardapioTrackingCounts({
      eventNames: [CARDAPIO_NAVIGATION_EVENT],
      period: previousPeriod,
    }),
    readCardapioTrackingVisitors({
      eventName: CARDAPIO_NAVIGATION_EVENT,
      period: currentPeriod,
    }),
    readCardapioTrackingVisitors({
      eventName: CARDAPIO_NAVIGATION_EVENT,
      period: previousPeriod,
    }),
    readCardapioCatalogVisitors(currentPeriod),
    readCardapioCatalogVisitors(previousPeriod),
  ]);

  const count = (row: (typeof currentRows)[number]) => row._count._all;
  const keyOf = (row: (typeof currentRows)[number]) =>
    `${row.control}:${row.value}:${row.placement}`;
  const previousMap = new Map(
    previousRows.map((row) => [keyOf(row), count(row)])
  );
  const clicksCurrent = currentRows.reduce(
    (total, row) => total + count(row),
    0
  );
  const clicksPrevious = previousRows.reduce(
    (total, row) => total + count(row),
    0
  );

  return {
    summary: {
      clicksCurrent,
      clicksPrevious,
      usersCurrent: currentUsers.length,
      usersPrevious: previousUsers.length,
      visitorsCurrent: currentVisitors.length,
      visitorsPrevious: previousVisitors.length,
      adoptionCurrent:
        currentVisitors.length > 0
          ? currentUsers.length / currentVisitors.length
          : 0,
      adoptionPrevious:
        previousVisitors.length > 0
          ? previousUsers.length / previousVisitors.length
          : 0,
    },
    ranking: currentRows
      .map((row) => ({
        key: keyOf(row),
        control: row.control,
        value: row.value,
        placement: row.placement,
        current: count(row),
        previous: previousMap.get(keyOf(row)) ?? 0,
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 20),
  };
}
