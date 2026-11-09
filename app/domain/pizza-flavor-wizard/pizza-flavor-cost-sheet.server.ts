import type { ItemCostSheetSupplementalComponent } from "~/domain/recipe/recipe-item-cost-sheet.server";

function normalizeRecipeType(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function isPizzaFlavorRecipe(recipe: { type?: string | null }) {
  return normalizeRecipeType(recipe.type) === "pizzatopping";
}

export function isPizzaFlavorCategory(category: { name?: string | null }) {
  return normalizeRecipeType(category.name) === "saborpizza";
}

export async function loadPizzaFlavorCostSheetDefaults(
  db: any
): Promise<ItemCostSheetSupplementalComponent[]> {
  const [baseRecipe, packagingItem] = await Promise.all([
    db.recipe.findFirst({
      where: {
        status: "active",
        OR: [
          {
            name: {
              equals: "Receita Base de pizza romana",
              mode: "insensitive",
            },
          },
          {
            Item: {
              is: { name: { equals: "Base de pizza", mode: "insensitive" } },
            },
          },
        ],
      },
      select: { id: true, name: true },
      orderBy: [{ updatedAt: "desc" }],
    }),
    db.item.findFirst({
      where: {
        active: true,
        classification: "embalagem",
        name: { equals: "Caixa de pizza", mode: "insensitive" },
      },
      select: { id: true, name: true, consumptionUm: true, purchaseUm: true },
    }),
  ]);

  if (!baseRecipe) {
    throw new Error("A receita base ativa da pizza não foi encontrada");
  }
  if (!packagingItem) {
    throw new Error("O item ativo Caixa de pizza não foi encontrado");
  }

  return [
    {
      type: "recipe",
      refId: baseRecipe.id,
      name: baseRecipe.name,
      unit: "receita",
      quantity: 1,
      notes: "Massa base adicionada automaticamente para sabor de pizza",
    },
    {
      type: "item",
      refId: packagingItem.id,
      name: packagingItem.name,
      unit: packagingItem.consumptionUm || packagingItem.purchaseUm || "UN",
      quantity: 1,
      notes: "Embalagem adicionada automaticamente para sabor de pizza",
    },
  ];
}
