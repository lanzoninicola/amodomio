import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Maximize2, Tag } from "lucide-react";
import prismaClient from "~/lib/prisma/client.server";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import formatMoneyString from "~/utils/format-money-string";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  MENU_ENGINEERING_QUADRANT_TAGS,
  MENU_ENGINEERING_TAG_NAMES,
  type MenuEngineeringQuadrant,
  type MenuEngineeringTagDisplay,
  resolveMenuEngineeringTag,
} from "~/domain/menu-engineering/menu-engineering-tags";

export const meta: MetaFunction = () => [
  { title: "Menu Engineering Matrix" },
  { name: "robots", content: "noindex" },
];

type MatrixQuadrant = MenuEngineeringQuadrant;

type ImportItem = {
  id: string;
  topping: string;
  quantity: number;
  value: number;
};

type ImportPeriod = {
  id: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  source: string | null;
  totalItemsSold: number;
  totalRevenue: number;
  totalPizzas: number;
  pizzaRevenue: number;
  items: ImportItem[];
};

type MatrixItem = {
  key: string;
  itemId: string | null;
  name: string;
  quantity: number;
  value: number;
  averageValue: number;
  shareQuantity: number;
  shareValue: number;
  quadrant: MatrixQuadrant;
  compareQuantity: number;
  compareValue: number;
  quantityDelta: number | null;
  valueDelta: number | null;
  menuEngineeringTag: MenuEngineeringTagDisplay | null;
  menuEngineeringLinkedElapsedLabel: string | null;
};

type PeriodSummary = {
  importsCount: number;
  flavorsCount: number;
  totalQuantity: number;
  totalValue: number;
  totalItemsSold: number;
  totalRevenue: number;
  totalPizzas: number;
  pizzaRevenue: number;
};

type ExcludedSummary = {
  flavorsCount: number;
  totalQuantity: number;
  totalValue: number;
};

type MonthlyRow = {
  id: string;
  label: string;
  period: string;
  totalQuantity: number;
  totalValue: number;
  totalPizzas: number;
  pizzaRevenue: number;
  flavorsCount: number;
  topFlavor: string | null;
  topFlavorQuantity: number;
};

type LoaderData = {
  filters: {
    year: string;
    periodIds: string[];
    comparePeriodIds: string[];
  };
  years: string[];
  imports: ImportPeriod[];
  selectedImports: ImportPeriod[];
  compareImports: ImportPeriod[];
  summary: PeriodSummary;
  compareSummary: PeriodSummary;
  excludedSummary: ExcludedSummary;
  thresholds: {
    quantityAvg: number;
    valueAvg: number;
  };
  quadrants: Record<MatrixQuadrant, MatrixItem[]>;
  monthlyRows: MonthlyRow[];
};

type ActionData = {
  ok: boolean;
  message: string;
};

type TagAssignmentInput = {
  itemId: string;
  quadrant: MatrixQuadrant;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const pad2 = (value: number) => String(value).padStart(2, "0");

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const menuEngineeringLinkedDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const formatCurrency = (value: number) => {
  const abs = Math.abs(value);
  const formatted = formatMoneyString(abs);
  return `${value < 0 ? "-R$ " : "R$ "}${formatted}`;
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatDecimalPlaces(value, 1)}%`;
};

const formatElapsedSince = (date: Date | string | null | undefined) => {
  if (!date) return null;

  const linkedAt = new Date(date);
  const elapsedMs = Date.now() - linkedAt.getTime();
  if (!Number.isFinite(elapsedMs)) return null;

  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
  if (elapsedMinutes < 60) {
    return elapsedMinutes <= 1 ? "há 1 min" : `há ${elapsedMinutes} min`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 48) {
    return elapsedHours === 1 ? "há 1 hora" : `há ${elapsedHours} horas`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 60) {
    return elapsedDays === 1 ? "há 1 dia" : `há ${elapsedDays} dias`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 24) {
    return elapsedMonths === 1 ? "há 1 mês" : `há ${elapsedMonths} meses`;
  }

  const elapsedYears = Math.floor(elapsedDays / 365);
  return elapsedYears <= 1 ? "há 1 ano" : `há ${elapsedYears} anos`;
};

const formatMenuEngineeringLinkedLabel = (
  date: Date | string | null | undefined
) => {
  const elapsed = formatElapsedSince(date);
  if (!date || !elapsed) return null;
  return `Vínculo da análise ${elapsed} (${menuEngineeringLinkedDateFormatter.format(
    new Date(date)
  )})`;
};

const periodLabel = (
  period: Pick<ImportPeriod, "periodStart" | "periodEnd">
) => {
  const start = new Date(period.periodStart);
  const end = new Date(period.periodEnd);
  return `${dateFormatter.format(start)} ate ${dateFormatter.format(end)}`;
};

const shortPeriodLabel = (period: ImportPeriod) => {
  const start = new Date(period.periodStart);
  const end = new Date(period.periodEnd);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth)
    return `${pad2(start.getUTCMonth() + 1)}/${start.getUTCFullYear()}`;
  return periodLabel(period);
};

const yearsForPeriod = (
  period: Pick<ImportPeriod, "periodStart" | "periodEnd">
) => {
  const startYear = new Date(period.periodStart).getUTCFullYear();
  const endYear = new Date(period.periodEnd).getUTCFullYear();
  return Array.from(
    { length: Math.max(0, endYear - startYear + 1) },
    (_, index) => String(startYear + index)
  );
};

const periodOverlapsYear = (
  period: Pick<ImportPeriod, "periodStart" | "periodEnd">,
  year: string
) => {
  const numericYear = Number(year);
  if (!Number.isFinite(numericYear)) return false;

  const yearStart = Date.UTC(numericYear, 0, 1, 0, 0, 0);
  const yearEnd = Date.UTC(numericYear, 11, 31, 23, 59, 59);
  const periodStart = new Date(period.periodStart).getTime();
  const periodEnd = new Date(period.periodEnd).getTime();

  return periodStart <= yearEnd && periodEnd >= yearStart;
};

const percentDelta = (current: number, previous: number) => {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
};

const emptySummary = (): PeriodSummary => ({
  importsCount: 0,
  flavorsCount: 0,
  totalQuantity: 0,
  totalValue: 0,
  totalItemsSold: 0,
  totalRevenue: 0,
  totalPizzas: 0,
  pizzaRevenue: 0,
});

const emptyExcludedSummary = (): ExcludedSummary => ({
  flavorsCount: 0,
  totalQuantity: 0,
  totalValue: 0,
});

const aggregateImports = (imports: ImportPeriod[]) => {
  const byFlavor = new Map<
    string,
    { name: string; quantity: number; value: number }
  >();
  const summary = emptySummary();

  imports.forEach((importPeriod) => {
    summary.importsCount += 1;
    summary.totalItemsSold += importPeriod.totalItemsSold;
    summary.totalRevenue += importPeriod.totalRevenue;
    summary.totalPizzas += importPeriod.totalPizzas;
    summary.pizzaRevenue += importPeriod.pizzaRevenue;

    importPeriod.items.forEach((item) => {
      const key = normalize(item.topping);
      const current = byFlavor.get(key) ?? {
        name: item.topping,
        quantity: 0,
        value: 0,
      };
      current.quantity += item.quantity;
      current.value += item.value;
      byFlavor.set(key, current);
    });
  });

  summary.flavorsCount = byFlavor.size;
  summary.totalQuantity = Array.from(byFlavor.values()).reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  summary.totalValue = Array.from(byFlavor.values()).reduce(
    (sum, item) => sum + item.value,
    0
  );

  return { byFlavor, summary };
};

const filterImportsByCurrentCardapio = (
  imports: ImportPeriod[],
  allowedFlavorKeys: Set<string>
) => {
  const excludedByFlavor = new Map<
    string,
    { quantity: number; value: number }
  >();

  const filteredImports = imports.map((importPeriod) => ({
    ...importPeriod,
    items: importPeriod.items.filter((item) => {
      const key = normalize(item.topping);
      const allowed = allowedFlavorKeys.has(key);

      if (!allowed) {
        const current = excludedByFlavor.get(key) ?? { quantity: 0, value: 0 };
        current.quantity += item.quantity;
        current.value += item.value;
        excludedByFlavor.set(key, current);
      }

      return allowed;
    }),
  }));

  const excludedSummary = Array.from(excludedByFlavor.values()).reduce(
    (summary, item) => {
      summary.totalQuantity += item.quantity;
      summary.totalValue += item.value;
      return summary;
    },
    {
      ...emptyExcludedSummary(),
      flavorsCount: excludedByFlavor.size,
    }
  );

  return { filteredImports, excludedSummary };
};

const buildMonthlyRows = (imports: ImportPeriod[]): MonthlyRow[] =>
  [...imports]
    .sort(
      (a, b) =>
        new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
    )
    .map((importPeriod) => {
      const totalQuantity = importPeriod.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      const totalValue = importPeriod.items.reduce(
        (sum, item) => sum + item.value,
        0
      );
      const topFlavor = [...importPeriod.items].sort(
        (a, b) => b.quantity - a.quantity
      )[0];

      return {
        id: importPeriod.id,
        label: shortPeriodLabel(importPeriod),
        period: periodLabel(importPeriod),
        totalQuantity,
        totalValue,
        totalPizzas: importPeriod.totalPizzas,
        pizzaRevenue: importPeriod.pizzaRevenue,
        flavorsCount: importPeriod.items.length,
        topFlavor: topFlavor?.topping ?? null,
        topFlavorQuantity: topFlavor?.quantity ?? 0,
      };
    });

const buildTicks = (min: number, max: number, count: number) => {
  if (count <= 1) return [min];
  const range = max - min || 1;
  const step = range / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
};

const toPointLabel = (name: string) => {
  const compact = normalize(name).replace(/\s+/g, "");
  return (compact.slice(0, 4) || name.slice(0, 4)).toUpperCase();
};

const isMatrixQuadrant = (value: string): value is MatrixQuadrant =>
  Object.prototype.hasOwnProperty.call(MENU_ENGINEERING_QUADRANT_TAGS, value);

async function ensureMenuEngineeringTags() {
  const now = new Date();
  const existingTags = await prismaClient.tag.findMany({
    where: {
      name: { in: MENU_ENGINEERING_TAG_NAMES },
      deletedAt: null,
    },
    select: { id: true, name: true, public: true, colorHEX: true },
  });
  const tagsByName = new Map(existingTags.map((tag) => [tag.name, tag]));

  for (const config of Object.values(MENU_ENGINEERING_QUADRANT_TAGS)) {
    const existingTag = tagsByName.get(config.tagName);
    if (!existingTag) {
      const created = await prismaClient.tag.create({
        data: {
          name: config.tagName,
          public: false,
          colorHEX: config.colorHEX,
          featuredFilter: false,
          sortOrderIndex: config.sortOrderIndex,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
        select: { id: true, name: true, public: true, colorHEX: true },
      });
      tagsByName.set(config.tagName, created);
      continue;
    }

    if (existingTag.public || existingTag.colorHEX !== config.colorHEX) {
      const updated = await prismaClient.tag.update({
        where: { id: existingTag.id },
        data: {
          public: false,
          colorHEX: config.colorHEX,
        },
        select: { id: true, name: true, public: true, colorHEX: true },
      });
      tagsByName.set(config.tagName, updated);
    }
  }

  return tagsByName;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const [imports, currentCardapioItems] = await Promise.all([
    prismaClient.menuEngineeringImport.findMany({
      select: {
        id: true,
        month: true,
        year: true,
        periodStart: true,
        periodEnd: true,
        source: true,
        totalItemsSold: true,
        totalRevenue: true,
        totalPizzas: true,
        pizzaRevenue: true,
        items: {
          select: { id: true, topping: true, quantity: true, value: true },
          orderBy: { quantity: "desc" },
        },
      },
      orderBy: [{ periodStart: "desc" }, { periodEnd: "desc" }],
    }),
    prismaClient.item.findMany({
      where: {
        active: true,
        canSell: true,
        ItemSellingInfo: {
          is: {
            upcoming: false,
          },
        },
        ItemSellingChannelItem: {
          some: {
            visible: true,
            ItemSellingChannel: {
              key: "cardapio",
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
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
    }),
  ]);

  const currentCardapioFlavorByKey = new Map(
    currentCardapioItems.map((item) => {
      const tagRow = item.ItemTag.map((row) => ({
        tag: resolveMenuEngineeringTag(row.Tag?.name, row.Tag?.colorHEX),
        linkedAt: row.menuEngineeringLinkedAt,
      })).find((row) => row.tag);
      return [
        normalize(item.name),
        {
          id: String(item.id),
          name: item.name,
          menuEngineeringTag: tagRow?.tag ?? null,
          menuEngineeringLinkedElapsedLabel:
            formatMenuEngineeringLinkedLabel(tagRow?.linkedAt) ?? null,
        },
      ];
    })
  );
  const currentCardapioFlavorKeys = new Set(currentCardapioFlavorByKey.keys());

  const serializedImports: ImportPeriod[] = imports.map((importPeriod) => ({
    ...importPeriod,
    periodStart: importPeriod.periodStart.toISOString(),
    periodEnd: importPeriod.periodEnd.toISOString(),
  }));

  const years = Array.from(
    new Set(
      serializedImports.flatMap((importPeriod) => yearsForPeriod(importPeriod))
    )
  ).sort((a, b) => Number(b) - Number(a));

  const requestedYear = url.searchParams.get("year");
  const resolvedYear =
    requestedYear && years.includes(requestedYear)
      ? requestedYear
      : years[0] ?? "";
  const requestedPeriodIds = url.searchParams
    .getAll("period")
    .filter((value) =>
      serializedImports.some((importPeriod) => importPeriod.id === value)
    );
  const requestedComparePeriodIds = url.searchParams
    .getAll("comparePeriod")
    .filter((value) =>
      serializedImports.some((importPeriod) => importPeriod.id === value)
    );

  const importsInYear = serializedImports.filter((importPeriod) =>
    resolvedYear ? periodOverlapsYear(importPeriod, resolvedYear) : false
  );
  const selectedImports =
    requestedPeriodIds.length > 0
      ? serializedImports.filter((importPeriod) =>
          requestedPeriodIds.includes(importPeriod.id)
        )
      : importsInYear;
  const compareImports =
    requestedComparePeriodIds.length > 0
      ? serializedImports.filter((importPeriod) =>
          requestedComparePeriodIds.includes(importPeriod.id)
        )
      : [];

  const { filteredImports: selectedVisibleImports, excludedSummary } =
    filterImportsByCurrentCardapio(selectedImports, currentCardapioFlavorKeys);
  const { filteredImports: compareVisibleImports } =
    filterImportsByCurrentCardapio(compareImports, currentCardapioFlavorKeys);

  const currentAggregate = aggregateImports(selectedVisibleImports);
  const compareAggregate = aggregateImports(compareVisibleImports);
  const items = Array.from(currentAggregate.byFlavor.entries()).map(
    ([key, item]) => {
      const compare = compareAggregate.byFlavor.get(key);
      const currentItem = currentCardapioFlavorByKey.get(key) ?? null;
      return {
        key,
        itemId: currentItem?.id ?? null,
        name: currentItem?.name ?? item.name,
        quantity: item.quantity,
        value: item.value,
        compareQuantity: compare?.quantity ?? 0,
        compareValue: compare?.value ?? 0,
        menuEngineeringTag: currentItem?.menuEngineeringTag ?? null,
        menuEngineeringLinkedElapsedLabel:
          currentItem?.menuEngineeringLinkedElapsedLabel ?? null,
      };
    }
  );

  const quantityAvg = items.length
    ? items.reduce((sum, item) => sum + item.quantity, 0) / items.length
    : 0;
  const valueAvg = items.length
    ? items.reduce((sum, item) => sum + item.value, 0) / items.length
    : 0;

  const quadrants: Record<MatrixQuadrant, MatrixItem[]> = {
    champions: [],
    volume: [],
    potential: [],
    lowPriority: [],
  };

  items.forEach((item) => {
    const highQuantity = item.quantity >= quantityAvg;
    const highValue = item.value >= valueAvg;
    const quadrant: MatrixQuadrant = highQuantity
      ? highValue
        ? "champions"
        : "volume"
      : highValue
      ? "potential"
      : "lowPriority";

    quadrants[quadrant].push({
      ...item,
      averageValue: item.quantity ? item.value / item.quantity : 0,
      shareQuantity: currentAggregate.summary.totalQuantity
        ? (item.quantity / currentAggregate.summary.totalQuantity) * 100
        : 0,
      shareValue: currentAggregate.summary.totalValue
        ? (item.value / currentAggregate.summary.totalValue) * 100
        : 0,
      quadrant,
      quantityDelta: percentDelta(item.quantity, item.compareQuantity),
      valueDelta: percentDelta(item.value, item.compareValue),
    });
  });

  (Object.keys(quadrants) as MatrixQuadrant[]).forEach((key) => {
    quadrants[key] = quadrants[key].sort((a, b) => b.quantity - a.quantity);
  });

  return json<LoaderData>({
    filters: {
      year: resolvedYear,
      periodIds: selectedImports.map((importPeriod) => importPeriod.id),
      comparePeriodIds: compareImports.map((importPeriod) => importPeriod.id),
    },
    years,
    imports: serializedImports,
    selectedImports: selectedVisibleImports,
    compareImports: compareVisibleImports,
    summary: currentAggregate.summary,
    compareSummary: compareAggregate.summary,
    excludedSummary,
    thresholds: {
      quantityAvg,
      valueAvg,
    },
    quadrants,
    monthlyRows: buildMonthlyRows(selectedVisibleImports),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionName = String(formData.get("_action") || "").trim();

  if (actionName !== "apply-menu-engineering-tags") {
    return json<ActionData>(
      { ok: false, message: "Acao invalida." },
      { status: 400 }
    );
  }

  let assignmentsInput: unknown = null;
  try {
    assignmentsInput = JSON.parse(String(formData.get("assignments") || "[]"));
  } catch {
    return json<ActionData>(
      { ok: false, message: "Lista de vinculos invalida." },
      { status: 400 }
    );
  }

  if (!Array.isArray(assignmentsInput)) {
    return json<ActionData>(
      { ok: false, message: "Lista de vinculos invalida." },
      { status: 400 }
    );
  }

  const uniqueAssignments = new Map<string, TagAssignmentInput>();
  assignmentsInput.forEach((assignment) => {
    const itemId = String((assignment as any)?.itemId || "").trim();
    const quadrant = String((assignment as any)?.quadrant || "").trim();
    if (!itemId || !isMatrixQuadrant(quadrant)) return;
    uniqueAssignments.set(itemId, { itemId, quadrant });
  });

  const assignments = Array.from(uniqueAssignments.values());
  if (assignments.length === 0) {
    return json<ActionData>({
      ok: true,
      message: "Nenhum sabor pendente para vincular.",
    });
  }

  const items = await prismaClient.item.findMany({
    where: {
      id: {
        in: assignments.map((assignment) => assignment.itemId),
      },
    },
    select: { id: true },
  });
  const validItemIds = new Set(items.map((item) => item.id));
  const validAssignments = assignments.filter((assignment) =>
    validItemIds.has(assignment.itemId)
  );

  if (validAssignments.length === 0) {
    return json<ActionData>(
      { ok: false, message: "Nenhum sabor valido encontrado." },
      { status: 400 }
    );
  }

  const tagsByName = await ensureMenuEngineeringTags();
  const tagIds = Array.from(tagsByName.values()).map((tag) => tag.id);
  const now = new Date();
  let appliedCount = 0;

  for (const assignment of validAssignments) {
    const config = MENU_ENGINEERING_QUADRANT_TAGS[assignment.quadrant];
    const tag = tagsByName.get(config.tagName);
    if (!tag) continue;

    await prismaClient.itemTag.deleteMany({
      where: {
        itemId: assignment.itemId,
        tagId: {
          in: tagIds.filter((tagId) => tagId !== tag.id),
        },
      },
    });

    const existingItemTag = await prismaClient.itemTag.findFirst({
      where: {
        itemId: assignment.itemId,
        tagId: tag.id,
      },
      select: { id: true, deletedAt: true },
    });

    if (existingItemTag) {
      if (existingItemTag.deletedAt) {
        await prismaClient.itemTag.update({
          where: { id: existingItemTag.id },
          data: {
            deletedAt: null,
            menuEngineeringLinkedAt: now,
            updatedAt: now,
          },
        });
      } else {
        await prismaClient.itemTag.update({
          where: { id: existingItemTag.id },
          data: {
            menuEngineeringLinkedAt: now,
            updatedAt: now,
          },
        });
      }
    } else {
      await prismaClient.itemTag.create({
        data: {
          itemId: assignment.itemId,
          tagId: tag.id,
          menuEngineeringLinkedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    appliedCount += 1;
  }

  return json<ActionData>({
    ok: true,
    message: `${appliedCount} sabor(es) sincronizado(s) com esta analise.`,
  });
}

const quadrantMeta: Record<
  MatrixQuadrant,
  { title: string; note: string; badge: string }
> = {
  champions: {
    title: MENU_ENGINEERING_QUADRANT_TAGS.champions.title,
    note: MENU_ENGINEERING_QUADRANT_TAGS.champions.note,
    badge: MENU_ENGINEERING_QUADRANT_TAGS.champions.badgeClassName,
  },
  volume: {
    title: MENU_ENGINEERING_QUADRANT_TAGS.volume.title,
    note: MENU_ENGINEERING_QUADRANT_TAGS.volume.note,
    badge: MENU_ENGINEERING_QUADRANT_TAGS.volume.badgeClassName,
  },
  potential: {
    title: MENU_ENGINEERING_QUADRANT_TAGS.potential.title,
    note: MENU_ENGINEERING_QUADRANT_TAGS.potential.note,
    badge: MENU_ENGINEERING_QUADRANT_TAGS.potential.badgeClassName,
  },
  lowPriority: {
    title: MENU_ENGINEERING_QUADRANT_TAGS.lowPriority.title,
    note: MENU_ENGINEERING_QUADRANT_TAGS.lowPriority.note,
    badge: MENU_ENGINEERING_QUADRANT_TAGS.lowPriority.badgeClassName,
  },
};

const quadrantOrder: MatrixQuadrant[] = [
  "champions",
  "potential",
  "volume",
  "lowPriority",
];

const quadrantColors: Record<MatrixQuadrant, { fill: string; stroke: string }> =
  {
    champions: {
      fill: MENU_ENGINEERING_QUADRANT_TAGS.champions.fill,
      stroke: MENU_ENGINEERING_QUADRANT_TAGS.champions.stroke,
    },
    potential: {
      fill: MENU_ENGINEERING_QUADRANT_TAGS.potential.fill,
      stroke: MENU_ENGINEERING_QUADRANT_TAGS.potential.stroke,
    },
    volume: {
      fill: MENU_ENGINEERING_QUADRANT_TAGS.volume.fill,
      stroke: MENU_ENGINEERING_QUADRANT_TAGS.volume.stroke,
    },
    lowPriority: {
      fill: MENU_ENGINEERING_QUADRANT_TAGS.lowPriority.fill,
      stroke: MENU_ENGINEERING_QUADRANT_TAGS.lowPriority.stroke,
    },
  };

export default function AdminGerenciamentoCardapioMenuEngineering() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [hovered, setHovered] = useState<MatrixItem | null>(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);

  const allItems = useMemo(
    () => quadrantOrder.flatMap((key) => data.quadrants[key]),
    [data.quadrants]
  );
  const defaultHighlight = useMemo(() => {
    if (allItems.length === 0) return null;
    return [...allItems].sort((a, b) => b.quantity - a.quantity)[0] ?? null;
  }, [allItems]);
  const comparedItems = useMemo(
    () =>
      [...allItems]
        .filter((item) => item.compareQuantity > 0 || item.compareValue > 0)
        .sort(
          (a, b) => Math.abs(b.valueDelta ?? 0) - Math.abs(a.valueDelta ?? 0)
        )
        .slice(0, 12),
    [allItems]
  );
  const pendingTagItems = useMemo(
    () =>
      allItems.filter((item) => {
        if (!item.itemId) return false;
        const suggestedTag = MENU_ENGINEERING_QUADRANT_TAGS[item.quadrant];
        return item.menuEngineeringTag?.tagName !== suggestedTag.tagName;
      }),
    [allItems]
  );
  const tagAssignmentsJson = useMemo(
    () =>
      JSON.stringify(
        pendingTagItems.map((item) => ({
          itemId: item.itemId,
          quadrant: item.quadrant,
        }))
      ),
    [pendingTagItems]
  );

  const chart = useMemo(() => {
    const width = 1000;
    const height = 560;
    const padding = { top: 30, right: 30, bottom: 70, left: 90 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const xValues = allItems.map((item) => item.value);
    const yValues = allItems.map((item) => item.quantity);
    const minX = 0;
    const maxX = Math.max(1, ...xValues);
    const minY = 0;
    const maxY = Math.max(1, ...yValues);
    const xPadding = maxX * 0.1;
    const yPadding = maxY * 0.1;
    const xMax = maxX + xPadding;
    const yMax = maxY + yPadding;

    const scaleX = (value: number) =>
      padding.left + ((value - minX) / (xMax - minX || 1)) * plotWidth;
    const scaleY = (value: number) =>
      padding.top +
      plotHeight -
      ((value - minY) / (yMax - minY || 1)) * plotHeight;

    return {
      width,
      height,
      padding,
      plotWidth,
      plotHeight,
      xMax,
      yMax,
      scaleX,
      scaleY,
    };
  }, [allItems]);

  const xTicks = useMemo(() => buildTicks(0, chart.xMax, 5), [chart]);
  const yTicks = useMemo(() => buildTicks(0, chart.yMax, 5), [chart]);
  const selectedLabel =
    data.selectedImports.length === 0
      ? "Sem periodo"
      : data.selectedImports.length === 1
      ? periodLabel(data.selectedImports[0])
      : `${data.selectedImports.length} periodos selecionados`;
  const maxMonthlyQuantity = Math.max(
    1,
    ...data.monthlyRows.map((row) => row.totalQuantity)
  );
  const applyingTags =
    navigation.state !== "idle" &&
    navigation.formData?.get("_action") === "apply-menu-engineering-tags";
  const sectionClassName = "border-0 bg-transparent shadow-none";
  const renderFlavorMatrixChart = (className: string) => (
    <svg
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      className={className}
      role="img"
      aria-label="Scatter plot da matriz de sabores"
    >
      <rect
        x={chart.padding.left}
        y={chart.padding.top}
        width={chart.plotWidth}
        height={chart.plotHeight}
        rx="8"
        fill="#F8F9FB"
      />

      {xTicks.map((value) => {
        const x = chart.scaleX(value);
        return (
          <g key={`x-${value}`}>
            <line
              x1={x}
              y1={chart.padding.top}
              x2={x}
              y2={chart.padding.top + chart.plotHeight}
              stroke="#E5E7EB"
              strokeDasharray="4 6"
            />
            <text
              x={x}
              y={chart.padding.top + chart.plotHeight + 32}
              textAnchor="middle"
              fontSize="12"
              fill="#6B7280"
            >
              {formatCurrency(value)}
            </text>
          </g>
        );
      })}

      {yTicks.map((value) => {
        const y = chart.scaleY(value);
        return (
          <g key={`y-${value}`}>
            <line
              x1={chart.padding.left}
              y1={y}
              x2={chart.padding.left + chart.plotWidth}
              y2={y}
              stroke="#E5E7EB"
              strokeDasharray="4 6"
            />
            <text
              x={chart.padding.left - 12}
              y={y + 4}
              textAnchor="end"
              fontSize="12"
              fill="#6B7280"
            >
              {formatDecimalPlaces(value, 0)}
            </text>
          </g>
        );
      })}

      <line
        x1={chart.scaleX(data.thresholds.valueAvg)}
        y1={chart.padding.top}
        x2={chart.scaleX(data.thresholds.valueAvg)}
        y2={chart.padding.top + chart.plotHeight}
        stroke="#111827"
        strokeDasharray="6 8"
        opacity="0.35"
      />
      <line
        x1={chart.padding.left}
        y1={chart.scaleY(data.thresholds.quantityAvg)}
        x2={chart.padding.left + chart.plotWidth}
        y2={chart.scaleY(data.thresholds.quantityAvg)}
        stroke="#111827"
        strokeDasharray="6 8"
        opacity="0.35"
      />

      {allItems.map((item) => {
        const cx = chart.scaleX(item.value);
        const cy = chart.scaleY(item.quantity);
        const color = quadrantColors[item.quadrant];
        return (
          <g
            key={item.key}
            onMouseEnter={() => setHovered(item)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(item)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={7.5}
              fill={color.fill}
              stroke={color.stroke}
              strokeWidth={1}
              opacity={hovered && hovered.key === item.key ? 1 : 0.85}
            />
            <text
              x={cx + 10}
              y={cy + 4}
              fontSize="11"
              fill="#111827"
              opacity={hovered && hovered.key === item.key ? 1 : 0.85}
            >
              {toPointLabel(item.name)}
            </text>
          </g>
        );
      })}

      <text
        x={chart.padding.left + chart.plotWidth / 2}
        y={chart.height - 18}
        textAnchor="middle"
        fontSize="14"
        fill="#374151"
      >
        Faturamento por sabor
      </text>
      <text
        x={16}
        y={chart.padding.top + chart.plotHeight / 2}
        textAnchor="middle"
        fontSize="14"
        fill="#374151"
        transform={`rotate(-90 16 ${chart.padding.top + chart.plotHeight / 2})`}
      >
        Quantidade vendida
      </text>
    </svg>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Menu Engineering Matrix</h1>
          <p className="text-sm text-muted-foreground">
            Quantidade vendida x faturamento por sabor, usando os JSONs
            importados da extensao.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/gerenciamento/cardapio/dashboard/menu-engineering/import">
            Importar vendas
          </Link>
        </Button>
      </div>

      {actionData?.message ? (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            actionData.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {actionData.message}
        </div>
      ) : null}

      <Separator />

      <Card className={sectionClassName}>
        <CardHeader className="px-0">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Selecione um ano completo, periodos especificos e um grupo de
            comparacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Form
            method="get"
            className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]"
          >
            <label className="flex flex-col gap-1 text-sm">
              Ano rapido
              <select
                name="year"
                defaultValue={data.filters.year}
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                {data.years.length === 0 ? (
                  <option value="">Sem importacoes</option>
                ) : (
                  data.years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Periodos analisados
              <select
                name="period"
                multiple
                defaultValue={data.filters.periodIds}
                className="min-h-[132px] rounded-md border border-input bg-background px-3 py-2"
              >
                {data.imports.map((importPeriod) => (
                  <option key={importPeriod.id} value={importPeriod.id}>
                    {shortPeriodLabel(importPeriod)}
                    {importPeriod.source ? ` · ${importPeriod.source}` : ""}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                Sem selecao manual, o ano rapido carrega todos os periodos
                daquele ano.
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Comparar com
              <select
                name="comparePeriod"
                multiple
                defaultValue={data.filters.comparePeriodIds}
                className="min-h-[132px] rounded-md border border-input bg-background px-3 py-2"
              >
                {data.imports.map((importPeriod) => (
                  <option key={importPeriod.id} value={importPeriod.id}>
                    {shortPeriodLabel(importPeriod)}
                    {importPeriod.source ? ` · ${importPeriod.source}` : ""}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                Use Ctrl ou Command para selecionar varios periodos.
              </span>
            </label>

            <div className="lg:col-span-3">
              <Button type="submit">Aplicar filtros</Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-3 md:grid-cols-4">
        <Card className={sectionClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Periodos</CardTitle>
            <CardDescription>{selectedLabel}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {data.summary.importsCount}
          </CardContent>
        </Card>
        <Card className={sectionClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sabores</CardTitle>
            <CardDescription>Sabores unicos no consolidado</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {data.summary.flavorsCount}
          </CardContent>
        </Card>
        <Card className={sectionClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quantidade</CardTitle>
            <CardDescription>Soma de qtd_total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {formatDecimalPlaces(data.summary.totalQuantity, 2)}
          </CardContent>
        </Card>
        <Card className={sectionClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Faturamento</CardTitle>
            <CardDescription>Soma de valor_total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {formatCurrency(data.summary.totalValue)}
          </CardContent>
        </Card>
      </div>

      {data.excludedSummary.flavorsCount > 0 ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.excludedSummary.flavorsCount} sabores importados nao aparecem no
          cardapio atual e foram ocultados da visualizacao. Quantidade ocultada:{" "}
          {formatDecimalPlaces(data.excludedSummary.totalQuantity, 2)} · Valor:
          {formatCurrency(data.excludedSummary.totalValue)}
        </div>
      ) : null}

      <Separator />

      <Card className={sectionClassName}>
        <CardHeader className="px-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl">Matriz de sabores</CardTitle>
              <CardDescription>
                Faturamento total x quantidade vendida
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Quantidade media:{" "}
                {formatDecimalPlaces(data.thresholds.quantityAvg, 2)}
              </span>
              <span>
                Faturamento medio: {formatCurrency(data.thresholds.valueAvg)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 px-0 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-md bg-white/90 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Legenda
            </p>
            <div className="grid gap-3">
              {quadrantOrder.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: quadrantColors[key].fill }}
                  />
                  <div className="text-sm">
                    <p className="font-medium">{quadrantMeta[key].title}</p>
                    <p className="text-xs text-muted-foreground">
                      {quadrantMeta[key].note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded-md bg-white/80 p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute right-4 top-4 z-10 bg-white"
              onClick={() => setChartDialogOpen(true)}
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              Ampliar grafico
            </Button>
            {renderFlavorMatrixChart("h-[620px] w-full")}
          </div>

          <Dialog open={chartDialogOpen} onOpenChange={setChartDialogOpen}>
            <DialogContent className="h-[92dvh] w-[96vw] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden p-5">
              <DialogHeader className="pr-8">
                <DialogTitle>Matriz de sabores</DialogTitle>
                <DialogDescription>
                  Faturamento total x quantidade vendida no periodo selecionado.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 overflow-hidden rounded-md bg-white">
                {renderFlavorMatrixChart("h-full w-full")}
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid gap-3 rounded-md bg-white/90 p-4 md:grid-cols-4 xl:col-span-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                Detalhes
              </p>
              {hovered ? (
                <span className="text-xs text-muted-foreground">
                  Hover ativo
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Passe o mouse no grafico
                </span>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground">Quantidade</p>
              <p className="font-semibold">
                {formatDecimalPlaces(
                  (hovered ?? defaultHighlight)?.quantity ?? 0,
                  2
                )}
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="font-semibold">
                {formatCurrency((hovered ?? defaultHighlight)?.value ?? 0)}
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground">Sabor em destaque</p>
              <p className="font-semibold text-slate-900">
                {(hovered ?? defaultHighlight)?.name ?? "Nenhum item"}
              </p>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      quadrantColors[
                        (hovered ?? defaultHighlight)?.quadrant ?? "champions"
                      ].fill,
                  }}
                />
                {hovered ?? defaultHighlight
                  ? quadrantMeta[(hovered ?? defaultHighlight)!.quadrant].title
                  : "-"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className={sectionClassName}>
        <CardHeader className="px-0">
          <CardTitle>Visualizacao por mes</CardTitle>
          <CardDescription>
            Historico dos periodos selecionados.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-0">
          {data.monthlyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum periodo selecionado.
            </p>
          ) : (
            data.monthlyRows.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-[130px_minmax(0,1fr)_220px]"
              >
                <div>
                  <p className="font-semibold">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.period}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-3 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.max(
                          4,
                          (row.totalQuantity / maxMonthlyQuantity) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="w-20 text-right text-sm font-medium">
                    {formatDecimalPlaces(row.totalQuantity, 2)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-slate-900">
                    {formatCurrency(row.totalValue)}
                  </p>
                  <p>
                    Top: {row.topFlavor ?? "-"} (
                    {formatDecimalPlaces(row.topFlavorQuantity, 2)})
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {data.compareImports.length > 0 ? (
        <>
          <Separator />
          <Card className={sectionClassName}>
            <CardHeader className="px-0">
              <CardTitle>Comparacao entre periodos</CardTitle>
              <CardDescription>
                Variacao dos sabores presentes no periodo analisado contra o
                grupo de comparacao.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-0 text-sm">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Faturamento atual
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(data.summary.totalValue)}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Faturamento comparado
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(data.compareSummary.totalValue)}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Variacao faturamento
                  </p>
                  <p className="font-semibold">
                    {formatPercent(
                      percentDelta(
                        data.summary.totalValue,
                        data.compareSummary.totalValue
                      )
                    )}
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Variacao quantidade
                  </p>
                  <p className="font-semibold">
                    {formatPercent(
                      percentDelta(
                        data.summary.totalQuantity,
                        data.compareSummary.totalQuantity
                      )
                    )}
                  </p>
                </div>
              </div>

              {comparedItems.length === 0 ? (
                <p className="text-muted-foreground">
                  Sem sabores em comum para comparar.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Sabor</th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Qtd atual
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Qtd comp.
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Var. qtd
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Valor atual
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Valor comp.
                        </th>
                        <th className="py-2 text-right font-medium">
                          Var. valor
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparedItems.map((item) => (
                        <tr
                          key={item.key}
                          className="border-t border-border/60"
                        >
                          <td className="py-2 pr-3 font-medium">{item.name}</td>
                          <td className="py-2 pr-3 text-right">
                            {formatDecimalPlaces(item.quantity, 2)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {formatDecimalPlaces(item.compareQuantity, 2)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {formatPercent(item.quantityDelta)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {formatCurrency(item.value)}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {formatCurrency(item.compareValue)}
                          </td>
                          <td className="py-2 text-right">
                            {formatPercent(item.valueDelta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            Vinculos de Menu Engineering
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingTagItems.length > 0
              ? `${pendingTagItems.length} sabor(es) com tag diferente da analise atual.`
              : "Todos os sabores vinculados ja acompanham esta analise."}
          </p>
        </div>
        <Form method="post">
          <input
            type="hidden"
            name="_action"
            value="apply-menu-engineering-tags"
          />
          <input type="hidden" name="assignments" value={tagAssignmentsJson} />
          <Button
            type="submit"
            disabled={pendingTagItems.length === 0 || applyingTags}
            className="h-9 gap-2"
          >
            <Tag className="h-4 w-4" />
            {applyingTags ? "Vinculando..." : "Vincular tags da analise"}
          </Button>
        </Form>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {quadrantOrder.map((key) => {
          const quadrant = quadrantMeta[key];
          const items = data.quadrants[key];
          return (
            <Card key={key} className={`flex flex-col ${sectionClassName}`}>
              <CardHeader className="gap-1 px-0">
                <div className="flex items-center justify-between">
                  <CardTitle>{quadrant.title}</CardTitle>
                  <Badge className={quadrant.badge}>
                    {items.length} sabores
                  </Badge>
                </div>
                <CardDescription>{quadrant.note}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 px-0">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum sabor neste quadrante.
                  </p>
                ) : (
                  items.map((item) => {
                    const suggestedTag =
                      MENU_ENGINEERING_QUADRANT_TAGS[item.quadrant];
                    const tagChanged =
                      item.menuEngineeringTag?.tagName !== suggestedTag.tagName;

                    return (
                      <div
                        key={item.key}
                        className={`rounded-md p-3 ${
                          tagChanged
                            ? "bg-amber-50 ring-1 ring-amber-200"
                            : "bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{item.name}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            {tagChanged ? (
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-white text-amber-700"
                              >
                                mudou
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-white text-emerald-700"
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                igual
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDecimalPlaces(item.shareQuantity, 1)}% da
                              quantidade
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>
                            Qtd: {formatDecimalPlaces(item.quantity, 2)}
                          </span>
                          <span>Valor: {formatCurrency(item.value)}</span>
                          <span>
                            Media/un.: {formatCurrency(item.averageValue)}
                          </span>
                          <span>
                            {formatDecimalPlaces(item.shareValue, 1)}% do valor
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                          <div className="space-y-1">
                            <p className="font-medium text-muted-foreground">
                              Tag atual
                            </p>
                            {item.menuEngineeringTag ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className="border-transparent bg-white"
                                  style={{
                                    color: item.menuEngineeringTag.colorHEX,
                                  }}
                                >
                                  {item.menuEngineeringTag.title}
                                </Badge>
                                {item.menuEngineeringLinkedElapsedLabel ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    {item.menuEngineeringLinkedElapsedLabel}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-slate-400">
                                Sem tag vinculada
                              </span>
                            )}
                          </div>
                          <ArrowRight className="hidden h-4 w-4 text-slate-400 sm:block" />
                          <div className="space-y-1">
                            <p className="font-medium text-muted-foreground">
                              Tag da analise
                            </p>
                            <Badge
                              variant="outline"
                              className="border-transparent bg-white"
                              style={{ color: suggestedTag.colorHEX }}
                            >
                              {suggestedTag.title}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
