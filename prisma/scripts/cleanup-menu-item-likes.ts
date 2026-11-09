import prismaClient from "~/lib/prisma/client.server";

async function main() {
  const now = new Date().toISOString();

  const result = await prismaClient.menuItemLike.updateMany({
    where: {
      deletedAt: null,
      OR: [{ amount: { lte: 0 } }, { amount: { gt: 1 } }],
    },
    data: { deletedAt: now },
  });

  console.log(`[cleanup-menu-item-likes] soft-deleted ${result.count} rows`);
}

main()
  .catch((error) => {
    console.error("[cleanup-menu-item-likes] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prismaClient.$disconnect());
