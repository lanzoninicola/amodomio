import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { createStockMovementImportBatchFromVisionPayload } from "~/domain/stock-movement/stock-movement-import.server";

/**
 * GET /api/nfe/conciliacao?numero_nfe=1234
 *
 * Verifica se um lote de importação já foi criado para uma NF-e.
 * Usado pela extensão de navegador para checar o status de cada linha
 * da tabela "Notas de Entrada" do Saipos.
 *
 * Headers:
 *   x-api-key  (required) - REST API secret key
 *
 * Query params:
 *   numero_nfe  (required) - número da NF-e
 *
 * Response 200:
 *   {
 *     "status": "complete" | "partial" | "not_found",
 *     "total_items": 5,      // total de linhas no lote (0 se not_found)
 *     "processed_items": 5,  // linhas já aplicadas ao estoque (0 se not_found)
 *     "url": "https://..."   // null se not_found
 *   }
 *
 * "complete": lote existe e foi totalmente aplicado ao estoque
 * "partial":  lote existe mas ainda não foi aplicado (draft, validated, etc.)
 * "not_found": nenhum lote criado para essa NF
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    const status = auth.status === 500 ? 500 : 401;
    return json({ error: "unauthorized", message: auth.message }, { status });
  }

  const url = new URL(request.url);
  const numeroNfe = url.searchParams.get("numero_nfe")?.trim() || null;

  if (!numeroNfe) {
    return json({ error: "validation_error", message: "Parâmetro 'numero_nfe' é obrigatório." }, { status: 400 });
  }

  const db = prisma as any;
  const batch = await db.stockMovementImportBatch.findFirst({
    where: {
      Lines: { some: { invoiceNumber: numeroNfe } },
      status: { not: "archived" },
    },
    select: {
      id: true,
      status: true,
      _count: {
        select: {
          Lines: { where: { invoiceNumber: numeroNfe } },
        },
      },
      Lines: {
        where: { invoiceNumber: numeroNfe, appliedAt: { not: null } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!batch) {
    return json({ status: "not_found", total_items: 0, processed_items: 0, url: null });
  }

  const totalItems: number = batch._count.Lines;
  const processedItems: number = batch.Lines.length;
  const conciliationStatus = batch.status === "imported" ? "complete" : "partial";
  const batchUrl = `${url.origin}/admin/import-stock-movements/${batch.id}`;

  return json({ status: conciliationStatus, total_items: totalItems, processed_items: processedItems, url: batchUrl });
}

/**
 * POST /api/nfe/conciliacao
 *
 * Cria um lote de importação de estoque a partir de uma NF-e.
 * Usado pela extensão de navegador na tela do Saipos.
 *
 * Headers:
 *   x-api-key  (required) - REST API secret key
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     "fornecedor": "NOME DO FORNECEDOR",
 *     "numero_nfe": "1234",
 *     "valor_frete": 12.50,
 *     "items": [
 *       { "nome": "Pistache", "unidade_entrada": "UM", "quantidade": "0,1080", "valor_total": "29,1600" }
 *     ],
 *     "exportado_em": "2026-03-31T14:00:00.000Z"
 *   }
 *
 * Response 200:
 *   { "success": true, "url": "https://...", "message": "Lote importacao criado." }
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    const status = auth.status === 500 ? 500 : 401;
    return json({ error: "unauthorized", message: auth.message }, { status });
  }

  let body: {
    fornecedor?: unknown;
    numero_nfe?: unknown;
    valor_frete?: unknown;
    items?: unknown;
    exportado_em?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Corpo da requisição inválido." }, { status: 400 });
  }

  const fornecedor = typeof body.fornecedor === "string" ? body.fornecedor.trim() : null;
  const numeroNfe = typeof body.numero_nfe === "string" ? body.numero_nfe.trim() : null;
  const exportadoEm = typeof body.exportado_em === "string" ? body.exportado_em.trim() : null;
  const valorFrete = typeof body.valor_frete === "number" ? body.valor_frete : null;
  const items = Array.isArray(body.items) ? body.items : null;

  if (!fornecedor) {
    return json({ error: "validation_error", message: "Campo 'fornecedor' é obrigatório." }, { status: 400 });
  }
  if (!numeroNfe) {
    return json({ error: "validation_error", message: "Campo 'numero_nfe' é obrigatório." }, { status: 400 });
  }
  if (!items || items.length === 0) {
    return json({ error: "validation_error", message: "Campo 'items' deve ser um array não vazio." }, { status: 400 });
  }

  const movementAt = exportadoEm ? new Date(exportadoEm) : null;
  const batchName = `NFe ${numeroNfe} - ${fornecedor}${movementAt ? ` - ${movementAt.toLocaleDateString("pt-BR")}` : ""}`;

  const lines = items.map((item: any, index: number) => {
    const nome = typeof item.nome === "string" ? item.nome.trim() : "";
    const unidadeEntrada = typeof item.unidade_entrada === "string" ? item.unidade_entrada.trim() : null;
    const qtyEntry = parseDecimalBR(item.quantidade);
    const costTotalAmount = parseDecimalBR(item.valor_total);

    return {
      rowNumber: index + 1,
      ingredientName: nome,
      unitEntry: unidadeEntrada,
      qtyEntry: Number.isFinite(qtyEntry) ? qtyEntry : null,
      costTotalAmount: Number.isFinite(costTotalAmount) ? costTotalAmount : null,
      movementAt,
    };
  });

  const rateLimit = restApi.rateLimitCheck(request, { bucket: "nfe-conciliacao" });
  if (!rateLimit.success) {
    return json(
      { error: "rate_limited", message: "Muitas requisições. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  // Verifica se já existe um lote não-arquivado com o mesmo número de NF-e
  const db = prisma as any;
  const existingBatch = await db.stockMovementImportBatch.findFirst({
    where: {
      Lines: { some: { invoiceNumber: numeroNfe } },
      status: { not: "archived" },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (existingBatch) {
    const url = `/admin/import-stock-movements/${existingBatch.id}`;
    return json({ success: true, url, message: "Lote já existente para esta NF-e." });
  }

  let batchId: string;
  try {
    const result = await createStockMovementImportBatchFromVisionPayload({
      batchName,
      sourceType: "rest_api",
      supplierName: fornecedor,
      invoiceNumber: numeroNfe,
      movementAt,
      uploadedBy: "extensao-nfe",
      originalFileName: `nfe-${numeroNfe}`,
      notes: `Importado via extensão de navegador. NFe ${numeroNfe}.`,
      freightAmount: valorFrete,
      lines,
    });
    batchId = result.batchId;
  } catch (error) {
    console.error("[api.nfe.conciliacao] Erro ao criar lote:", error);
    return json({ error: "internal_error", message: "Erro ao criar lote de importação." }, { status: 500 });
  }

  const url = `/admin/import-stock-movements/${batchId}`;

  return json({ success: true, url, message: "Lote importacao criado." });
}

function parseDecimalBR(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}
