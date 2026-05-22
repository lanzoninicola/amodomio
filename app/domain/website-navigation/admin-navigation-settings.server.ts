import prismaClient from "~/lib/prisma/client.server";

export const ADMIN_NAVIGATION_SETTINGS_CONTEXT = "admin-navigation";
export const ADMIN_NAVIGATION_MENU_LAYOUT_SETTING = "menuLayout";
export const ADMIN_NAVIGATION_MENU_LAYOUTS = ["sidebar", "fullscreen"] as const;

export type AdminNavigationMenuLayout = (typeof ADMIN_NAVIGATION_MENU_LAYOUTS)[number];

export const DEFAULT_ADMIN_NAVIGATION_MENU_LAYOUT: AdminNavigationMenuLayout = "sidebar";

export function normalizeAdminNavigationMenuLayout(
  value?: string | null
): AdminNavigationMenuLayout {
  return value === "fullscreen" ? "fullscreen" : DEFAULT_ADMIN_NAVIGATION_MENU_LAYOUT;
}

export async function getAdminNavigationMenuLayout() {
  const setting = await prismaClient.setting.findFirst({
    where: {
      context: ADMIN_NAVIGATION_SETTINGS_CONTEXT,
      name: ADMIN_NAVIGATION_MENU_LAYOUT_SETTING,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return normalizeAdminNavigationMenuLayout(setting?.value);
}

export async function ensureAdminNavigationMenuLayoutSetting() {
  const existing = await prismaClient.setting.findFirst({
    where: {
      context: ADMIN_NAVIGATION_SETTINGS_CONTEXT,
      name: ADMIN_NAVIGATION_MENU_LAYOUT_SETTING,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (existing) return existing;

  return prismaClient.setting.create({
    data: {
      context: ADMIN_NAVIGATION_SETTINGS_CONTEXT,
      name: ADMIN_NAVIGATION_MENU_LAYOUT_SETTING,
      type: "string",
      value: DEFAULT_ADMIN_NAVIGATION_MENU_LAYOUT,
      createdAt: new Date(),
    },
  });
}

export async function saveAdminNavigationMenuLayout(value: string) {
  const menuLayout = normalizeAdminNavigationMenuLayout(value);
  const existing = await ensureAdminNavigationMenuLayoutSetting();

  return prismaClient.setting.update({
    where: { id: existing.id },
    data: {
      type: "string",
      value: menuLayout,
    },
  });
}
