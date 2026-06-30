export type RecipeLink = {
  id: string;
  name: string;
  type: string;
};

export async function countRecipeLinks(
  db: any,
  recipeId: string,
  itemId: string | null
): Promise<number> {
  const [ingredientRows, parentCount] = await Promise.all([
    db.recipeIngredient.findMany({
      where: { recipeId },
      select: { ingredientItemId: true },
    }),
    itemId
      ? db.recipeIngredient.count({ where: { ingredientItemId: itemId } })
      : Promise.resolve(0),
  ]);

  const ingredientItemIds = ingredientRows.map((r: any) => r.ingredientItemId);
  const subCount =
    ingredientItemIds.length > 0
      ? await db.recipe.count({ where: { itemId: { in: ingredientItemIds } } })
      : 0;

  return subCount + (parentCount as number);
}

export async function countSubRecipes(db: any, recipeId: string): Promise<number> {
  const ingredientRows = await db.recipeIngredient.findMany({
    where: { recipeId },
    select: { ingredientItemId: true },
  });
  const ingredientItemIds = ingredientRows.map((r: any) => r.ingredientItemId);
  if (ingredientItemIds.length === 0) return 0;
  return db.recipe.count({ where: { itemId: { in: ingredientItemIds } } });
}

export async function countParentRecipes(
  db: any,
  itemId: string | null
): Promise<number> {
  if (!itemId) return 0;
  return db.recipeIngredient.count({ where: { ingredientItemId: itemId } });
}

export async function listSubRecipes(db: any, recipeId: string): Promise<RecipeLink[]> {
  const ingredientRows = await db.recipeIngredient.findMany({
    where: { recipeId },
    select: {
      IngredientItem: {
        select: {
          Recipe: {
            select: { id: true, name: true, type: true },
            orderBy: { updatedAt: "desc" as const },
            take: 1,
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const result: RecipeLink[] = [];
  for (const row of ingredientRows) {
    const recipes = row.IngredientItem?.Recipe;
    if (!recipes || recipes.length === 0) continue;
    const r = recipes[0];
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    result.push({ id: r.id, name: r.name, type: r.type });
  }
  return result;
}

export async function listParentRecipes(
  db: any,
  itemId: string | null
): Promise<RecipeLink[]> {
  if (!itemId) return [];

  const rows = await db.recipeIngredient.findMany({
    where: { ingredientItemId: itemId },
    select: {
      Recipe: { select: { id: true, name: true, type: true } },
    },
  });

  return rows
    .filter((row: any) => row.Recipe)
    .map((row: any) => ({
      id: row.Recipe.id,
      name: row.Recipe.name,
      type: row.Recipe.type,
    }));
}
