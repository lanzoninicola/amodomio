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
  const categoryRows = currentRows.filter((row) => row.control === "category");
  const categoryClicksCurrent = categoryRows.reduce(
    (total, row) => total + count(row),
    0
  );
  const categoryClicksPrevious = previousRows
    .filter((row) => row.control === "category")
    .reduce((total, row) => total + count(row), 0);
  const categoryPreviousMap = new Map<string, number>();
  previousRows
    .filter((row) => row.control === "category")
    .forEach((row) =>
      categoryPreviousMap.set(
        row.value,
        (categoryPreviousMap.get(row.value) ?? 0) + count(row)
      )
    );
  const categoryCurrentMap = new Map<string, number>();
  categoryRows.forEach((row) =>
    categoryCurrentMap.set(
      row.value,
      (categoryCurrentMap.get(row.value) ?? 0) + count(row)
    )
  );
  const categories = [...categoryCurrentMap.entries()]
    .map(([name, current]) => ({
      key: `category:${name}`,
      name,
      current,
      previous: categoryPreviousMap.get(name) ?? 0,
      share: categoryClicksCurrent > 0 ? current / categoryClicksCurrent : 0,
    }))
    .sort((a, b) => b.current - a.current);

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
      categoryClicksCurrent,
      categoryClicksPrevious,
      topCategory: categories[0]?.name ?? null,
    },
    categories,
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
