import { getAvailableItemUnits } from "~/domain/item/item-units.server";
import { itemPrismaEntity } from "~/domain/item/item.prisma.entity.server";

export async function listMobilePurchaseLists() {
  const db = itemPrismaEntity.client as any;
  return db.purchaseShoppingList.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      Items: {
        select: { id: true, purchased: true },
      },
    },
  });
}

export async function listMobilePurchaseCatalog() {
  const db = itemPrismaEntity.client as any;
  const [items, globalUnits] = await Promise.all([
    db.item.findMany({
      where: { active: true, canPurchase: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        purchaseUm: true,
        consumptionUm: true,
        ItemUnit: { select: { unitCode: true } },
        StockMovement: {
          where: {
            direction: "entry",
            deletedAt: null,
            supplierId: { not: null },
          },
          distinct: ["supplierId"],
          select: { Supplier: { select: { id: true, name: true } } },
        },
      },
    }),
    getAvailableItemUnits(),
  ]);

  return items.map((item: any) => {
    const unitOptions = Array.from(
      new Set(
        [
          item.purchaseUm,
          item.consumptionUm,
          ...item.ItemUnit.map((row: { unitCode: string }) => row.unitCode),
          ...globalUnits,
        ]
          .map((unit) =>
            String(unit || "")
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      )
    );

    return {
      id: item.id,
      name: item.name,
      suppliers: item.StockMovement.map(
        (movement: any) => movement.Supplier
      ).filter(Boolean),
      unitOptions,
      defaultUnit: String(
        item.purchaseUm || item.consumptionUm || unitOptions[0] || "UN"
      )
        .trim()
        .toUpperCase(),
    };
  });
}

export async function createMobilePurchaseList(
  name: string,
  items: Array<{ itemId: string; quantity: number; unit: string }>
) {
  const db = itemPrismaEntity.client as any;
  const catalog = await listMobilePurchaseCatalog();
  const available = new Map(catalog.map((item: any) => [item.id, item]));
  if (
    !name.trim() ||
    name.length > 200 ||
    !items.length ||
    items.length > 500 ||
    new Set(items.map((item) => item.itemId)).size !== items.length ||
    items.some((item) => {
      const product = available.get(item.itemId) as any;
      return (
        !product ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !product.unitOptions.includes(item.unit)
      );
    })
  )
    throw new Error("Informe nome, produtos, quantidades e unidades válidos.");
  return db.purchaseShoppingList.create({
    data: {
      name,
      Items: {
        createMany: {
          data: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
    },
  });
}

export async function getMobilePurchaseList(listId: string) {
  const db = itemPrismaEntity.client as any;
  return db.purchaseShoppingList.findUnique({
    where: { id: listId },
    include: {
      Items: {
        orderBy: [{ purchased: "asc" }, { createdAt: "asc" }],
        include: {
          Item: { select: { id: true, name: true } },
          Supplier: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function listMobilePurchaseSuppliers() {
  const db = itemPrismaEntity.client as any;
  return db.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function updateMobilePurchaseListItem(params: {
  listId: string;
  listItemId: string;
  supplierId?: string | null;
  purchased: boolean;
}) {
  const db = itemPrismaEntity.client as any;

  return db.$transaction(async (tx: any) => {
    await tx.purchaseShoppingListItem.updateMany({
      where: {
        id: params.listItemId,
        listId: params.listId,
      },
      data: {
        supplierId: params.supplierId || null,
        purchased: params.purchased,
        purchasedAt: params.purchased ? new Date() : null,
      },
    });

    const remaining = await tx.purchaseShoppingListItem.count({
      where: { listId: params.listId, purchased: false },
    });

    await tx.purchaseShoppingList.update({
      where: { id: params.listId },
      data: {
        status: remaining === 0 ? "completed" : "open",
        completedAt: remaining === 0 ? new Date() : null,
      },
    });
  });
}
