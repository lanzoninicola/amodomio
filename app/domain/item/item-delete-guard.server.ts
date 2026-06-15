type ItemDeleteBlocker = {
  reason: string;
};

function formatReasons(reasons: string[]) {
  if (reasons.length <= 1) return reasons[0] || "";
  if (reasons.length === 2) return `${reasons[0]} e ${reasons[1]}`;

  return `${reasons.slice(0, -1).join(", ")} e ${reasons[reasons.length - 1]}`;
}

export async function getItemDeleteBlockers(db: any, itemId: string) {
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

  const [
    stockMovement,
    recipeLine,
    recipe,
    menuItem,
    itemCostSheet,
    purchaseConversion,
  ] = await Promise.all([
    stockMovementLookup,
    recipeUsageLookup,
    db.recipe.findFirst({ where: { itemId }, select: { id: true } }),
    db.menuItem.findFirst({ where: { itemId }, select: { id: true } }),
    db.itemCostSheet.findFirst({ where: { itemId }, select: { id: true } }),
    db.itemPurchaseConversion.findFirst({
      where: { itemId },
      select: { id: true },
    }),
  ]);

  const blockers: ItemDeleteBlocker[] = [];
  if (stockMovement)
    blockers.push({ reason: "existem movimentações de estoque" });
  if (recipeLine)
    blockers.push({ reason: "está sendo usado como ingrediente em receitas" });
  if (recipe) blockers.push({ reason: "está vinculado a uma receita" });
  if (menuItem) blockers.push({ reason: "está vinculado ao cardápio" });
  if (itemCostSheet) blockers.push({ reason: "possui fichas de custo" });
  if (purchaseConversion)
    blockers.push({ reason: "possui UMs de compra vinculadas" });

  return blockers;
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
