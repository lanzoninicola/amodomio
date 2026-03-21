import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useFetcher } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { authenticator } from "~/domain/auth/google.server";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";
import { createStockNfImportBatchFromVisionPayload } from "~/domain/stock-nf-import/stock-nf-import.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Entrada de estoque por foto" }];

const CHATGPT_URL = "https://chatgpt.com/";

type ParsedVisionPayload = {
  document: {
    supplierName: string | null;
    supplierCnpj: string | null;
    invoiceNumber: string | null;
    movementAt: string | null;
    notes: string | null;
  };
  lines: Array<{
    rowNumber: number;
    movementAt: string | null;
    invoiceNumber: string | null;
    supplierName: string | null;
    supplierCnpj: string | null;
    ingredientName: string;
    qtyEntry: number | null;
    unitEntry: string | null;
    qtyConsumption: number | null;
    unitConsumption: string | null;
    movementUnit: string | null;
    costAmount: number | null;
    costTotalAmount: number | null;
    observation: string | null;
  }>;
};

function str(value: unknown) {
  return String(value || "").trim();
}

function parseNumeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = str(value);
  if (!raw) return null;

  const normalized = raw.includes(",") && raw.includes(".")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.includes(",")
      ? raw.replace(",", ".")
      : raw;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUnit(value: unknown) {
  const normalized = str(value).toUpperCase();
  return normalized || null;
}

function extractJsonPayloadFromText(value: string) {
  const raw = str(value);
  if (!raw) return "";

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBraceIndex = raw.indexOf("{");
  const lastBraceIndex = raw.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return raw.slice(firstBraceIndex, lastBraceIndex + 1).trim();
  }

  return raw;
}

function parseFlexibleDate(value: unknown) {
  const raw = str(value);
  if (!raw) return null;

  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = match;
  const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseVisionResponse(value: string): ParsedVisionPayload {
  const jsonPayload = extractJsonPayloadFromText(value);
  if (!jsonPayload) throw new Error("Cole a resposta JSON do ChatGPT.");

  const parsed = JSON.parse(jsonPayload);
  const document = parsed?.document && typeof parsed.document === "object" ? parsed.document : {};
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];

  const normalizedLines = lines
    .map((line: any, index: number) => ({
      rowNumber: Number(line?.rowNumber || index + 1),
      movementAt: str(line?.movementAt || document?.movementAt) || null,
      invoiceNumber: str(line?.invoiceNumber || document?.invoiceNumber) || null,
      supplierName: str(line?.supplierName || document?.supplierName) || null,
      supplierCnpj: str(line?.supplierCnpj || document?.supplierCnpj) || null,
      ingredientName: str(line?.ingredientName),
      qtyEntry: parseNumeric(line?.qtyEntry),
      unitEntry: normalizeUnit(line?.unitEntry),
      qtyConsumption: parseNumeric(line?.qtyConsumption),
      unitConsumption: normalizeUnit(line?.unitConsumption),
      movementUnit: normalizeUnit(line?.movementUnit || line?.unitEntry || line?.unitConsumption),
      costAmount: parseNumeric(line?.costAmount),
      costTotalAmount: parseNumeric(line?.costTotalAmount),
      observation: str(line?.observation) || null,
    }))
    .filter((line) => line.ingredientName);

  if (normalizedLines.length === 0) {
    throw new Error("Nenhuma linha válida encontrada em lines.");
  }

  return {
    document: {
      supplierName: str(document?.supplierName) || null,
      supplierCnpj: str(document?.supplierCnpj) || null,
      invoiceNumber: str(document?.invoiceNumber) || null,
      movementAt: str(document?.movementAt) || null,
      notes: str(document?.notes) || null,
    },
    lines: normalizedLines,
  };
}

function buildStockPhotoPrompt() {
  const responseTemplate = {
    document: {
      supplierName: "nome do fornecedor",
      supplierCnpj: "00.000.000/0000-00",
      invoiceNumber: "12345",
      movementAt: "2026-03-21",
      notes: "observacoes curtas opcionais",
    },
    lines: [
      {
        rowNumber: 1,
        ingredientName: "MUSSARELA",
        qtyEntry: 4,
        unitEntry: "KG",
        costAmount: 42.5,
        costTotalAmount: 170,
        observation: "campo opcional",
      },
    ],
  };

  return [
    "Voce esta lendo foto de cupom fiscal ou nota fiscal de entrada de estoque para o sistema Amodomio.",
    "Analise as imagens que vou anexar nesta conversa.",
    "Responda somente com um bloco ```json``` valido, sem texto antes ou depois.",
    "Extraia apenas itens de entrada de estoque comprados do fornecedor.",
    "Nao invente linhas, nao estime quantidades ilegiveis e nao mapeie nomes para o sistema interno.",
    "Copie o nome do ingrediente/produto o mais proximo possivel do documento.",
    "Use ponto para decimais no JSON.",
    "movementAt deve ser a data da entrada ou emissao da NF em formato YYYY-MM-DD quando visivel.",
    "invoiceNumber deve conter somente o numero identificado da NF/cupom quando visivel.",
    "supplierName e supplierCnpj devem ficar no objeto document e podem ser repetidos por linha apenas se necessario.",
    "qtyEntry e costAmount devem ser numericos.",
    "costAmount significa custo unitario por unitEntry.",
    "costTotalAmount significa total da linha quando visivel; se nao estiver claro, use null.",
    "Se uma informacao nao estiver legivel, use null.",
    "Nao inclua chaves extras.",
    "",
    "FORMATO_OBRIGATORIO_DA_RESPOSTA",
    JSON.stringify(responseTemplate, null, 2),
  ].join("\n");
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const actionName = str(formData.get("_action"));
    const chatGptResponse = str(formData.get("chatGptResponse"));

    if (!chatGptResponse) return badRequest("Cole a resposta do ChatGPT.");

    const parsed = parseVisionResponse(chatGptResponse);

    if (actionName === "stock-photo-preview") {
      const missingInvoiceCount = parsed.lines.filter((line) => !line.invoiceNumber).length;
      const missingDateCount = parsed.lines.filter((line) => !line.movementAt).length;
      const missingCostCount = parsed.lines.filter((line) => !(Number(line.costAmount) > 0)).length;

      return ok({
        document: parsed.document,
        summary: {
          lines: parsed.lines.length,
          missingInvoiceCount,
          missingDateCount,
          missingCostCount,
        },
        previewLines: parsed.lines.slice(0, 8),
      });
    }

    if (actionName === "stock-photo-import") {
      const user = await authenticator.isAuthenticated(request);
      const actor = (user as any)?.email || (user as any)?.displayName || (user as any)?.name || null;
      const movementAt = parseFlexibleDate(parsed.document.movementAt);
      const batchLabelDate =
        movementAt?.toLocaleDateString("pt-BR") || new Date().toLocaleDateString("pt-BR");

      const result = await createStockNfImportBatchFromVisionPayload({
        batchName: `Entrada por foto ${parsed.document.invoiceNumber || batchLabelDate}`,
        uploadedBy: actor,
        originalFileName: "chatgpt-photo-import.json",
        worksheetName: "chatgpt-vision",
        notes: parsed.document.notes || "Lote criado no mobile a partir de foto analisada pelo ChatGPT.",
        movementAt,
        invoiceNumber: parsed.document.invoiceNumber,
        supplierName: parsed.document.supplierName,
        supplierCnpj: parsed.document.supplierCnpj,
        lines: parsed.lines.map((line) => ({
          rowNumber: line.rowNumber,
          movementAt: parseFlexibleDate(line.movementAt),
          invoiceNumber: line.invoiceNumber,
          supplierName: line.supplierName,
          supplierCnpj: line.supplierCnpj,
          ingredientName: line.ingredientName,
          qtyEntry: line.qtyEntry,
          unitEntry: line.unitEntry,
          qtyConsumption: line.qtyConsumption,
          unitConsumption: line.unitConsumption,
          movementUnit: line.movementUnit,
          costAmount: line.costAmount,
          costTotalAmount: line.costTotalAmount,
          observation: line.observation,
          rawData: {
            source: "chatgpt-vision",
            line,
            document: parsed.document,
          },
        })),
      });

      return redirect(`/admin/import-stock-nf/${result.batchId}`);
    }

    return badRequest("Ação inválida.");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminMobileEntradaEstoqueFotoPage() {
  const actionData = useActionData<typeof action>();
  const previewFetcher = useFetcher<any>();
  const [promptDraft, setPromptDraft] = useState("");
  const [chatGptResponse, setChatGptResponse] = useState("");
  const [lastPreviewedResponse, setLastPreviewedResponse] = useState("");
  const defaultPrompt = useMemo(() => buildStockPhotoPrompt(), []);

  useEffect(() => {
    setPromptDraft(defaultPrompt);
  }, [defaultPrompt]);

  useEffect(() => {
    if (previewFetcher.state === "idle" && previewFetcher.data?.status === 200) {
      setLastPreviewedResponse(chatGptResponse.trim());
    }
  }, [previewFetcher.state, previewFetcher.data, chatGptResponse]);

  const previewPayload = previewFetcher.data?.payload;
  const hasUpToDatePreview =
    Boolean(chatGptResponse.trim()) &&
    lastPreviewedResponse === chatGptResponse.trim() &&
    previewFetcher.data?.status === 200;

  const handlePreviewImport = () => {
    const formData = new FormData();
    formData.set("_action", "stock-photo-preview");
    formData.set("chatGptResponse", chatGptResponse);
    previewFetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Imagem
        </div>
      </div>

      <section className="space-y-3">
        <label className="block">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="mt-2 block w-full text-base text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
          />
        </label>
      </section>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          ChatGPT
        </div>
      </div>

      <section className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <CopyButton
            textToCopy={promptDraft}
            label="Copiar prompt"
            variant="default"
            classNameButton="h-12 w-full rounded-lg bg-slate-950 px-4 hover:bg-slate-800"
            classNameLabel="text-base font-medium text-white"
            classNameIcon="text-white"
            toastTitle="Prompt copiado"
            toastContent="Cole no ChatGPT e anexe as fotos."
          />
          <a
            href={CHATGPT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-slate-700"
          >
            Abrir ChatGPT
          </a>
        </div>

        <details className="rounded-md bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-base font-medium text-slate-800">
            Prompt curto
          </summary>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Leia as imagens anexadas e retorne apenas um bloco ```json``` com
            `document` e `lines`, sem texto extra. Em `document`, informe
            `supplierName`, `supplierCnpj`, `invoiceNumber`, `movementAt` (YYYY-MM-DD)
            e `notes`. Em `lines`, liste os itens comprados com
            `rowNumber`, `ingredientName`, `qtyEntry`, `unitEntry`, `costAmount`,
            `costTotalAmount` e `observation`. Use `null` para o que estiver ilegível.
          </p>

          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-slate-500">Editar prompt completo</span>
              <button
                type="button"
                className="text-sm font-medium text-slate-600"
                onClick={() => setPromptDraft(defaultPrompt)}
              >
                Restaurar
              </button>
            </div>
            <textarea
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              className="min-h-[180px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-[12px] leading-5 text-slate-800 outline-none"
            />
          </div>
        </details>
      </section>

      <Form method="post" className="space-y-3">
        <input type="hidden" name="_action" value="stock-photo-import" />
        <textarea
          name="chatGptResponse"
          value={chatGptResponse}
          onChange={(event) => setChatGptResponse(event.target.value)}
          placeholder="Cole aqui o JSON do ChatGPT."
          className="min-h-[220px] w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-700 outline-none"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewImport}
            disabled={!chatGptResponse.trim() || previewFetcher.state !== "idle"}
            className="h-10 flex-1"
          >
            {previewFetcher.state !== "idle" ? "Validando..." : "Validar"}
          </Button>
          <Button type="submit" disabled={!hasUpToDatePreview} className="h-10 flex-1">
            Criar lote
          </Button>
        </div>
      </Form>

      {previewPayload ? (
        <section className="space-y-2 text-base text-slate-700">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{previewPayload.summary?.lines || 0} linha(s)</span>
            <span>{previewPayload.summary?.missingInvoiceCount || 0} sem NF</span>
            <span>{previewPayload.summary?.missingDateCount || 0} sem data</span>
            <span>{previewPayload.summary?.missingCostCount || 0} sem custo</span>
          </div>
          <div className="text-sm text-slate-500">
            {previewPayload.document?.supplierName || "-"} • NF {previewPayload.document?.invoiceNumber || "-"} • {previewPayload.document?.movementAt || "-"}
          </div>
          {hasUpToDatePreview && previewPayload.previewLines?.length > 0 ? (
            <div className="space-y-2 pt-1">
              {previewPayload.previewLines.map((line: any) => (
                <div key={`${line.rowNumber}-${line.ingredientName}`} className="text-base">
                  <div className="font-medium text-slate-900">{line.ingredientName}</div>
                  <div className="text-sm text-slate-500">
                    {line.qtyEntry ?? "-"} {line.unitEntry || line.movementUnit || ""} • {line.costAmount ?? "-"} por unidade
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {previewFetcher.data?.status && previewFetcher.data.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {previewFetcher.data.message}
        </div>
      ) : null}

      {actionData?.status && actionData.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.message}
        </div>
      ) : null}
    </div>
  );
}
