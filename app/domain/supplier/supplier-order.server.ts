import { getSupplierNameFromMetadata } from "~/domain/item/item-cost-monitoring.server";
import { getAllActiveMeasurementUnits } from "~/domain/item/item-units.server";
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
  lastCost: number | null;
  lastCostUnit: string | null;
  lastMovementAt: Date | null;
  totalMovements: number;
  otherSupplierCosts: { supplierName: string; costAmount: number; unit: string | null }[];
};

export async function listSupplierOrderSuppliers(): Promise<SupplierOrderSupplier[]> {
  const db = itemPrismaEntity.client as any;
  return db.supplier.findMany({
    select: { id: true, name: true, phoneNumber: true },
    orderBy: [{ name: "asc" }],
  });
}

export async function getSupplierOrderSupplier(supplierId: string): Promise<SupplierOrderSupplier | null> {
  const db = itemPrismaEntity.client as any;
  return db.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true, phoneNumber: true },
  });
}

export async function listSupplierOrderProducts(supplierId: string): Promise<{
  supplier: SupplierOrderSupplier | null;
  itemRows: SupplierOrderProduct[];
}> {
  const db = itemPrismaEntity.client as any;
  const supplier = await getSupplierOrderSupplier(supplierId);

  if (!supplier) {
    return { supplier: null, itemRows: [] };
  }

  const movements = await db.stockMovement.findMany({
    where: { supplierId, direction: "entry", deletedAt: null },
    select: {
      itemId: true,
      newCostAtImport: true,
      newCostUnitAtImport: true,
      movementAt: true,
      Item: { select: { id: true, name: true, consumptionUm: true } },
    },
    orderBy: { movementAt: "desc" },
  });

  const itemMap = new Map<string, SupplierOrderProduct>();
  for (const movement of movements) {
    if (!movement.itemId) continue;

    if (!itemMap.has(movement.itemId)) {
      itemMap.set(movement.itemId, {
        itemId: movement.itemId,
        itemName: movement.Item?.name ?? movement.itemId,
        consumptionUm: movement.Item?.consumptionUm ?? null,
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
          select: { costAmount: true, unit: true, validFrom: true, createdAt: true, metadata: true },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
          take: 200,
        },
      },
    });

    const currentSupplierNameLower = supplier.name.trim().toLowerCase();
    for (const variation of variations) {
      const suppliersForItem = new Map<string, { costAmount: number; unit: string | null; date: number }>();

      for (const row of variation.ItemCostVariationHistory) {
        const supplierName = getSupplierNameFromMetadata(row.metadata);
        if (!supplierName) continue;

        const rowDate = (row.validFrom ? new Date(row.validFrom) : row.createdAt ? new Date(row.createdAt) : new Date(0)).getTime();
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
        .filter(([name]) => name.trim().toLowerCase() !== currentSupplierNameLower)
        .map(([supplierName, { costAmount, unit }]) => ({ supplierName, costAmount, unit }))
        .sort((a, b) => a.costAmount - b.costAmount);

      const row = itemMap.get(variation.itemId);
      if (row) row.otherSupplierCosts = others;
    }
  }

  const itemRows = Array.from(itemMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName, "pt-BR"));
  return { supplier, itemRows };
}

export async function getSupplierOrderDraftItems(
  supplierId: string,
  selection: { itemId: string; qty?: string | null; unit?: string | null }[],
): Promise<{
  supplier: SupplierOrderSupplier | null;
  items: SupplierOrderItem[];
  unitOptions: string[];
}> {
  const { supplier, itemRows } = await listSupplierOrderProducts(supplierId);
  const unitOptions = await getAllActiveMeasurementUnits();
  const rowsById = new Map(itemRows.map((row) => [row.itemId, row]));

  const items = selection
    .map((entry) => {
      const row = rowsById.get(entry.itemId);
      if (!row) return null;

      return {
        itemId: row.itemId,
        itemName: row.itemName,
        unit: entry.unit || row.consumptionUm || row.lastCostUnit || unitOptions[0] || null,
        qty: entry.qty || "",
      };
    })
    .filter(Boolean) as SupplierOrderItem[];

  return { supplier, items, unitOptions };
}

