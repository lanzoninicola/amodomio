import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";

async function runBackfillMenuItemsToItems() {
  const db = prismaClient as any;

  const menuItems = await db.menuItem.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      itemId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let createdOrUpdated = 0;
  let linked = 0;
  let recipeSheetsLinked = 0;
  let recipesLinked = 0;
  let recipeItemsCreated = 0;

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
        where: {
          name: recipe.name,
        },
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

  return {
    totalMenuItems: menuItems.length,
    itemsCreatedOrUpdated: createdOrUpdated,
    menuItemsLinked: linked,
    recipeSheetsLinked,
    recipesLinked,
    recipeItemsCreated,
  };
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const [totalMenuItems, totalItems, linkedMenuItems] = await Promise.all([
      db.menuItem.count(),
      db.item.count(),
      db.menuItem.count({ where: { itemId: { not: null } } }),
    ]);

    return ok({
      stats: {
        totalMenuItems,
        totalItems,
        linkedMenuItems,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({}: ActionFunctionArgs) {
  try {
    const result = await runBackfillMenuItemsToItems();
    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemsBackfillPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  if (actionData?.status === 200) {
    toast({
      title: "Ok",
      description: `Backfill concluido. Vinculados: ${actionData.payload?.menuItemsLinked ?? 0}`,
    });
  }

  if (actionData?.status && actionData.status >= 400) {
    toast({
      title: "Erro",
      description: actionData.message,
      variant: "destructive",
    });
  }

  const stats = (loaderData?.payload as any)?.stats || {};

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">Backfill MenuItem → Item</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cria/atualiza `items` a partir de `menu_items` e preenche `menu_items.item_id`.
        </p>
        <div className="mt-3 text-sm text-slate-700">
          <div>Total MenuItems: {stats.totalMenuItems ?? 0}</div>
          <div>Total Items: {stats.totalItems ?? 0}</div>
          <div>MenuItems vinculados: {stats.linkedMenuItems ?? 0}</div>
        </div>
      </div>

      <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4">
        <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
          Executar backfill
        </Button>
      </Form>

      {actionData?.payload ? (
        <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          {JSON.stringify(actionData.payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
