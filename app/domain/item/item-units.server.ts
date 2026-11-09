import prismaClient from "~/lib/prisma/client.server";
import { ITEM_UNIT_OPTIONS, normalizeItemUnit } from "~/domain/item/item-units";

export async function getAllActiveMeasurementUnits(): Promise<string[]> {
  const db = prismaClient as any;
  const staticUnits = ITEM_UNIT_OPTIONS;

  if (typeof db.measurementUnit?.findMany !== "function") {
    return [...staticUnits].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  try {
    const rows = await db.measurementUnit.findMany({
      where: { active: true },
      select: { code: true },
      orderBy: [{ code: "asc" }],
    }) as Array<{ code: string }>;

    const merged = new Set<string>(staticUnits);
    for (const row of rows) {
      const code = normalizeItemUnit(row.code);
      if (code) merged.add(code);
    }

    return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
  } catch (_error) {
    return [...staticUnits].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
}

/**
 * Returns the list of unit codes available for a given item.
 * - Units with scope "global" are always included.
 * - Units with scope "restricted" are only included if the item has an explicit ItemUnit link.
 * - If itemId is not provided, only global units are returned (used in general contexts).
 */
export async function getAvailableItemUnits(itemId?: string): Promise<string[]> {
  const db = prismaClient as any;
  const staticUnits = ITEM_UNIT_OPTIONS;

  if (typeof db.measurementUnit?.findMany !== "function") {
    return [...staticUnits].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  try {
    const [globalUnits, restrictedLinkedCodes] = await Promise.all([
      db.measurementUnit.findMany({
        where: { active: true, scope: "global" },
        select: { code: true },
        orderBy: [{ code: "asc" }],
      }) as Promise<Array<{ code: string }>>,
      itemId && typeof db.itemUnit?.findMany === "function"
        ? db.itemUnit.findMany({
            where: { itemId },
            select: { unitCode: true },
          }).then((rows: Array<{ unitCode: string }>) => rows.map((r) => r.unitCode))
        : Promise.resolve([] as string[]),
    ]);

    const merged = new Set<string>(staticUnits);
    for (const row of globalUnits) {
      const code = normalizeItemUnit(row.code);
      if (code) merged.add(code);
    }
    for (const code of restrictedLinkedCodes) {
      const normalized = normalizeItemUnit(code);
      if (normalized) merged.add(normalized);
    }

    return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
  } catch (_error) {
    return [...staticUnits].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
}
