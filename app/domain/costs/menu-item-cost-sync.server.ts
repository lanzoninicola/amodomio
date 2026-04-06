import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { MenuItemCostVariationUtility } from "~/domain/cardapio/menu-item-cost-variation-utility.entity.server";

// Compat layer: projeta custos nativos de Item para MenuItemCostVariation
// enquanto consumidores legados ainda dependem dessa estrutura.
export function normalizeVariationToSizeKey(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  const aliases: Record<string, string> = {
    base: "pizza-medium",
    medio: "pizza-medium",
    media: "pizza-medium",
    "pizza-media": "pizza-medium",
    "pizza-medio": "pizza-medium",
    pequeno: "pizza-small",
    small: "pizza-small",
    individual: "pizza-individual",
    grande: "pizza-big",
    big: "pizza-big",
    familia: "pizza-bigger",
    family: "pizza-bigger",
    bigger: "pizza-bigger",
    fatia: "pizza-slice",
    slice: "pizza-slice",
  };

  if (normalized.startsWith("pizza-")) return normalized;
  return aliases[normalized] || null;
}

export async function syncMenuItemCostsForItems(params: {
  db: any;
  itemIds: string[];
  updatedBy?: string | null;
}) {
  const itemIds = Array.from(
    new Set(params.itemIds.map((id) => String(id || "").trim()).filter(Boolean))
  );
  if (itemIds.length === 0) return { updatedMenuItems: [] as string[] };

  const [menuItems, sizes, activeSheets] = await Promise.all([
    params.db.menuItem.findMany({
      where: { itemId: { in: itemIds } },
      select: { id: true, itemId: true },
    }),
    menuItemSizePrismaEntity.findAll(),
    params.db.itemCostSheet.findMany({
      where: {
        itemId: { in: itemIds },
        isActive: true,
      },
      select: {
        id: true,
        itemId: true,
        costAmount: true,
        ItemVariation: {
          select: {
            isReference: true,
            Variation: { select: { code: true, name: true } },
          },
        },
      },
    }),
  ]);

  const sheetsByItemId = new Map<string, any[]>();
  for (const sheet of activeSheets) {
    const key = String(sheet.itemId || "").trim();
    if (!key) continue;
    const list = sheetsByItemId.get(key) || [];
    list.push(sheet);
    sheetsByItemId.set(key, list);
  }

  const updatedMenuItems = new Set<string>();

  for (const menuItem of menuItems) {
    const linkedItemId = String(menuItem.itemId || "").trim();
    if (!linkedItemId) continue;

    const itemSheets = sheetsByItemId.get(linkedItemId) || [];
    if (itemSheets.length === 0) continue;

    const exactCosts = new Map<string, number>();
    let mediumCostAmount: number | null = null;

    for (const sheet of itemSheets) {
      const variationCode = normalizeVariationToSizeKey(
        sheet.ItemVariation?.Variation?.code
      );
      const variationName = normalizeVariationToSizeKey(
        sheet.ItemVariation?.Variation?.name
      );
      const sizeKey = variationCode || variationName;
      const costAmount = Number(sheet.costAmount || 0);
      if (!(costAmount > 0)) continue;

      if (sizeKey) {
        exactCosts.set(sizeKey, costAmount);
      }

      if (
        mediumCostAmount == null &&
        (sizeKey === "pizza-medium" || sheet.ItemVariation?.isReference)
      ) {
        mediumCostAmount = costAmount;
      }
    }

    if (mediumCostAmount == null) {
      mediumCostAmount =
        exactCosts.get("pizza-medium") ||
        itemSheets
          .map((sheet) => Number(sheet.costAmount || 0))
          .find((value) => value > 0) ||
        null;
    }
    if (!(mediumCostAmount && mediumCostAmount > 0)) continue;

    const recommended =
      MenuItemCostVariationUtility.calculateAllRecommendedCostVariations(
        mediumCostAmount
      );

    for (const size of sizes) {
      const sizeKey = String(size.key || "").trim();
      if (!sizeKey) continue;
      const nextCostAmount = Number(
        exactCosts.get(sizeKey) ?? (recommended as any)[sizeKey] ?? 0
      );
      if (!(nextCostAmount >= 0)) continue;

      const existing = await params.db.menuItemCostVariation.findFirst({
        where: { menuItemId: menuItem.id, menuItemSizeId: size.id },
        select: { id: true, costAmount: true },
      });

      await params.db.menuItemCostVariation.upsert({
        where: {
          menuItemId_menuItemSizeId: {
            menuItemId: menuItem.id,
            menuItemSizeId: size.id,
          },
        },
        create: {
          menuItemId: menuItem.id,
          menuItemSizeId: size.id,
          costAmount: nextCostAmount,
          previousCostAmount: 0,
          updatedBy: params.updatedBy || "system:cost-impact",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          costAmount: nextCostAmount,
          previousCostAmount: Number(existing?.costAmount || 0),
          updatedBy: params.updatedBy || "system:cost-impact",
          updatedAt: new Date(),
        },
      });
    }

    updatedMenuItems.add(menuItem.id);
  }

  return { updatedMenuItems: Array.from(updatedMenuItems) };
}
