import prismaClient from "~/lib/prisma/client.server";
import {
  DEFAULT_SERVER_PRESETS,
  parseServerPresets,
} from "../../../shared/mobile/server-presets";

export const MOBILE_SETTINGS_CONTEXT = "mobile";
export const SERVER_PRESETS_SETTING_NAME = "login.servers";

export async function ensureServerPresetsSetting() {
  const existing = await prismaClient.setting.findFirst({
    where: {
      context: MOBILE_SETTINGS_CONTEXT,
      name: SERVER_PRESETS_SETTING_NAME,
    },
    select: { id: true },
  });
  if (!existing) {
    await prismaClient.setting.create({
      data: {
        context: MOBILE_SETTINGS_CONTEXT,
        name: SERVER_PRESETS_SETTING_NAME,
        type: "json",
        value: JSON.stringify(DEFAULT_SERVER_PRESETS, null, 2),
        createdAt: new Date(),
      },
    });
  }
}

export async function readServerPresets() {
  const setting = await prismaClient.setting.findFirst({
    where: {
      context: MOBILE_SETTINGS_CONTEXT,
      name: SERVER_PRESETS_SETTING_NAME,
    },
    orderBy: { createdAt: "desc" },
    select: { value: true },
  });
  if (!setting) return DEFAULT_SERVER_PRESETS;
  try {
    return parseServerPresets(JSON.parse(setting.value));
  } catch {
    return DEFAULT_SERVER_PRESETS;
  }
}
