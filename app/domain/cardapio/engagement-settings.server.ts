import prismaClient from "~/lib/prisma/client.server";
import { parseBooleanSetting } from "~/utils/parse-boolean-setting";

export const ENGAGEMENT_SETTINGS_CONTEXT = "cardapio";
export const LIKE_SETTING_NAME = "engagement.likes.enabled";
export const SHARE_SETTING_NAME = "engagement.shares.enabled";

export async function getEngagementSettings() {
  const settings = await prismaClient.setting.findMany({
    where: {
      context: ENGAGEMENT_SETTINGS_CONTEXT,
      name: { in: [LIKE_SETTING_NAME, SHARE_SETTING_NAME] },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const byName = new Map(settings.map((s) => [s.name, s.value]));
  const likesEnabled = parseBooleanSetting(byName.get(LIKE_SETTING_NAME), true);
  const sharesEnabled = parseBooleanSetting(byName.get(SHARE_SETTING_NAME), true);

  return { likesEnabled, sharesEnabled };
}
