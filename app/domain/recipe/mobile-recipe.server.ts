import prismaClient from "~/lib/prisma/client.server";

export async function getMobileRecipe(recipeId: string) {
  if (!recipeId) throw new Response("Receita inválida", { status: 400 });

  const db = prismaClient as any;
  const [recipe, measurementUnits, measurementConversions] = await Promise.all([
    db.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        name: true,
        description: true,
        costingMode: true,
        yieldQuantity: true,
        yieldUnit: true,
        productionProcedure: true,
        productionNotes: true,
        RecipePreheating: {
          select: {
            upperTemperatureCelsius: true,
            lowerTemperatureCelsius: true,
            durationMinutes: true,
            notes: true,
          },
        },
        RecipeBaking: {
          select: {
            upperTemperatureCelsius: true,
            lowerTemperatureCelsius: true,
            durationMinutes: true,
            notes: true,
          },
        },
        ItemVariations: {
          where: { deletedAt: null },
          select: { id: true, isReference: true, createdAt: true },
          orderBy: [{ createdAt: "asc" }],
        },
        RecipeIngredient: {
          orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            notes: true,
            mobileDisplayUnit: true,
            IngredientItem: {
              select: {
                name: true,
                consumptionUm: true,
                ItemUnit: { select: { unitCode: true } },
                Recipe: {
                  select: { id: true, name: true },
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                },
              },
            },
            RecipeVariationIngredient: {
              select: {
                itemVariationId: true,
                quantity: true,
                unit: true,
              },
            },
          },
        },
      },
    }),
    db.measurementUnit.findMany({
      where: { active: true },
      select: { code: true, scope: true },
    }),
    db.measurementUnitConversion.findMany({
      where: { active: true },
      select: {
        factor: true,
        FromUnit: { select: { code: true } },
        ToUnit: { select: { code: true } },
      },
    }),
  ]);

  if (!recipe) throw new Response("Receita não encontrada", { status: 404 });

  const referenceVariation =
    recipe.ItemVariations.find((variation) => variation.isReference) ||
    recipe.ItemVariations[0];
  const ingredients = recipe.RecipeIngredient.map((ingredient) => {
    const lines = ingredient.RecipeVariationIngredient;
    const line =
      lines.find((entry) => entry.itemVariationId === referenceVariation?.id) ||
      lines[0];
    const sourceUnit = String(line?.unit || "UN").toUpperCase();
    const linkedUnits = new Set(
      ingredient.IngredientItem.ItemUnit.map((entry) =>
        String(entry.unitCode || "").toUpperCase()
      )
    );
    const allowedUnits = new Set<string>([
      sourceUnit,
      String(ingredient.IngredientItem.consumptionUm || "").toUpperCase(),
      ...measurementUnits
        .filter(
          (unit) =>
            unit.scope === "global" ||
            linkedUnits.has(String(unit.code || "").toUpperCase())
        )
        .map((unit) => String(unit.code || "").toUpperCase()),
    ]);
    const displayUnits = [{ unit: sourceUnit, factor: 1 }];

    for (const conversion of measurementConversions) {
      const fromUnit = String(conversion.FromUnit?.code || "").toUpperCase();
      const toUnit = String(conversion.ToUnit?.code || "").toUpperCase();
      const factor = Number(conversion.factor);
      if (!(factor > 0)) continue;

      if (fromUnit === sourceUnit && allowedUnits.has(toUnit)) {
        displayUnits.push({ unit: toUnit, factor });
      } else if (toUnit === sourceUnit && allowedUnits.has(fromUnit)) {
        displayUnits.push({ unit: fromUnit, factor: 1 / factor });
      }
    }

    return {
      id: ingredient.id,
      name: ingredient.IngredientItem.name,
      quantity: line?.quantity ?? 0,
      unit: sourceUnit,
      preferredUnit: displayUnits.some(
        (entry) => entry.unit === ingredient.mobileDisplayUnit
      )
        ? (ingredient.mobileDisplayUnit as string)
        : null,
      notes: ingredient.notes,
      subRecipe: ingredient.IngredientItem.Recipe[0] || null,
      displayUnits: Array.from(
        new Map(displayUnits.map((entry) => [entry.unit, entry])).values()
      ),
    };
  });

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    costingMode: recipe.costingMode,
    yieldQuantity: recipe.yieldQuantity,
    yieldUnit: recipe.yieldUnit,
    productionProcedure: recipe.productionProcedure,
    productionNotes: recipe.productionNotes,
    preheating: recipe.RecipePreheating,
    baking: recipe.RecipeBaking,
    ingredients,
  };
}
