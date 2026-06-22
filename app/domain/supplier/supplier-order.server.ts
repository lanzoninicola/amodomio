import { getSupplierNameFromMetadata } from "~/domain/item/item-cost-monitoring.server";
import { getAvailableItemUnits } from "~/domain/item/item-units.server";
import { itemPrismaEntity } from "~/domain/item/item.prisma.entity.server";
import type { SupplierOrderItem } from "~/domain/supplier/supplier-order";

export type SupplierOrderSupplier = {
  id: string;
  name: string;
  phoneNumber: string | null;
};

export type SupplierOrderProduct = {
  itemId: string;
  itemName: string;
  consumptionUm: string | null;
  linkedUnitOptions: string[];
  lastPurchaseUnit: string | null;
  lastCost: number | null;
  lastCostUnit: string | null;
  lastMovementAt: Date | null;
  totalMovements: number;
  otherSupplierCosts: {
    supplierName: string;
    costAmount: number;
    unit: string | null;
  }[];
};

export async function listSupplierOrderSuppliers(): Promise<
  SupplierOrderSupplier[]
> {
  const db = itemPrismaEntity.client as any;
  return db.supplier.findMany({
    select: { id: true, name: true, phoneNumber: true },
    orderBy: [{ name: "asc" }],
  });
}

export async function getSupplierOrderSupplier(
  supplierId: string
): Promise<SupplierOrderSupplier | null> {
  const db = itemPrismaEntity.client as any;
  return db.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true, phoneNumber: true },
  });
}

export async function listSupplierOrderProducts(supplierId: string): Promise<{
  supplier: SupplierOrderSupplier | null;
  itemRows: SupplierOrderProduct[];
  globalUnitOptions: string[];
}> {
  const db = itemPrismaEntity.client as any;
  const [supplier, globalUnitOptions] = await Promise.all([
    getSupplierOrderSupplier(supplierId),
    getAvailableItemUnits(),
  ]);

  if (!supplier) {
    return { supplier: null, itemRows: [], globalUnitOptions };
  }

  const movements = await db.stockMovement.findMany({
    where: { supplierId, direction: "entry", deletedAt: null },
    select: {
      itemId: true,
      newCostAtImport: true,
      newCostUnitAtImport: true,
      movementUnit: true,
      quantityUnit: true,
      movementAt: true,
      Item: {
        select: {
          id: true,
          name: true,
          consumptionUm: true,
          ItemUnit: { select: { unitCode: true } },
        },
      },
    },
    orderBy: { movementAt: "desc" },
  });

  const itemMap = new Map<string, SupplierOrderProduct>();
  for (const movement of movements) {
    if (!movement.itemId) continue;

    if (!itemMap.has(movement.itemId)) {
      const consumptionUnit = normalizeSupplierOrderUnit(
        movement.Item?.consumptionUm
      );
      const itemUnitOptions = Array.from(
        new Set(
          (movement.Item?.ItemUnit || [])
            .map((row: { unitCode: string }) =>
              normalizeSupplierOrderUnit(row.unitCode)
            )
            .filter(Boolean) as string[]
        )
      )
        .filter((unit) => unit !== consumptionUnit)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      const linkedUnitOptions = Array.from(
        new Set(
          [consumptionUnit, ...itemUnitOptions].filter(Boolean) as string[]
        )
      );

      itemMap.set(movement.itemId, {
        itemId: movement.itemId,
        itemName: movement.Item?.name ?? movement.itemId,
        consumptionUm: movement.Item?.consumptionUm ?? null,
        linkedUnitOptions,
        lastPurchaseUnit:
          normalizeSupplierOrderUnit(
            movement.movementUnit ||
              movement.quantityUnit ||
              movement.newCostUnitAtImport
          ) || null,
        lastCost: movement.newCostAtImport ?? null,
        lastCostUnit: movement.newCostUnitAtImport ?? null,
        lastMovementAt: movement.movementAt ?? null,
        totalMovements: 1,
        otherSupplierCosts: [],
      });
    } else {
      itemMap.get(movement.itemId)!.totalMovements += 1;
    }
  }

  const itemIds = Array.from(itemMap.keys());
  if (itemIds.length > 0) {
    const variations = await db.itemVariation.findMany({
      where: { itemId: { in: itemIds }, deletedAt: null },
      select: {
        itemId: true,
        ItemCostVariationHistory: {
          select: {
            costAmount: true,
            unit: true,
            validFrom: true,
            createdAt: true,
            metadata: true,
          },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
          take: 200,
        },
      },
    });

    const currentSupplierNameLower = supplier.name.trim().toLowerCase();
    for (const variation of variations) {
      const suppliersForItem = new Map<
        string,
        { costAmount: number; unit: string | null; date: number }
      >();

      for (const row of variation.ItemCostVariationHistory) {
        const supplierName = getSupplierNameFromMetadata(row.metadata);
        if (!supplierName) continue;

        const rowDate = (
          row.validFrom
            ? new Date(row.validFrom)
            : row.createdAt
            ? new Date(row.createdAt)
            : new Date(0)
        ).getTime();
        const existing = suppliersForItem.get(supplierName);
        if (!existing || rowDate > existing.date) {
          suppliersForItem.set(supplierName, {
            costAmount: Number(row.costAmount || 0),
            unit: row.unit ?? null,
            date: rowDate,
          });
        }
      }

      const others = Array.from(suppliersForItem.entries())
        .filter(
          ([name]) => name.trim().toLowerCase() !== currentSupplierNameLower
        )
        .map(([supplierName, { costAmount, unit }]) => ({
          supplierName,
          costAmount,
          unit,
        }))
        .sort((a, b) => a.costAmount - b.costAmount);

      const row = itemMap.get(variation.itemId);
      if (row) row.otherSupplierCosts = others;
    }
  }

  const itemRows = Array.from(itemMap.values()).sort((a, b) =>
    a.itemName.localeCompare(b.itemName, "pt-BR")
  );
  return { supplier, itemRows, globalUnitOptions };
}

export async function getSupplierOrderDraftItems(
  supplierId: string,
  selection: {
    itemId: string | null;
    freeItemName?: string | null;
    qty?: string | null;
    unit?: string | null;
    supplierItemName?: string | null;
  }[]
): Promise<{
  supplier: SupplierOrderSupplier | null;
  items: SupplierOrderItem[];
  unitOptions: string[];
}> {
  const { supplier, itemRows, globalUnitOptions } =
    await listSupplierOrderProducts(supplierId);
  const rowsById = new Map(itemRows.map((row) => [row.itemId, row]));

  const items = selection
    .map((entry) => {
      const freeItemName = String(entry.freeItemName || "").trim();
      if (!entry.itemId && freeItemName) {
        const requestedUnit = normalizeSupplierOrderUnit(entry.unit);
        return {
          itemId: null,
          itemName: freeItemName,
          supplierItemName: freeItemName,
          unit: globalUnitOptions.includes(requestedUnit)
            ? requestedUnit
            : globalUnitOptions[0] || null,
          unitOptions: globalUnitOptions,
          qty: entry.qty || "",
        };
      }

      if (!entry.itemId) return null;
      const row = rowsById.get(entry.itemId);
      if (!row) return null;

      const requestedUnit = String(entry.unit || "")
        .trim()
        .toUpperCase();
      const allowedUnitOptions = Array.from(
        new Set(
          [
            row.lastPurchaseUnit,
            ...row.linkedUnitOptions,
            ...globalUnitOptions,
          ].filter(Boolean) as string[]
        )
      );
      const defaultUnit = allowedUnitOptions.includes(
        String(row.lastPurchaseUnit || "")
          .trim()
          .toUpperCase()
      )
        ? String(row.lastPurchaseUnit).trim().toUpperCase()
        : allowedUnitOptions[0] || null;

      return {
        itemId: row.itemId,
        itemName: row.itemName,
        supplierItemName:
          String(entry.supplierItemName || "").trim() || row.itemName,
        unit: allowedUnitOptions.includes(requestedUnit)
          ? requestedUnit
          : defaultUnit,
        unitOptions: allowedUnitOptions,
        qty: entry.qty || "",
      };
    })
    .filter(Boolean) as SupplierOrderItem[];

  return { supplier, items, unitOptions: globalUnitOptions };
}

function normalizeSupplierOrderUnit(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export async function listRecentSupplierPurchaseOrders(limit = 20) {
  const db = itemPrismaEntity.client as any;
  return db.supplierPurchaseOrder.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      Supplier: { select: { id: true, name: true } },
      Items: { select: { id: true, checked: true } },
    },
  });
}

export async function countOpenSupplierPurchaseOrders() {
  const db = itemPrismaEntity.client as any;
  return db.supplierPurchaseOrder.count({ where: { status: "open" } });
}

export async function listOpenSupplierPurchaseOrders(limit = 50) {
  const db = itemPrismaEntity.client as any;
  return db.supplierPurchaseOrder.findMany({
    where: { status: "open" },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      Supplier: { select: { id: true, name: true } },
      Items: { select: { id: true, checked: true } },
    },
  });
}

export async function getSupplierPurchaseOrder(orderId: string) {
  const db = itemPrismaEntity.client as any;
  return db.supplierPurchaseOrder.findUnique({
    where: { id: orderId },
    include: {
      Supplier: { select: { id: true, name: true, phoneNumber: true } },
      Items: {
        orderBy: { createdAt: "asc" },
        include: { Item: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function removeOpenSupplierPurchaseOrder(orderId: string) {
  const db = itemPrismaEntity.client as any;
  return db.supplierPurchaseOrder.deleteMany({
    where: { id: orderId, status: "open" },
  });
}

export async function saveSupplierPurchaseOrder(
  supplierId: string,
  selection: {
    itemId: string | null;
    freeItemName?: string | null;
    qty?: string | null;
    unit?: string | null;
    supplierItemName?: string | null;
  }[],
  orderId?: string | null
) {
  const db = itemPrismaEntity.client as any;
  const draft = await getSupplierOrderDraftItems(supplierId, selection);
  const validItems = draft.items
    .map((item) => ({
      ...item,
      quantity: Number(String(item.qty || "").replace(",", ".")),
    }))
    .filter(
      (item) => item.unit && Number.isFinite(item.quantity) && item.quantity > 0
    );

  if (!draft.supplier || validItems.length === 0) return null;

  return db.$transaction(async (tx: any) => {
    const existing = orderId
      ? await tx.supplierPurchaseOrder.findFirst({
          where: { id: orderId, supplierId },
        })
      : null;
    const order = existing
      ? await tx.supplierPurchaseOrder.update({
          where: { id: existing.id },
          data: { status: "open", receivedAt: null },
        })
      : await tx.supplierPurchaseOrder.create({ data: { supplierId } });

    const catalogItems = validItems.filter((item) => item.itemId);
    const freeItems = validItems.filter((item) => !item.itemId);
    const itemIds = catalogItems.map((item) => item.itemId);
    await tx.supplierPurchaseOrderItem.deleteMany({
      where: {
        orderId: order.id,
        OR: [{ itemId: null }, { itemId: { notIn: itemIds } }],
      },
    });
    for (const item of catalogItems) {
      await tx.supplierPurchaseOrderItem.upsert({
        where: { orderId_itemId: { orderId: order.id, itemId: item.itemId } },
        create: {
          orderId: order.id,
          itemId: item.itemId,
          supplierItemName: item.supplierItemName || item.itemName,
          quantity: item.quantity,
          unit: item.unit,
        },
        update: {
          supplierItemName: item.supplierItemName || item.itemName,
          quantity: item.quantity,
          unit: item.unit,
        },
      });
    }
    if (freeItems.length > 0) {
      await tx.supplierPurchaseOrderItem.createMany({
        data: freeItems.map((item) => ({
          orderId: order.id,
          itemId: null,
          freeItemName: item.itemName,
          supplierItemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
        })),
      });
    }

    return order;
  });
}

export async function removeSupplierPurchaseOrderItem(
  orderId: string,
  orderItemId: string
) {
  const db = itemPrismaEntity.client as any;
  await db.$transaction([
    db.supplierPurchaseOrderItem.deleteMany({
      where: { id: orderItemId, orderId },
    }),
    db.supplierPurchaseOrder.update({
      where: { id: orderId },
      data: { status: "open", receivedAt: null },
    }),
  ]);
}

export async function toggleSupplierPurchaseOrderItemChecked(
  orderId: string,
  orderItemId: string
) {
  const db = itemPrismaEntity.client as any;
  return db.$transaction(async (tx: any) => {
    const item = await tx.supplierPurchaseOrderItem.findFirst({
      where: { id: orderItemId, orderId },
    });
    if (!item) return null;

    const checked = !item.checked;
    await tx.supplierPurchaseOrderItem.update({
      where: { id: item.id },
      data: { checked, checkedAt: checked ? new Date() : null },
    });

    const remaining = await tx.supplierPurchaseOrderItem.count({
      where: { orderId, checked: false },
    });
    await tx.supplierPurchaseOrder.update({
      where: { id: orderId },
      data: {
        status: remaining === 0 ? "received" : "open",
        receivedAt: remaining === 0 ? new Date() : null,
      },
    });
    return checked;
  });
}
