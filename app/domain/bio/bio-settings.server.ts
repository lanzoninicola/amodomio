import prismaClient from "~/lib/prisma/client.server";

export const BIO_SETTINGS_CONTEXT = "bio";
export const BIO_HEADLINE_SETTING_NAME = "headline";
export const BIO_DESCRIPTION_SETTING_NAME = "description";
export const DEFAULT_BIO_HEADLINE = "É a pizza! Italiana!";
export const DEFAULT_BIO_DESCRIPTION =
  "Pizza italiana com personalidade, feita em Pato Branco.";

export type BioSettings = { headline: string; description: string };

const definitions = [
  { name: BIO_HEADLINE_SETTING_NAME, value: DEFAULT_BIO_HEADLINE },
  { name: BIO_DESCRIPTION_SETTING_NAME, value: DEFAULT_BIO_DESCRIPTION },
] as const;

export async function ensureBioSettings() {
  const existing = await prismaClient.setting.findMany({
    where: {
      context: BIO_SETTINGS_CONTEXT,
      name: { in: definitions.map((definition) => definition.name) },
    },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((setting) => setting.name));

  await Promise.all(
    definitions
      .filter((definition) => !existingNames.has(definition.name))
      .map((definition) =>
        prismaClient.setting.create({
          data: {
            context: BIO_SETTINGS_CONTEXT,
            name: definition.name,
            type: "string",
            value: definition.value,
            createdAt: new Date(),
          },
        })
      )
  );
}

export async function readBioSettings(): Promise<BioSettings> {
  const settings = await prismaClient.setting.findMany({
    where: {
      context: BIO_SETTINGS_CONTEXT,
      name: { in: definitions.map((definition) => definition.name) },
    },
    select: { name: true, value: true },
    orderBy: { createdAt: "desc" },
  });
  const valueByName = new Map<string, string>();

  for (const setting of settings) {
    if (!valueByName.has(setting.name) && setting.value?.trim()) {
      valueByName.set(setting.name, setting.value.trim());
    }
  }

  return {
    headline:
      valueByName.get(BIO_HEADLINE_SETTING_NAME) || DEFAULT_BIO_HEADLINE,
    description:
      valueByName.get(BIO_DESCRIPTION_SETTING_NAME) || DEFAULT_BIO_DESCRIPTION,
  };
}

export async function saveBioSettings(settings: BioSettings) {
  const values = [
    { name: BIO_HEADLINE_SETTING_NAME, value: settings.headline },
    { name: BIO_DESCRIPTION_SETTING_NAME, value: settings.description },
  ];

  await prismaClient.$transaction(async (transaction) => {
    for (const value of values) {
      const existing = await transaction.setting.findFirst({
        where: { context: BIO_SETTINGS_CONTEXT, name: value.name },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (existing) {
        await transaction.setting.update({
          where: { id: existing.id },
          data: { type: "string", value: value.value },
        });
      } else {
        await transaction.setting.create({
          data: {
            context: BIO_SETTINGS_CONTEXT,
            name: value.name,
            type: "string",
            value: value.value,
            createdAt: new Date(),
          },
        });
      }
    }
  });
}
