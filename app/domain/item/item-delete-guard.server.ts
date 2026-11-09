type ItemDeleteBlocker = {
  reason: string;
  kind:
    | "stock-movement"
    | "recipe-usage"
    | "recipe"
    | "selling-channel"
    | "item-cost-sheet"
    | "purchase-conversion";
};

type ItemDeleteOptions = {
  deleteLinkedRecipe?: boolean;
  deleteLinkedCostSheets?: boolean;
};

function formatReasons(reasons: string[]) {
  if (reasons.length <= 1) return reasons[0] || "";
  if (reasons.length === 2) return `${reasons[0]} e ${reasons[1]}`;

  return `${reasons.slice(0, -1).join(", ")} e ${reasons[reasons.length - 1]}`;
}

export async function getItemDeleteBlockers(
  db: any,
  itemId: string,
  options: ItemDeleteOptions = {}
) {
  const stockMovementLookup =
    typeof db.stockMovement?.findFirst === "function"
      ? db.stockMovement.findFirst({
          where: { itemId, deletedAt: null },
          select: { id: true },
        })
      : typeof db.stockMovementImportBatchLine?.findFirst === "function"
      ? db.stockMovementImportBatchLine.findFirst({
          where: {
            mappedItemId: itemId,
            appliedAt: { not: null },
            rolledBackAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve(null);
  const recipeUsageLookup =
    typeof db.recipeIngredient?.findFirst === "function"
      ? db.recipeIngredient.findFirst({
          where: { ingredientItemId: itemId },
          select: { id: true },
        })
      : typeof db.recipeLine?.findFirst === "function"
      ? db.recipeLine.findFirst({
          where: { itemId },
          select: { id: true },
        })
      : Promise.resolve(null);
  const sellingChannelLookup =
    typeof db.itemSellingChannelItem?.findFirst === "function"
      ? db.itemSellingChannelItem.findFirst({
          where: { itemId },
          select: { id: true },
        })
      : Promise.resolve(null);

  const [
    stockMovement,
    recipeLine,
    recipe,
    sellingChannel,
    itemCostSheet,
    purchaseConversion,
  ] = await Promise.all([
    stockMovementLookup,
    recipeUsageLookup,
    db.recipe.findFirst({ where: { itemId }, select: { id: true } }),
    sellingChannelLookup,
    db.itemCostSheet.findFirst({ where: { itemId }, select: { id: true } }),
    db.itemPurchaseConversion.findFirst({
      where: { itemId },
      select: { id: true },
    }),
  ]);

  const blockers: ItemDeleteBlocker[] = [];
  if (stockMovement)
    blockers.push({
      kind: "stock-movement",
      reason: "existem movimentações de estoque",
    });
  if (recipeLine)
    blockers.push({
      kind: "recipe-usage",
      reason: "está sendo usado como ingrediente em receitas",
    });
  if (recipe && !options.deleteLinkedRecipe)
    blockers.push({ kind: "recipe", reason: "está vinculado a uma receita" });
  if (sellingChannel)
    blockers.push({
      kind: "selling-channel",
      reason: "está vinculado a um canal de venda",
    });
  if (itemCostSheet && !options.deleteLinkedCostSheets)
    blockers.push({
      kind: "item-cost-sheet",
      reason: "possui fichas de custo",
    });
  if (purchaseConversion)
    blockers.push({
      kind: "purchase-conversion",
      reason: "possui UMs de compra vinculadas",
    });

  return blockers;
}

export async function deleteItemWithLinkedRecords(
  db: any,
  itemId: string,
  options: ItemDeleteOptions = {}
) {
  return db.$transaction(async (tx: any) => {
    if (options.deleteLinkedCostSheets) {
      await tx.itemCostSheet.deleteMany({
        where: { itemId, baseItemCostSheetId: { not: null } },
      });
      await tx.itemCostSheet.deleteMany({ where: { itemId } });
    }

    if (options.deleteLinkedRecipe) {
      await tx.recipe.deleteMany({ where: { itemId } });
    }

    // MenuItem pertence ao cardápio legado. Ele não representa um vínculo
    // atual de canal e deve permanecer apenas sem a referência ao Item.
    await tx.menuItem.updateMany({
      where: { itemId },
      data: { itemId: null },
    });

    return tx.item.delete({ where: { id: itemId } });
  });
}

export function buildItemDeleteBlockedMessage(blockers: ItemDeleteBlocker[]) {
  const reasons = blockers.map((blocker) => blocker.reason);
  const detail = formatReasons(reasons);

  if (
    reasons.length === 1 &&
    reasons[0] === "possui UMs de compra vinculadas"
  ) {
    return "Não é possível eliminar este item porque ele possui UMs de compra vinculadas. Remova as UMs de compra na aba Compras antes de tentar novamente.";
  }

  return `Não é possível eliminar este item porque ${detail}. Remova ou ajuste esses vínculos antes de tentar novamente.`;
}
