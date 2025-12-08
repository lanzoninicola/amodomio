import prisma from "~/lib/prisma/client.server";
import { defaultSizeCounts, type SizeCounts } from "./types";

const ALLOWED_KEYS: (keyof SizeCounts)[] = ["F", "M", "P", "I", "FT"];

type DoughStockRecord = {
  dateInt: number;
  size: string | null;
};

function parseCounts(value?: string | null): SizeCounts {
  try {
    const raw = value ? JSON.parse(String(value)) : {};
    return {
      ...defaultSizeCounts(),
      F: Number(raw?.F) || 0,
      M: Number(raw?.M) || 0,
      P: Number(raw?.P) || 0,
      I: Number(raw?.I) || 0,
      FT: Number(raw?.FT) || 0,
    };
  } catch (_e) {
    return defaultSizeCounts();
  }
}

export function normalizeCounts(counts: Partial<SizeCounts> | null | undefined): SizeCounts {
  return {
    ...defaultSizeCounts(),
    F: Math.max(0, Number(counts?.F ?? 0) || 0),
    M: Math.max(0, Number(counts?.M ?? 0) || 0),
    P: Math.max(0, Number(counts?.P ?? 0) || 0),
    I: Math.max(0, Number(counts?.I ?? 0) || 0),
    FT: Math.max(0, Number(counts?.FT ?? 0) || 0),
  };
}

export async function getDoughStock(dateInt: number): Promise<SizeCounts | null> {
  const row = await prisma.doughDailyStock.findUnique({
    where: { dateInt },
    select: { size: true },
  });

  if (!row) return null;
  return parseCounts(row.size);
}

export async function saveDoughStock(dateInt: number, date: Date, counts: SizeCounts) {
  const payload = {
    dateInt,
    date,
    size: JSON.stringify(counts),
  };

  await prisma.doughDailyStock.upsert({
    where: { dateInt },
    update: payload,
    create: payload,
  });

  return counts;
}

export type DoughSizeOption = {
  key: keyof SizeCounts;
  label: string;
  abbr: string;
};

function inferKey(name?: string | null, abbr?: string | null): keyof SizeCounts | null {
  const candidate = (abbr || name || "").trim().toUpperCase();
  if (ALLOWED_KEYS.includes(candidate as keyof SizeCounts)) return candidate as keyof SizeCounts;
  return null;
}

export async function getAvailableDoughSizes(): Promise<DoughSizeOption[]> {
  const sizes = await prisma.menuItemSize.findMany({
    where: { visible: true },
    select: { id: true, name: true, nameAbbreviated: true, sortOrderIndex: true },
    orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
  });

  const mapped: DoughSizeOption[] = [];

  for (const s of sizes) {
    const key = inferKey(s.nameAbbreviated, s.name);
    if (!key) continue;
    if (mapped.find((m) => m.key === key)) continue; // evita duplicatas pelo mesmo key

    mapped.push({
      key,
      label: s.name || key,
      abbr: s.nameAbbreviated || key,
    });
  }

  if (mapped.length === 0) {
    return [
      { key: "F", label: "Família", abbr: "F" },
      { key: "M", label: "Média", abbr: "M" },
      { key: "P", label: "Pequena", abbr: "P" },
      { key: "I", label: "Individual", abbr: "I" },
      { key: "FT", label: "Fatia", abbr: "FT" },
    ];
  }

  return mapped;
}

export function projectCounts(counts: SizeCounts, order: DoughSizeOption[]): Array<{ option: DoughSizeOption; value: number }> {
  return order.map((opt) => ({ option: opt, value: counts[opt.key] ?? 0 }));
}
