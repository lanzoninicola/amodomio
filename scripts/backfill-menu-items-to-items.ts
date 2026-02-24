import prismaClient from "../app/lib/prisma/client.server";
import tryit from "../app/utils/try-it";

async function main() {
  const db = prismaClient as any;

  const [errLoad, menuItems] = await tryit(
    db.menuItem.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        itemId: true,
      },
      orderBy: { createdAt: "asc" },
    })
  );

  if (errLoad) {
    throw errLoad;
  }

  let createdOrUpdated = 0;
  let linked = 0;
  let recipeSheetsLinked = 0;
  let recipesLinked = 0;
  let recipeItemsCreated = 0;
  let productsLinked = 0;
  let productItemsCreated = 0;

  for (const menuItem of menuItems || []) {
    await db.item.upsert({
      where: { id: menuItem.id },
      create: {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description || null,
        classification: "produto_final",
        active: menuItem.active ?? true,
        canPurchase: false,
        canTransform: true,
        canSell: true,
        canStock: true,
        canBeInMenu: true,
      },
      update: {
        name: menuItem.name,
        description: menuItem.description || null,
        active: menuItem.active ?? true,
        canSell: true,
        canBeInMenu: true,
      },
    });

    createdOrUpdated += 1;

    if (menuItem.itemId !== menuItem.id) {
      await db.menuItem.update({
        where: { id: menuItem.id },
        data: { itemId: menuItem.id },
      });
      linked += 1;
    }
  }

  try {
    recipeSheetsLinked = await db.$executeRawUnsafe(`
      UPDATE "recipe_sheets" rs
      SET "item_id" = mi."item_id"
      FROM "menu_items" mi
      WHERE rs."menu_item_id" = mi."id"
        AND mi."item_id" IS NOT NULL
        AND rs."item_id" IS NULL
    `);
  } catch (_error) {
    // Ignore when recipe_sheets.item_id migration was not applied yet.
  }

  try {
    const recipes = await db.recipe.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        itemId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const recipe of recipes || []) {
      if (recipe.itemId) continue;

      let item = await db.item.findFirst({
        where: { name: recipe.name },
        orderBy: { updatedAt: "desc" },
      });

      if (!item) {
        const isSemiFinished = recipe.type === "semiFinished";

        item = await db.item.create({
          data: {
            name: recipe.name,
            description: recipe.description || null,
            classification: isSemiFinished ? "semi_acabado" : "produto_final",
            active: true,
            canPurchase: false,
            canTransform: true,
            canSell: !isSemiFinished,
            canStock: true,
            canBeInMenu: false,
          },
        });

        recipeItemsCreated += 1;
      }

      await db.recipe.update({
        where: { id: recipe.id },
        data: { itemId: item.id },
      });
      recipesLinked += 1;
    }
  } catch (_error) {
    // Ignore when recipes.item_id migration was not applied yet.
  }

  try {
    const products = await db.product.findMany({
      select: {
        id: true,
        name: true,
        itemId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const product of products || []) {
      if (product.itemId) continue;

      let item = await db.item.findFirst({
        where: { name: product.name },
        orderBy: { updatedAt: "desc" },
      });

      if (!item) {
        item = await db.item.create({
          data: {
            name: product.name,
            classification: "insumo",
            active: true,
            canPurchase: true,
            canTransform: false,
            canSell: false,
            canStock: true,
            canBeInMenu: false,
          },
        });
        productItemsCreated += 1;
      }

      await db.product.update({
        where: { id: product.id },
        data: { itemId: item.id },
      });
      productsLinked += 1;
    }
  } catch (_error) {
    // Ignore when products.item_id migration was not applied yet.
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalMenuItems: menuItems?.length ?? 0,
        itemsCreatedOrUpdated: createdOrUpdated,
        menuItemsLinked: linked,
        recipeSheetsLinked,
        recipesLinked,
        recipeItemsCreated,
        productsLinked,
        productItemsCreated,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaClient.$disconnect();
  });
