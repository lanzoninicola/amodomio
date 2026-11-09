import prisma from "~/lib/prisma/client.server";

export const WHATSAPP_AGENT_SETTINGS_CONTEXT = "whatsapp-ai-agent";

export const WHATSAPP_AGENT_DEFAULTS = {
  enabled: "false",
  mode: "test",
  testPhone: "",
  provider: "openrouter",
  model: "openrouter/free",
  pollIntervalMs: "2000",
  lockSeconds: "120",
  maxAttempts: "5",
  historyLimit: "8",
  maxJobAgeMinutes: "15",
  businessInstructions: "",
} as const;

export type WhatsappAgentSettingName = keyof typeof WHATSAPP_AGENT_DEFAULTS;

const SETTING_TYPES: Record<WhatsappAgentSettingName, string> = {
  enabled: "boolean",
  mode: "string",
  testPhone: "string",
  provider: "string",
  model: "string",
  pollIntervalMs: "int",
  lockSeconds: "int",
  maxAttempts: "int",
  historyLimit: "int",
  maxJobAgeMinutes: "int",
  businessInstructions: "string",
};

export async function ensureWhatsappAgentSettings() {
  const existing = await prisma.setting.findMany({
    where: { context: WHATSAPP_AGENT_SETTINGS_CONTEXT },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((setting) => setting.name));
  const missing = Object.entries(WHATSAPP_AGENT_DEFAULTS).filter(
    ([name]) => !existingNames.has(name)
  );
  if (!missing.length) return;

  await prisma.setting.createMany({
    data: missing.map(([name, value]) => ({
      context: WHATSAPP_AGENT_SETTINGS_CONTEXT,
      name,
      type: SETTING_TYPES[name as WhatsappAgentSettingName],
      value,
      createdAt: new Date(),
    })),
  });
}

export async function getWhatsappAgentSettings() {
  await ensureWhatsappAgentSettings();
  const rows = await prisma.setting.findMany({
    where: { context: WHATSAPP_AGENT_SETTINGS_CONTEXT },
  });
  const byName = new Map(rows.map((row) => [row.name, row.value]));
  return Object.fromEntries(
    Object.entries(WHATSAPP_AGENT_DEFAULTS).map(([name, fallback]) => [
      name,
      byName.get(name) ?? fallback,
    ])
  ) as Record<WhatsappAgentSettingName, string>;
}

export async function saveWhatsappAgentSettings(
  values: Record<WhatsappAgentSettingName, string>
) {
  await prisma.$transaction(async (tx) => {
    for (const [name, value] of Object.entries(values)) {
      const existing = await tx.setting.findFirst({
        where: { context: WHATSAPP_AGENT_SETTINGS_CONTEXT, name },
        select: { id: true },
      });
      const type = SETTING_TYPES[name as WhatsappAgentSettingName];
      if (existing) {
        await tx.setting.update({
          where: { id: existing.id },
          data: { value, type },
        });
      } else {
        await tx.setting.create({
          data: {
            context: WHATSAPP_AGENT_SETTINGS_CONTEXT,
            name,
            type,
            value,
            createdAt: new Date(),
          },
        });
      }
    }
  });
}
