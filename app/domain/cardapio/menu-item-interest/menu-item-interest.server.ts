import prismaClient from "~/lib/prisma/client.server";

const allowedTypes = new Set(["view_list", "open_detail", "like", "share"]);

export type MenuItemInterestType = "view_list" | "open_detail" | "like" | "share";

export const isAllowedMenuItemInterestType = (
  value: string | null
): value is MenuItemInterestType => {
  if (!value) return false;
  return allowedTypes.has(value);
};

export async function createMenuItemInterestEvent({
  menuItemId,
  type,
  clientId,
}: {
  menuItemId: string;
  type: MenuItemInterestType;
  clientId?: string | null;
}) {
  return prismaClient.menuItemInterestEvent.create({
    data: {
      menuItemId,
      type,
      clientId: clientId || null,
      createdAt: new Date().toISOString(),
    },
  });
}
