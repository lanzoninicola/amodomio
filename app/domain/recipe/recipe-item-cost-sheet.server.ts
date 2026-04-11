import { recalcItemCostSheetTotals } from "~/domain/costs/item-cost-sheet-recalc.server";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import createUUID from "~/utils/uuid";

function calcItemCostSheetTotalCostAmount(
  unitCostAmount: number,
  quantity: number,
  wastePerc: number
) {
  const baseAmount = Number(unitCostAmount || 0) * Number(quantity || 0);
  const wasteFactor = 1 + Number(wastePerc || 0) / 100;
  return Number(Number(baseAmount * wasteFactor).toFixed(6));
}

export async function ensureSingleItemCostSheetGroup(db: any, itemId: string) {
  const sheets = await db.itemCostSheet.findMany({
    where: { itemId },
    select: {
      id: true,
      baseItemCostSheetId: true,
      itemVariationId: true,
      name: true,
      createdAt: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const rootIds = Array.from(
    new Set(
      sheets
        .map((sheet: any) => String(sheet.baseItemCostSheetId || sheet.id || "").trim())
        .filter(Boolean)
    )
  );

  if (rootIds.length > 1) {
    throw new Error(
      "Este item já possui mais de uma ficha técnica. Use o módulo de fichas para escolher manualmente."
    );
  }

  return rootIds[0] || null;
}

export async function ensureItemCostSheetForRecipe(params: {
  db: any;
  item: { id: string; name: string };
  recipe: { id: string; name: string };
  sheetName?: string | null;
  sheetDescription?: string | null;
  componentNotes?: string | null;
}) {
  const {
    db,
    item,
    recipe,
    sheetName,
    sheetDescription,
    componentNotes,
  } = params;

  let rootSheetId = await ensureSingleItemCostSheetGroup(db, item.id);

  if (!rootSheetId) {
    const itemVariations = await itemVariationPrismaEntity.findManyByItemId(item.id);
    const primaryVariation =
      await itemVariationPrismaEntity.findPrimaryVariationForItem(item.id, {
        ensureBaseIfMissing: true,
      });
    const targetVariations =
      itemVariations.length > 0
        ? itemVariations
        : primaryVariation
          ? [primaryVariation]
          : [];

    if (targetVariations.length === 0) {
      throw new Error("Nenhuma variação disponível para criar a ficha técnica");
    }

    const primaryTargetVariation =
      targetVariations.find((variation: any) => variation.id === primaryVariation?.id) ||
      targetVariations[0];

    const latestVersions = await db.itemCostSheet.findMany({
      where: {
        itemId: item.id,
        itemVariationId: { in: targetVariations.map((variation: any) => variation.id) },
      },
      select: { version: true },
      orderBy: [{ version: "desc" }],
    });
    const nextVersion =
      Number(
        latestVersions.reduce(
          (max: number, row: any) => Math.max(max, Number(row?.version || 0)),
          0
        )
      ) + 1;

    rootSheetId = createUUID();
    const orderedVariations = [
      primaryTargetVariation,
      ...targetVariations.filter(
        (variation: any) => variation.id !== primaryTargetVariation?.id
      ),
    ].filter(Boolean);

    for (const itemVariation of orderedVariations) {
      const isRoot = itemVariation.id === primaryTargetVariation.id;
      await db.itemCostSheet.create({
        data: {
          id: isRoot ? rootSheetId : createUUID(),
          itemId: item.id,
          itemVariationId: itemVariation.id,
          name: sheetName || `Ficha tecnica ${item.name}`,
          description:
            sheetDescription || `Ficha tecnica gerada a partir da receita ${recipe.name}`,
          version: nextVersion,
          status: "draft",
          isActive: false,
          baseItemCostSheetId: isRoot ? null : rootSheetId,
        },
      });
    }
  }

  const groupSheets = await db.itemCostSheet.findMany({
    where: { OR: [{ id: rootSheetId }, { baseItemCostSheetId: rootSheetId }] },
    select: { id: true, itemVariationId: true },
    orderBy: [{ createdAt: "asc" }],
  });
  const targetItemVariationIds = groupSheets
    .map((sheet: any) => String(sheet.itemVariationId || ""))
    .filter(Boolean);

  const existingComponent = await db.itemCostSheetComponent.findFirst({
    where: {
      itemCostSheetId: rootSheetId,
      type: "recipe",
      refId: recipe.id,
    },
    select: { id: true },
  });

  if (!existingComponent) {
    await db.itemCostSheetComponent.create({
      data: {
        itemCostSheetId: rootSheetId,
        type: "recipe",
        refId: recipe.id,
        name: recipe.name,
        notes:
          componentNotes ||
          "Componente de producao referenciado automaticamente pela receita",
        sortOrderIndex: Number(
          await db.itemCostSheetComponent.count({
            where: { itemCostSheetId: rootSheetId },
          })
        ),
        ItemCostSheetVariationComponent: {
          create: targetItemVariationIds.map((itemVariationId: string) => ({
            itemVariationId,
            unit: "receita",
            quantity: 1,
            unitCostAmount: 0,
            wastePerc: 0,
            totalCostAmount: calcItemCostSheetTotalCostAmount(0, 1, 0),
          })),
        },
      },
    });
  }

  await recalcItemCostSheetTotals(db, rootSheetId);

  return { rootSheetId };
}
