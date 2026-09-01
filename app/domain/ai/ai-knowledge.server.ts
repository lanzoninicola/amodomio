import prisma from "~/lib/prisma/client.server";
import { getStoreOpeningStatus } from "~/domain/store-opening/store-opening-status.server";

export const AI_KNOWLEDGE_LANGUAGE = "pt-BR";

export async function getAiKnowledgeSnapshot() {
  const [
    profile,
    storeOpening,
    locations,
    deliveryZones,
    cardapio,
    deterministicResponses,
    orderLinkSetting,
  ] = await Promise.all([
    prisma.aiContextProfileVersion.findFirst({
      where: { language: AI_KNOWLEDGE_LANGUAGE, isActive: true },
      orderBy: { version: "desc" },
      select: {
        language: true,
        version: true,
        content: true,
        updatedAt: true,
      },
    }),
    getStoreOpeningStatus(),
    prisma.companyLocation.findMany({
      orderBy: [{ mainLocation: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        phoneNumber: true,
        mainLocation: true,
        updatedAt: true,
      },
    }),
    prisma.deliveryZone.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        zipCode: true,
        updatedAt: true,
        deliveryFees: {
          select: {
            amount: true,
            companyLocationId: true,
            updatedAt: true,
          },
        },
        distances: {
          select: {
            distanceInKm: true,
            estimatedTimeInMin: true,
            companyLocationId: true,
          },
        },
      },
    }),
    prisma.itemSellingChannel.findFirst({
      where: { key: "cardapio" },
      select: {
        key: true,
        name: true,
        ItemSellingChannelItem: {
          where: {
            visible: true,
            Item: { active: true, archivedAt: null },
          },
          orderBy: { sortOrderIndex: "asc" },
          select: {
            sortOrderIndex: true,
            updatedAt: true,
            Item: {
              select: {
                id: true,
                name: true,
                description: true,
                updatedAt: true,
                Category: { select: { name: true } },
                ItemSellingInfo: {
                  select: {
                    baseIngredients: true,
                    ingredients: true,
                    longDescription: true,
                    notesPublic: true,
                    upcoming: true,
                    Category: { select: { name: true } },
                    ItemGroup: { select: { name: true } },
                  },
                },
                ItemVariation: {
                  where: { deletedAt: null },
                  select: {
                    Variation: {
                      select: { kind: true, code: true, name: true },
                    },
                    ItemSellingPriceVariation: {
                      where: {
                        ItemSellingChannel: { key: "cardapio" },
                      },
                      select: { priceAmount: true, updatedAt: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.botAutoResponseRule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        trigger: true,
        isRegex: true,
        response: true,
        priority: true,
        activeFrom: true,
        activeTo: true,
        updatedAt: true,
      },
    }),
    prisma.setting.findFirst({
      where: { context: "cardapio", name: "fazer_pedido.public.url" },
      select: { value: true, updatedAt: true },
    }),
  ]);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    language: AI_KNOWLEDGE_LANGUAGE,
    instructions: profile,
    deterministicResponses,
    structured: {
      storeOpening,
      locations,
      deliveryZones,
      publicLinks: {
        menu: "https://www.amodomio.com.br/cardapio",
        order: orderLinkSetting?.value?.trim() || null,
      },
      cardapio: {
        channel: cardapio ? { key: cardapio.key, name: cardapio.name } : null,
        items: cardapio?.ItemSellingChannelItem ?? [],
      },
    },
  };
}

export async function getAiKnowledgeOverview() {
  const snapshot = await getAiKnowledgeSnapshot();
  const cardapioItems = snapshot.structured.cardapio.items;
  const dates = [
    snapshot.instructions?.updatedAt,
    ...snapshot.structured.locations.map((row) => row.updatedAt),
    ...snapshot.structured.deliveryZones.map((row) => row.updatedAt),
    ...cardapioItems.flatMap((row) => [row.updatedAt, row.Item.updatedAt]),
  ].filter((value): value is Date => value instanceof Date);

  return {
    profileVersion: snapshot.instructions?.version ?? null,
    profileUpdatedAt: snapshot.instructions?.updatedAt ?? null,
    isStoreOpen: snapshot.structured.storeOpening.status.isOpen,
    storeOverride: snapshot.structured.storeOpening.override,
    locationsCount: snapshot.structured.locations.length,
    deliveryZonesCount: snapshot.structured.deliveryZones.length,
    cardapioItemsCount: cardapioItems.length,
    lastStructuredUpdateAt:
      dates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null,
  };
}
