import prismaClient from "~/lib/prisma/client.server";

export async function findPrimaryLegacyMenuItemBridge(itemId: string) {
  return prismaClient.menuItem.findFirst({
    where: {
      itemId,
      deletedAt: null,
    },
    orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    select: {
      id: true,
      itemId: true,
      name: true,
      active: true,
      visible: true,
      sortOrderIndex: true,
      ingredients: true,
      description: true,
      longDescription: true,
      notesPublic: true,
      categoryId: true,
      menuItemGroupId: true,
      Category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      MenuItemGroup: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
    },
  });
}
