import prismaClient from "~/lib/prisma/client.server";

type LegacyMenuItemLikeRow = {
  id: string;
  menuItemId: string | null;
  sessionId: string | null;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  MenuItem: {
    id: string;
    itemId: string | null;
  } | null;
};

async function main() {
  const db = prismaClient as any;

  const legacyRows = (await db.menuItemLike.findMany({
    select: {
      id: true,
      menuItemId: true,
      sessionId: true,
      amount: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      MenuItem: {
        select: {
          id: true,
          itemId: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })) as LegacyMenuItemLikeRow[];

  let migratedRows = 0;
  let updatedRows = 0;
  let skippedWithoutLinkedItem = 0;
  let skippedMissingItem = 0;

  for (const row of legacyRows) {
    const itemId = String(row.MenuItem?.itemId || "").trim();

    if (!itemId) {
      skippedWithoutLinkedItem += 1;
      continue;
    }

    const item = await db.item.findUnique({
      where: { id: itemId },
      select: { id: true },
    });

    if (!item) {
      skippedMissingItem += 1;
      continue;
    }

    const existing = await db.itemLike.findUnique({
      where: { id: row.id },
      select: { id: true },
    });

    if (existing) {
      await db.itemLike.update({
        where: { id: row.id },
        data: {
          itemId,
          sessionId: row.sessionId,
          amount: row.amount,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        },
      });
      updatedRows += 1;
      continue;
    }

    await db.itemLike.create({
      data: {
        id: row.id,
        itemId,
        sessionId: row.sessionId,
        amount: row.amount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    });
    migratedRows += 1;
  }

  console.log(
    JSON.stringify(
      {
        scannedLegacyRows: legacyRows.length,
        migratedRows,
        updatedRows,
        skippedWithoutLinkedItem,
        skippedMissingItem,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[migrate-menu-item-likes-to-item-likes] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prismaClient.$disconnect());
