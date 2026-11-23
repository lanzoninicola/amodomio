import prismaClient from "~/lib/prisma/client.server";

export const LABELING_SETTINGS_CONTEXT = "labeling";
export const LABELING_SETTINGS = {
  printerName: "qz.printer-name",
  qzHost: "qz.host",
  columns: "print.columns",
  cutAfterPrint: "print.cut-after-label",
} as const;

const DEFAULT_SETTINGS: Record<string, { type: string; value: string }> = {
  [LABELING_SETTINGS.printerName]: { type: "string", value: "Tanca TP-620" },
  [LABELING_SETTINGS.qzHost]: { type: "string", value: "localhost" },
  [LABELING_SETTINGS.columns]: { type: "number", value: "42" },
  [LABELING_SETTINGS.cutAfterPrint]: { type: "boolean", value: "true" },
};

export async function ensureLabelingSettings() {
  await Promise.all(Object.entries(DEFAULT_SETTINGS).map(async ([name, definition]) => {
    const existing = await prismaClient.setting.findFirst({
      where: { context: LABELING_SETTINGS_CONTEXT, name }, select: { id: true },
    });
    if (!existing) await prismaClient.setting.create({
      data: { context: LABELING_SETTINGS_CONTEXT, name, ...definition, createdAt: new Date() },
    });
  }));
}

export async function getLabelingSettings() {
  await ensureLabelingSettings();
  const rows = await prismaClient.setting.findMany({
    where: { context: LABELING_SETTINGS_CONTEXT }, orderBy: { createdAt: "desc" },
  });
  const values = new Map(rows.map((row) => [row.name, row.value]));
  return {
    printerName: values.get(LABELING_SETTINGS.printerName) || "Tanca TP-620",
    qzHost: values.get(LABELING_SETTINGS.qzHost) || "localhost",
    columns: Math.max(20, Math.min(80, Number(values.get(LABELING_SETTINGS.columns)) || 42)),
    cutAfterPrint: values.get(LABELING_SETTINGS.cutAfterPrint) !== "false",
  };
}

export async function listLabelingItems() {
  return prismaClient.item.findMany({
    where: { active: true, archivedAt: null, LabelingConfig: { is: { enabled: true } } },
    select: { id: true, name: true, classification: true, LabelingConfig: true },
    orderBy: { name: "asc" },
  });
}

export async function createFoodLabel(params: {
  itemId: string; copies: number; operatorUserId?: string | null; operatorName?: string | null;
}) {
  const item = await prismaClient.item.findFirst({
    where: { id: params.itemId, active: true, archivedAt: null },
    include: { LabelingConfig: true },
  });
  if (!item?.LabelingConfig?.enabled) throw new Error("Este item não está habilitado para etiquetagem.");
  const copies = Math.max(1, Math.min(20, Math.trunc(params.copies || 1)));
  const manipulatedAt = new Date();
  const expiresAt = new Date(manipulatedAt.getTime() + item.LabelingConfig.shelfLifeMinutes * 60_000);
  return prismaClient.foodLabel.create({
    data: {
      itemId: item.id,
      itemName: item.LabelingConfig.labelName?.trim() || item.name,
      conservation: item.LabelingConfig.conservation,
      shelfLifeMinutes: item.LabelingConfig.shelfLifeMinutes,
      manipulatedAt, expiresAt, copies,
      operatorUserId: params.operatorUserId || null,
      operatorName: params.operatorName || null,
    },
  });
}

export async function markFoodLabelPrint(id: string, printed: boolean, error?: string) {
  return prismaClient.foodLabel.update({
    where: { id },
    data: { printStatus: printed ? "printed" : "failed", printedAt: printed ? new Date() : null,
      printError: printed ? null : String(error || "Falha de impressão").slice(0, 2000) },
  });
}

export async function listRecentFoodLabels(take = 20) {
  return prismaClient.foodLabel.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(100, take) });
}
