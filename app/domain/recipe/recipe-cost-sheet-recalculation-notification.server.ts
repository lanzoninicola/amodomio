import {
  resolveAdminActionNotificationTarget,
  upsertAdminActionNotification,
} from "~/domain/admin-notifications/admin-action-notification.server";
import { listRecipeCostSheetRootIds } from "./recipe-cost-sheet-usage.server";

const NOTIFICATION_TYPE = "recipe-cost-sheet-recalculation";
const TARGET_TYPE = "item-cost-sheet";

export async function notifyRecipeCostSheetRecalculationRequired(
  db: any,
  recipeId: string
) {
  const [recipe, rootSheetIds] = await Promise.all([
    db.recipe.findUnique({
      where: { id: recipeId },
      select: { name: true },
    }),
    listRecipeCostSheetRootIds(db, recipeId),
  ]);

  if (!recipe || rootSheetIds.length === 0) return null;

  return upsertAdminActionNotification(db, {
    key: `${NOTIFICATION_TYPE}:${recipeId}`,
    type: NOTIFICATION_TYPE,
    entityId: recipeId,
    title: "Recalcular ficha técnica",
    description: `A composição ou o rendimento da receita ${recipe.name} mudou.`,
    href: `/admin/recipes/${recipeId}/fichas`,
    targets: rootSheetIds.map((rootSheetId) => ({
      type: TARGET_TYPE,
      id: rootSheetId,
    })),
  });
}

export async function resolveNotificationsForRecalculatedCostSheet(
  db: any,
  rootSheetId: string
) {
  return resolveAdminActionNotificationTarget(db, {
    type: TARGET_TYPE,
    id: rootSheetId,
  });
}
