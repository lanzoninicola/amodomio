import { createHash } from "node:crypto";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { createEmbedToken } from "~/domain/auth/embed-session.server";
import { authenticator } from "~/domain/auth/google.server";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import {
  createStockMovementImportBatchFromVisionPayload,
  getStockMovementImportBatchView,
  mapBatchLinesToItem,
  setBatchLineManualConversion,
  approveBatchLineCostReview,
  startStockMovementImportBatch,
  importStockMovementImportBatchStep,
  updateStockMovementImportBatchLineEditableFields,
} from "~/domain/stock-movement/stock-movement-import.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ ok: false, error: "Método inválido" }, { status: 405 });
  const key = request.headers.get("x-api-key");
  const auth = key ? restApi.authorize(key) : null;
  const user = key ? null : await authenticator.isAuthenticated(request);
  if ((auth && auth.status !== 200) || (!auth && !user))
    return json(
      { ok: false, error: "Confira a chave da API ou entre no sistema" },
      { status: auth?.status === 500 ? 500 : 401 }
    );
  if (!key && new URL(request.url).origin !== request.headers.get("origin"))
    return json({ ok: false, error: "Origem inválida" }, { status: 403 });
  if (!restApi.rateLimitCheck(request, { bucket: "suitable-stock" }).success)
    return json(
      { ok: false, error: "Aguarde um minuto para continuar" },
      { status: 429 }
    );
  try {
    const body = await request.json();
    const actor = user
      ? String((user as any).email || "admin:suitable-stock")
      : "api:suitable-stock";
    let batchId = body.batchId;
    let reused: { status: string } | null = null;
    if (body.action === "create") {
      const note = body.note;
      if (
        !note ||
        typeof note.supplierName !== "string" ||
        !note.supplierName.trim() ||
        typeof note.invoiceNumber !== "string" ||
        !/^\d{1,30}$/.test(note.invoiceNumber) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(note.date) ||
        !Array.isArray(note.lines) ||
        !note.lines.length ||
        note.lines.length > 500
      )
        throw new Error("Confira fornecedor, número, data e produtos da nota");
      const date = new Date(note.date + "T12:00:00Z");
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== note.date
      )
        throw new Error("Data inválida");
      for (const line of note.lines) {
        if (
          typeof line.ingredientName !== "string" ||
          !line.ingredientName.trim() ||
          line.ingredientName.length > 300 ||
          !Number.isFinite(line.qtyEntry) ||
          line.qtyEntry <= 0 ||
          typeof line.unitEntry !== "string" ||
          !line.unitEntry.trim() ||
          !Number.isFinite(line.costAmount) ||
          line.costAmount < 0 ||
          !Number.isFinite(line.costTotalAmount) ||
          line.costTotalAmount < 0
        )
          throw new Error(
            "Há produtos com quantidade, unidade ou valor inválido"
          );
      }
      const identity = createHash("sha256")
        .update(
          JSON.stringify([
            note.supplierName.trim().toUpperCase(),
            note.invoiceNumber.replace(/^0+(?=\d)/, ""),
            note.date,
          ])
        )
        .digest("hex");
      const filename = `suitable-${identity}.json`;
      // Serialize retries for this invoice, including retries after a response timeout.
      batchId = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity}))`;
          // Archived batches were discarded on purpose, so a new capture starts a new one.
          const existing = await tx.stockMovementImportBatch.findFirst({
            where: {
              sourceSystem: "suitable",
              originalFileName: filename,
              archivedAt: null,
              status: { not: "archived" },
            },
            orderBy: { createdAt: "desc" },
          });
          if (existing) {
            reused = { status: String(existing.status || "draft") };
            return existing.id;
          }
          const result = await createStockMovementImportBatchFromVisionPayload({
            batchName: `${note.supplierName.trim()} · NF ${note.invoiceNumber}`,
            sourceSystem: "suitable",
            sourceType: "rest_api",
            uploadedBy: actor,
            originalFileName: filename,
            worksheetName: "Suitable",
            notes: "Nota de entrada capturada pela extensão Suitable",
            movementAt: date,
            invoiceNumber: note.invoiceNumber,
            supplierName: note.supplierName.trim(),
            lines: note.lines.map((line: any, index: number) => ({
              ingredientName: line.ingredientName,
              qtyEntry: line.qtyEntry,
              unitEntry: line.unitEntry,
              costAmount: line.costAmount,
              costTotalAmount: line.costTotalAmount,
              convertedCostAmount: line.convertedCostAmount,
              costAmount: line.costAmount,
              costTotalAmount: line.costTotalAmount,
              rawData: { source: "suitable", rowNumber: index + 1, ...line },
            })),
          });
          return result.batchId;
        },
        { timeout: 60000 }
      );
    } else {
      if (typeof batchId !== "string" || !batchId)
        throw new Error("Lote inválido");
      const batch = await prisma.stockMovementImportBatch.findUnique({
        where: { id: batchId },
      });
      if (!batch || batch.sourceSystem !== "suitable")
        throw new Error("Lote Suitable não encontrado");
      if (batch.rolledBackAt) throw new Error("Lote revertido");
      if (["map", "conversion", "approve", "supplier"].includes(body.action)) {
        const line = await prisma.stockMovementImportBatchLine.findUnique({
          where: { id: String(body.lineId || "") },
        });
        if (!line || line.batchId !== batchId || line.appliedAt)
          throw new Error("Linha inválida ou já importada");
        if (body.action === "supplier") {
          const supplier = await prisma.supplier.findUnique({
            where: { id: String(body.supplierId || "") },
          });
          if (!supplier) throw new Error("Fornecedor inválido");
          await updateStockMovementImportBatchLineEditableFields({
            batchId,
            lineId: line.id,
            actor,
            ingredientName: line.ingredientName,
            movementAt: line.movementAt,
            invoiceNumber: line.invoiceNumber,
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierCnpj: supplier.cnpj,
            qtyEntry: line.qtyEntry,
            unitEntry: line.unitEntry,
            costAmount: line.costAmount,
            costTotalAmount: line.costTotalAmount,
            qtyConsumption: line.qtyConsumption,
            unitConsumption: line.unitConsumption,
            movementUnit: line.movementUnit,
            mappedItemId: line.mappedItemId,
            manualConversionFactor: line.manualConversionFactor,
          });
        }
        if (body.action === "map")
          await mapBatchLinesToItem({
            batchId,
            lineId: line.id,
            itemId: String(body.itemId || ""),
            actor,
          });
        if (body.action === "conversion") {
          if (!Number.isFinite(body.factor) || body.factor <= 0)
            throw new Error("Informe um fator maior que zero");
          await setBatchLineManualConversion({
            batchId,
            lineId: line.id,
            factor: body.factor,
          });
        }
        if (body.action === "approve")
          await approveBatchLineCostReview({ batchId, lineId: line.id, actor });
      } else if (body.action === "start") {
        const view = await getStockMovementImportBatchView(batchId);
        if (!view || view.summary.readyToImport === 0)
          throw new Error("Nenhuma linha pronta para importar");
        if (
          view.summary.readyToImport +
            view.summary.imported +
            view.summary.skippedDuplicate !==
          view.summary.total
        )
          throw new Error(
            "Resolva todas as pendências antes de importar a nota"
          );
        await startStockMovementImportBatch({ batchId, actor });
      } else if (body.action === "step") {
        const result = await importStockMovementImportBatchStep({
          batchId,
          actor,
          limit: 1,
        });
        return json({ ok: true, batchId, ...result });
      } else if (body.action !== "status") throw new Error("Ação inválida");
    }
    const view = await getStockMovementImportBatchView(batchId);
    if (!view) throw new Error("Lote não encontrado");
    return json(
      {
        ok: true,
        batchId,
        existing: reused !== null,
        batchStatus: (reused as { status: string } | null)?.status,
        path: `/admin/import-stock-movements/${batchId}`,
        embedPath: `/embed/stock-batch/${batchId}?token=${createEmbedToken(batchId)}`,
        summary: view.summary,
        suppliers: await prisma.supplier.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        lines: view.lines.map((line: any) => ({
          id: line.id,
          ingredientName: line.ingredientName,
          qtyEntry: line.qtyEntry,
          unitEntry: line.unitEntry,
          costAmount: line.costAmount,
          costTotalAmount: line.costTotalAmount,
          convertedCostAmount: line.convertedCostAmount,
          status: line.status,
          errorMessage: line.errorMessage,
          mappedItemId: line.mappedItemId,
          targetUnit: line.targetUnit,
          supplierReconciliationStatus: line.supplierReconciliationStatus,
        })),
        items: view.items.map((item: any) => ({
          id: item.id,
          name: item.name,
          unit: item.consumptionUm || item.purchaseUm,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Suitable stock import", error);
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível processar a nota",
      },
      { status: 400 }
    );
  }
}
