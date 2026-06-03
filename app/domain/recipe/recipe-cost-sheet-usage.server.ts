export type RecipeCostSheetUsageRow = {
  id: string;
  name: string;
  itemId: string;
  itemName: string;
  isActive: boolean;
  status: string;
  variationCount: number;
  referenceVariationName: string | null;
  referenceCostAmount: number;
  updatedAt: Date;
  sourceLabels: string[];
};

function normalizeSourceLabels(labels: string[]) {
  return Array.from(
    new Set(labels.map((label) => label.trim()).filter(Boolean))
  );
}

async function getRecipeCostSheetRootSources(db: any, recipeId: string) {
  const componentRows = await db.itemCostSheetComponent.findMany({
    where: { type: "recipe", refId: recipeId },
    select: {
      itemCostSheetId: true,
      ItemCostSheet: {
        select: { id: true, baseItemCostSheetId: true },
      },
    },
  });

  const lineRows =
    typeof db.itemCostSheetLine?.findMany === "function"
      ? await db.itemCostSheetLine.findMany({
          where: { type: "recipe", refId: recipeId },
          select: {
            itemCostSheetId: true,
            ItemCostSheet: {
              select: { id: true, baseItemCostSheetId: true },
            },
          },
        })
      : [];

  const variationRows = await db.itemCostSheet.findMany({
    where: { ItemVariation: { is: { recipeId } } },
    select: { id: true, baseItemCostSheetId: true },
  });

  const sourceLabelsByRootId = new Map<string, string[]>();
  const addSource = (sheet: any, label: string) => {
    const rootId = String(
      sheet?.ItemCostSheet?.baseItemCostSheetId ||
        sheet?.ItemCostSheet?.id ||
        sheet?.baseItemCostSheetId ||
        sheet?.id ||
        ""
    ).trim();
    if (!rootId) return;
    sourceLabelsByRootId.set(rootId, [
      ...(sourceLabelsByRootId.get(rootId) || []),
      label,
    ]);
  };

  for (const row of componentRows) addSource(row, "Componente da ficha");
  for (const row of lineRows) addSource(row, "Linha legada");
  for (const row of variationRows) addSource(row, "Variação vinculada");

  return sourceLabelsByRootId;
}

export async function countRecipeCostSheetUsage(db: any, recipeId: string) {
  const sourceLabelsByRootId = await getRecipeCostSheetRootSources(
    db,
    recipeId
  );

  return sourceLabelsByRootId.size;
}

export async function listRecipeCostSheetUsage(
  db: any,
  recipeId: string
): Promise<RecipeCostSheetUsageRow[]> {
  const sourceLabelsByRootId = await getRecipeCostSheetRootSources(
    db,
    recipeId
  );
  const rootSheetIds = Array.from(sourceLabelsByRootId.keys());
  if (rootSheetIds.length === 0) return [];

  const groupSheets = await db.itemCostSheet.findMany({
    where: {
      OR: [
        { id: { in: rootSheetIds } },
        { baseItemCostSheetId: { in: rootSheetIds } },
      ],
    },
    include: {
      Item: { select: { id: true, name: true } },
      ItemVariation: {
        select: {
          id: true,
          isReference: true,
          Variation: { select: { name: true, code: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const groupedByRootId = new Map<string, any[]>();
  for (const sheet of groupSheets) {
    const rootId = String(sheet.baseItemCostSheetId || sheet.id || "");
    if (!rootId) continue;
    if (!groupedByRootId.has(rootId)) groupedByRootId.set(rootId, []);
    groupedByRootId.get(rootId)?.push(sheet);
  }

  return Array.from(groupedByRootId.entries())
    .map(([rootId, sheets]) => {
      const primarySheet =
        sheets.find((sheet) => !sheet.baseItemCostSheetId) ||
        sheets.find((sheet) => sheet.ItemVariation?.isReference) ||
        sheets[0];
      const referenceSheet =
        sheets.find((sheet) => sheet.ItemVariation?.isReference) ||
        primarySheet ||
        sheets[0];
      const latestUpdatedAt = sheets.reduce((latest: Date, sheet: any) => {
        const current = new Date(sheet.updatedAt);
        return current > latest ? current : latest;
      }, new Date(primarySheet?.updatedAt || new Date()));

      return {
        id: String(primarySheet?.id || rootId),
        name: String(primarySheet?.name || "Ficha técnica"),
        itemId: String(primarySheet?.itemId || ""),
        itemName: String(primarySheet?.Item?.name || "Item desconhecido"),
        isActive: sheets.some((sheet) => Boolean(sheet.isActive)),
        status: String(primarySheet?.status || "draft"),
        variationCount: sheets.length,
        referenceVariationName:
          referenceSheet?.ItemVariation?.Variation?.name || null,
        referenceCostAmount: Number(referenceSheet?.costAmount || 0),
        updatedAt: latestUpdatedAt,
        sourceLabels: normalizeSourceLabels(
          sourceLabelsByRootId.get(rootId) || []
        ),
      };
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
