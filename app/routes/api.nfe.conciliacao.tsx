import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { createStockMovementImportBatchFromVisionPayload } from "~/domain/stock-movement/stock-movement-import.server";

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

  let batchId: string;
  try {
    const result = await createStockMovementImportBatchFromVisionPayload({
      batchName,
      supplierName: fornecedor,
      invoiceNumber: numeroNfe,
      movementAt,
      uploadedBy: "extensao-nfe",
      originalFileName: `nfe-${numeroNfe}`,
      notes: `Importado via extensão de navegador. NFe ${numeroNfe}.`,
      lines,
    });
    batchId = result.batchId;
  } catch (error) {
    console.error("[api.nfe.conciliacao] Erro ao criar lote:", error);
    return json({ error: "internal_error", message: "Erro ao criar lote de importação." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const url = `${origin}/admin/import-stock-movements/${batchId}`;

  return json({ success: true, url, message: "Lote importacao criado." });
}

function parseDecimalBR(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}
