import prismaClient from "~/lib/prisma/client.server";
import { slugifyString } from "~/utils/slugify";

export async function runBackfillLegacySellingInfoToItems() {
  const db = prismaClient as any;

  const legacyRows = await db.menuItem.findMany({
    where: {
      deletedAt: null,
      itemId: { not: null },
    },
    select: {
      id: true,
      itemId: true,
      ingredients: true,
      longDescription: true,
      notesPublic: true,
      categoryId: true,
      menuItemGroupId: true,
      slug: true,
      upcoming: true,
      sortOrderIndex: true,
      name: true,
    },
    orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
  });

  const rowByItemId = new Map<string, (typeof legacyRows)[number]>();
  let duplicateRows = 0;

  for (const row of legacyRows || []) {
    const itemId = String(row.itemId || "").trim();
    if (!itemId) continue;

    if (rowByItemId.has(itemId)) {
      duplicateRows += 1;
      continue;
    }

    rowByItemId.set(itemId, row);
  }

  let migratedRows = 0;
  let skippedRows = 0;

  for (const [itemId, row] of rowByItemId.entries()) {
    const [item, category, group] = await Promise.all([
      db.item.findUnique({
        where: { id: itemId },
        select: { id: true },
      }),
      row.categoryId
        ? db.category.findFirst({
            where: { id: row.categoryId, type: "menu" },
            select: { id: true },
          })
        : Promise.resolve(null),
      row.menuItemGroupId
        ? db.menuItemGroup.findFirst({
            where: { id: row.menuItemGroupId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!item || !category) {
      skippedRows += 1;
      continue;
    }

    await db.itemSellingInfo.upsert({
      where: { itemId },
      update: {
        ingredients: row.ingredients || null,
        longDescription: row.longDescription || null,
        notesPublic: row.notesPublic || null,
        categoryId: category.id,
        menuItemGroupId: group?.id || null,
        slug: row.slug || slugifyString(row.name),
        upcoming: Boolean(row.upcoming),
      },
      create: {
        itemId,
        ingredients: row.ingredients || null,
        longDescription: row.longDescription || null,
        notesPublic: row.notesPublic || null,
        categoryId: category.id,
        menuItemGroupId: group?.id || null,
        slug: row.slug || slugifyString(row.name),
        upcoming: Boolean(row.upcoming),
      },
    });

    migratedRows += 1;
  }

  return {
    scannedLegacyRows: legacyRows.length,
    distinctItems: rowByItemId.size,
    migratedRows,
    skippedRows,
    duplicateRows,
  };
}
