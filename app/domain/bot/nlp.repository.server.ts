// /app/domain/bot/nlp.repository.server.ts

import prismaClient from "~/lib/prisma/client.server";

export const NlpRepo = {
  // intents
  listIntents: () =>
    prismaClient.nlpIntent.findMany({
      include: { utterances: true },
      orderBy: { updatedAt: "desc" },
    }),

  getIntent: (id: string) =>
    prismaClient.nlpIntent.findUnique({
      where: { id },
      include: { utterances: true },
    }),

  createIntent: (data: { name: string; label: string; description?: string }) =>
    prismaClient.nlpIntent.create({ data }),

  updateIntent: (id: string, data: any) =>
    prismaClient.nlpIntent.update({ where: { id }, data }),

  deleteIntent: (id: string) =>
    prismaClient.nlpIntent.delete({ where: { id } }),

  // utterances
  addUtterance: (intentId: string, text: string, language = "pt") =>
    prismaClient.nlpUtterance.create({ data: { text, language, intentId } }),

  removeUtterance: (id: string) =>
    prismaClient.nlpUtterance.delete({ where: { id } }),

  // entities
  listEntities: () =>
    prismaClient.nlpEntity.findMany({ include: { examples: true } }),

  createEntity: (data: { name: string; label: string; description?: string }) =>
    prismaClient.nlpEntity.create({ data }),

  addEntityExample: (entityId: string, value: string, synonyms: string[]) =>
    prismaClient.nlpEntityExample.create({
      data: { entityId, value, synonyms },
    }),

  // models
  createModelVersion: (artifact: any, label?: string, language = "pt") =>
    prismaClient.nlpModel.create({
      data: { artifact, label, language, version: BigInt(Date.now()) },
    }),

  getActiveModel: () =>
    prismaClient.nlpModel.findFirst({
      where: { isActive: true },
      orderBy: { trainedAt: "desc" },
    }),

  activateModel: async (id: string) => {
    await prismaClient.nlpModel.updateMany({
      data: { isActive: false },
      where: { isActive: true },
    });
    return prismaClient.nlpModel.update({
      where: { id },
      data: { isActive: true },
    });
  },
};
