import prismaClient from "~/lib/prisma/client.server";

const allowedTypes = new Set(["view_list", "open_detail", "like", "share"]);
const DEFAULT_LIKE_COOLDOWN_MS = 1000 * 60 * 60 * 24;

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

export async function hasRecentMenuItemInterestEvent({
  menuItemId,
  type,
  clientId,
  withinMs = DEFAULT_LIKE_COOLDOWN_MS,
}: {
  menuItemId: string;
  type: MenuItemInterestType;
  clientId: string;
  withinMs?: number;
}) {
  const cutoff = new Date(Date.now() - withinMs).toISOString();
  const existing = await prismaClient.menuItemInterestEvent.findFirst({
    where: {
      menuItemId,
      type,
      clientId,
      createdAt: { gte: cutoff },
    },
    select: { id: true },
  });

  return Boolean(existing);
}
