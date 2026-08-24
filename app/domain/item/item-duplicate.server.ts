import { randomUUID } from "node:crypto";
import { recalcItemCostSheetTotals } from "~/domain/costs/item-cost-sheet-recalc.server";
import { buildUniqueItemSellingSlug } from "./item-selling-slug.server";

export type DuplicateItemOptions = {
  name: string;
  duplicateRecipe: boolean;
  duplicateCostSheet: boolean;
};

function normalizedName(value: unknown) {
  return String(value || "").trim();
}

export async function duplicateItemWithLinkedRecords(
  db: any,
  sourceItemId: string,
  options: DuplicateItemOptions
) {
  const newName = normalizedName(options.name);
  if (!newName) throw new Error("Informe o nome do novo item");

  const source = await db.item.findUnique({
    where: { id: sourceItemId },
    include: {
      ItemVariation: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }],
      },
      ItemSellingInfo: true,
      Recipe: {
        include: {
          RecipePreheating: true,
          RecipeBaking: true,
          PendingIngredient: true,
          RecipeIngredient: {
            include: { RecipeVariationIngredient: true },
            orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      ItemCostSheet: {
        include: {
          ItemCostSheetLine: true,
          ItemCostSheetComponent: {
            include: { ItemCostSheetVariationComponent: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!source) throw new Error("Item original não encontrado");
  if (
    newName.localeCompare(normalizedName(source.name), undefined, {
      sensitivity: "base",
    }) === 0
  ) {
    throw new Error("O novo item deve ter um nome diferente do item original");
  }

  const sellingSlug = source.ItemSellingInfo
    ? await buildUniqueItemSellingSlug(db, newName)
    : null;

  return db.$transaction(
    async (tx: any) => {
      const duplicatedItem = await tx.item.create({
        data: {
          id: randomUUID(),
          name: newName,
          description: source.description,
          classification: source.classification,
          recipeVariationPolicy: source.recipeVariationPolicy,
          categoryId: source.categoryId,
          purchaseUm: source.purchaseUm,
          consumptionUm: source.consumptionUm,
          purchaseToConsumptionFactor: source.purchaseToConsumptionFactor,
          active: source.active,
          canPurchase: source.canPurchase,
          canTransform: source.canTransform,
          canSell: source.canSell,
          canStock: source.canStock,
          ...(source.ItemSellingInfo
            ? {
                ItemSellingInfo: {
                  create: {
                    baseIngredients: source.ItemSellingInfo.baseIngredients,
                    ingredients: source.ItemSellingInfo.ingredients,
                    longDescription: source.ItemSellingInfo.longDescription,
                    categoryId: source.ItemSellingInfo.categoryId,
                    itemGroupId: source.ItemSellingInfo.itemGroupId,
                    notesPublic: source.ItemSellingInfo.notesPublic,
                    slug: sellingSlug,
                    upcoming: source.ItemSellingInfo.upcoming,
                  },
                },
              }
            : {}),
        },
        select: { id: true, name: true },
      });

      const variationIdMap = new Map<string, string>();
      for (const variation of source.ItemVariation || []) {
        const duplicatedVariation = await tx.itemVariation.create({
          data: {
            id: randomUUID(),
            itemId: duplicatedItem.id,
            variationId: variation.variationId,
            isReference: Boolean(variation.isReference),
          },
          select: { id: true },
        });
        variationIdMap.set(variation.id, duplicatedVariation.id);
      }

      const recipeIdMap = new Map<string, string>();
      if (options.duplicateRecipe) {
        for (const recipe of source.Recipe || []) {
          const duplicatedRecipe = await tx.recipe.create({
            data: {
              id: randomUUID(),
              name:
                recipe.name === source.name
                  ? newName
                  : `${recipe.name} (${newName})`,
              itemId: duplicatedItem.id,
              variationId: recipe.variationId,
              type: recipe.type,
              costingMode: recipe.costingMode,
              yieldQuantity: recipe.yieldQuantity,
              yieldUnit: recipe.yieldUnit,
              description: recipe.description,
              productionProcedure: recipe.productionProcedure,
              productionNotes: recipe.productionNotes,
              hasVariations: recipe.hasVariations,
              isVegetarian: recipe.isVegetarian,
              isGlutenFree: recipe.isGlutenFree,
            },
            select: { id: true },
          });
          recipeIdMap.set(recipe.id, duplicatedRecipe.id);

          if (recipe.RecipePreheating) {
            const {
              upperTemperatureCelsius,
              lowerTemperatureCelsius,
              durationMinutes,
              notes,
            } = recipe.RecipePreheating;
            await tx.recipePreheating.create({
              data: {
                recipeId: duplicatedRecipe.id,
                upperTemperatureCelsius,
                lowerTemperatureCelsius,
                durationMinutes,
                notes,
              },
            });
          }
          if (recipe.RecipeBaking) {
            const {
              upperTemperatureCelsius,
              lowerTemperatureCelsius,
              durationMinutes,
              notes,
            } = recipe.RecipeBaking;
            await tx.recipeBaking.create({
              data: {
                recipeId: duplicatedRecipe.id,
                upperTemperatureCelsius,
                lowerTemperatureCelsius,
                durationMinutes,
                notes,
              },
            });
          }
          if (recipe.PendingIngredient?.length) {
            await tx.recipePendingIngredient.createMany({
              data: recipe.PendingIngredient.map((row: any) => ({
                recipeId: duplicatedRecipe.id,
                name: row.name,
                normalizedName: row.normalizedName,
                section: row.section,
                status: row.status,
              })),
            });
          }

          for (const ingredient of recipe.RecipeIngredient || []) {
            const duplicatedIngredient = await tx.recipeIngredient.create({
              data: {
                id: randomUUID(),
                recipeId: duplicatedRecipe.id,
                ingredientItemId: ingredient.ingredientItemId,
                defaultLossPct: ingredient.defaultLossPct,
                sortOrderIndex: ingredient.sortOrderIndex,
                notes: ingredient.notes,
              },
              select: { id: true },
            });
            const variationRows = (ingredient.RecipeVariationIngredient || [])
              .map((row: any) => ({
                recipeIngredientId: duplicatedIngredient.id,
                itemVariationId: variationIdMap.get(row.itemVariationId),
                unit: row.unit,
                quantity: row.quantity,
                lossPct: row.lossPct,
              }))
              .filter((row: any) => Boolean(row.itemVariationId));
            if (variationRows.length) {
              await tx.recipeVariationIngredient.createMany({
                data: variationRows,
              });
            }
          }
        }

        for (const variation of source.ItemVariation || []) {
          const newVariationId = variationIdMap.get(variation.id);
          const newRecipeId = variation.recipeId
            ? recipeIdMap.get(variation.recipeId)
            : null;
          if (newVariationId && newRecipeId) {
            await tx.itemVariation.update({
              where: { id: newVariationId },
              data: { recipeId: newRecipeId },
            });
          }
        }
      }

      if (options.duplicateCostSheet && source.ItemCostSheet?.length) {
        const latestSheet = source.ItemCostSheet[0];
        const sourceRootId = latestSheet.baseItemCostSheetId || latestSheet.id;
        const sourceGroup = source.ItemCostSheet.filter(
          (sheet: any) =>
            sheet.id === sourceRootId ||
            sheet.baseItemCostSheetId === sourceRootId
        );
        const sourceRoot = sourceGroup.find(
          (sheet: any) => sheet.id === sourceRootId
        );
        if (sourceRoot) {
          const orderedSourceGroup = [
            sourceRoot,
            ...sourceGroup.filter((sheet: any) => sheet.id !== sourceRootId),
          ];
          const newRootId = randomUUID();
          const sheetIdMap = new Map<string, string>();
          const now = new Date();
          for (const sheet of orderedSourceGroup) {
            const newItemVariationId = variationIdMap.get(
              sheet.itemVariationId
            );
            if (!newItemVariationId) continue;
            const newSheetId =
              sheet.id === sourceRootId ? newRootId : randomUUID();
            sheetIdMap.set(sheet.id, newSheetId);
            await tx.itemCostSheet.create({
              data: {
                id: newSheetId,
                name: sheet.name === source.name ? newName : sheet.name,
                description: sheet.description,
                itemId: duplicatedItem.id,
                itemVariationId: newItemVariationId,
                version: 1,
                status: "active",
                isActive: true,
                baseItemCostSheetId:
                  sheet.id === sourceRootId ? null : newRootId,
                costAmount: sheet.costAmount,
                notes: sheet.notes,
                activatedAt: now,
                createdBy: sheet.createdBy,
                updatedBy: sheet.updatedBy,
              },
            });
          }

          for (const sheet of orderedSourceGroup) {
            const newSheetId = sheetIdMap.get(sheet.id);
            if (!newSheetId) continue;
            if (sheet.ItemCostSheetLine?.length) {
              await tx.itemCostSheetLine.createMany({
                data: sheet.ItemCostSheetLine.map((line: any) => ({
                  itemCostSheetId: newSheetId,
                  type: line.type,
                  refId: recipeIdMap.get(line.refId) || line.refId,
                  name: line.name,
                  unit: line.unit,
                  quantity: line.quantity,
                  unitCostAmount: line.unitCostAmount,
                  wastePerc: line.wastePerc,
                  totalCostAmount: line.totalCostAmount,
                  sortOrderIndex: line.sortOrderIndex,
                  notes: line.notes,
                })),
              });
            }
            for (const component of sheet.ItemCostSheetComponent || []) {
              const newComponent = await tx.itemCostSheetComponent.create({
                data: {
                  id: randomUUID(),
                  itemCostSheetId: newSheetId,
                  type: component.type,
                  refId: recipeIdMap.get(component.refId) || component.refId,
                  presetId: component.presetId,
                  name: component.name,
                  notes: component.notes,
                  sortOrderIndex: component.sortOrderIndex,
                },
                select: { id: true },
              });
              const values = (component.ItemCostSheetVariationComponent || [])
                .map((value: any) => ({
                  itemCostSheetComponentId: newComponent.id,
                  itemVariationId: variationIdMap.get(value.itemVariationId),
                  unit: value.unit,
                  quantity: value.quantity,
                  unitCostAmount: value.unitCostAmount,
                  wastePerc: value.wastePerc,
                  totalCostAmount: value.totalCostAmount,
                }))
                .filter((value: any) => Boolean(value.itemVariationId));
              if (values.length) {
                await tx.itemCostSheetVariationComponent.createMany({
                  data: values,
                });
              }
            }
          }

          await recalcItemCostSheetTotals(tx, newRootId);
        }
      }

      return duplicatedItem;
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    }
  );
}
