import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { createStockMovementImportBatchFromVisionPayload } from "~/domain/stock-movement/stock-movement-import.server";
import {
  DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL,
  DEFAULT_STOCK_PHOTO_MULTI_CHATGPT_PROMPT_TEMPLATE,
  STOCK_PHOTO_CHATGPT_MULTI_PROMPT_SETTING_NAME,
  STOCK_PHOTO_CHATGPT_RETURN_URL_SETTING_NAME,
  STOCK_PHOTO_CHATGPT_SETTINGS_CONTEXT,
} from "~/domain/stock-movement/stock-photo-chatgpt-settings";
import {
  buildMultiStockPhotoPrompt,
  formatDateInputValue,
  groupLinesBySupplier,
  parseFlexibleDate,
  parseVisionResponse,
  str,
} from "~/domain/stock-movement/stock-photo-chatgpt";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const CHATGPT_URL = "https://chatgpt.com/";

function ChatGptLogoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"
      />
    </svg>
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const [multiPromptSetting, returnUrlSetting] = await Promise.all([
      prismaClient.setting.findFirst({
        where: { context: STOCK_PHOTO_CHATGPT_SETTINGS_CONTEXT, name: STOCK_PHOTO_CHATGPT_MULTI_PROMPT_SETTING_NAME },
        orderBy: [{ createdAt: "desc" }],
      }),
      prismaClient.setting.findFirst({
        where: { context: STOCK_PHOTO_CHATGPT_SETTINGS_CONTEXT, name: STOCK_PHOTO_CHATGPT_RETURN_URL_SETTING_NAME },
        orderBy: [{ createdAt: "desc" }],
      }),
    ]);

    return ok({
      promptTemplate: String(multiPromptSetting?.value || DEFAULT_STOCK_PHOTO_MULTI_CHATGPT_PROMPT_TEMPLATE),
      returnUrl:
        String(returnUrlSetting?.value || "").trim() ||
        `${url.origin}/admin/mobile/entrada-estoque-foto/multipla` ||
        DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const actionName = str(formData.get("_action"));
    const chatGptResponse = str(formData.get("chatGptResponse"));
    const manualMovementAt = parseFlexibleDate(formData.get("manualMovementAt"));

    if (!chatGptResponse) return badRequest("Cole a resposta do ChatGPT.");

    const parsed = parseVisionResponse(chatGptResponse);
    const resolvedLines = parsed.lines.map((line) => ({
      ...line,
      movementAt: manualMovementAt
        ? manualMovementAt.toISOString()
        : line.movementAt || parsed.document.movementAt || null,
    }));

    const groups = groupLinesBySupplier(resolvedLines, parsed.document);

    if (actionName === "stock-photo-preview") {
      const groupsPreview = groups.map((group) => ({
        supplierName: group.supplierName,
        supplierCnpj: group.supplierCnpj,
        invoiceNumber: group.invoiceNumber,
        movementAt: group.movementAt
          ? formatDateInputValue(parseFlexibleDate(group.movementAt) || (manualMovementAt ?? null))
          : manualMovementAt
            ? formatDateInputValue(manualMovementAt)
            : null,
        lineCount: group.lines.length,
        missingCostCount: group.lines.filter((l) => !(Number(l.costAmount) > 0)).length,
        previewLines: group.lines.slice(0, 4),
      }));

      return ok({
        totalLines: resolvedLines.length,
        groupCount: groups.length,
        groups: groupsPreview,
      });
    }

    if (actionName === "stock-photo-import") {
      const user = await authenticator.isAuthenticated(request);
      const actor = (user as any)?.email || (user as any)?.displayName || (user as any)?.name || null;

      const batches = await Promise.all(
        groups.map(async (group) => {
          const groupMovementAt =
            manualMovementAt ||
            parseFlexibleDate(group.movementAt) ||
            parseFlexibleDate(parsed.document.movementAt);
          const batchLabelDate =
            groupMovementAt?.toLocaleDateString("pt-BR") || new Date().toLocaleDateString("pt-BR");

          const result = await createStockMovementImportBatchFromVisionPayload({
            batchName: `Cupom fiscal ${group.supplierName} ${batchLabelDate}`,
            uploadedBy: actor,
            originalFileName: "chatgpt-multi-photo-import.json",
            worksheetName: "chatgpt-vision-multi",
            notes: parsed.document.notes || "Lote criado no mobile a partir de múltiplos cupons analisados pelo ChatGPT.",
            movementAt: groupMovementAt,
            invoiceNumber: group.invoiceNumber,
            supplierName: group.supplierName,
            supplierCnpj: group.supplierCnpj,
            lines: group.lines.map((line) => ({
              rowNumber: line.rowNumber,
              movementAt: manualMovementAt || parseFlexibleDate(line.movementAt),
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
              rawData: { source: "chatgpt-vision-multi", line, document: parsed.document },
            })),
          });

          return {
            batchId: result.batchId,
            supplierName: group.supplierName,
            lineCount: group.lines.length,
          };
        }),
      );

      return ok({ batches });
    }

    return badRequest("Ação inválida.");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminMobileEntradaEstoqueFotoMultiplaPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const previewFetcher = useFetcher<any>();
  const payload = data.payload as any;
  const returnUrl = String(payload.returnUrl || "").trim() || DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL;
  const promptTemplate = String(payload.promptTemplate || "").trim() || DEFAULT_STOCK_PHOTO_MULTI_CHATGPT_PROMPT_TEMPLATE;

  const [promptDraft, setPromptDraft] = useState(
    () => buildMultiStockPhotoPrompt({ returnUrl, promptTemplate }),
  );
  const [chatGptResponse, setChatGptResponse] = useState("");
  const [lastPreviewedSignature, setLastPreviewedSignature] = useState("");
  const [manualMovementAt, setManualMovementAt] = useState("");

  const defaultPrompt = buildMultiStockPhotoPrompt({ returnUrl, promptTemplate });
  const currentPreviewSignature = `${chatGptResponse.trim()}::${manualMovementAt}`;

  useEffect(() => {
    if (previewFetcher.state === "idle" && previewFetcher.data?.status === 200) {
      setLastPreviewedSignature(currentPreviewSignature);
    }
  }, [currentPreviewSignature, previewFetcher.state, previewFetcher.data]);

  const previewPayload = previewFetcher.data?.payload;
  const importedBatches = (actionData as any)?.payload?.batches as Array<{
    batchId: string;
    supplierName: string;
    lineCount: number;
  }> | undefined;

  const hasUpToDatePreview =
    Boolean(chatGptResponse.trim()) &&
    lastPreviewedSignature === currentPreviewSignature &&
    previewFetcher.data?.status === 200;

  const validationStatus =
    previewFetcher.state !== "idle"
      ? "loading"
      : previewFetcher.data?.status === 200
        ? "success"
        : previewFetcher.data?.status >= 400
          ? "error"
          : "idle";

  const handlePreviewImport = () => {
    const formData = new FormData();
    formData.set("_action", "stock-photo-preview");
    formData.set("chatGptResponse", chatGptResponse);
    formData.set("manualMovementAt", manualMovementAt);
    previewFetcher.submit(formData, { method: "post" });
  };

  const handlePasteResponse = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return;
    const text = await navigator.clipboard.readText();
    if (text) setChatGptResponse(text);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
        Anexe quantos cupons quiser no ChatGPT. O sistema lê o fornecedor impresso em cada cupom
        e cria um lote separado por fornecedor automaticamente.
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">ChatGPT</div>
      </div>

      <section className="space-y-2">
        <div className="grid grid-cols-4 gap-2">
          <CopyButton
            textToCopy={promptDraft}
            label="Copiar prompt"
            variant="default"
            classNameButton="col-span-3 h-12 w-full rounded-lg bg-slate-950 px-4 hover:bg-slate-800"
            classNameLabel="text-base font-medium text-white"
            classNameIcon="text-white"
            toastTitle="Prompt copiado"
            toastContent="Cole no ChatGPT e anexe todos os cupons."
          />
          <a
            href={CHATGPT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700"
            aria-label="Abrir ChatGPT"
            title="Abrir ChatGPT"
          >
            <ChatGptLogoIcon />
          </a>
        </div>

        <details className="group rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div className="text-base font-medium text-slate-900">Editar prompt</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 transition group-open:rotate-90">
              <ChevronRight className="h-4 w-4" />
            </div>
          </summary>
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-slate-500">Prompt completo</span>
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
              onChange={(e) => setPromptDraft(e.target.value)}
              className="min-h-[180px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-[12px] leading-5 text-slate-800 outline-none"
            />
          </div>
        </details>
      </section>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Colar</div>
        <Button type="button" variant="outline" onClick={handlePasteResponse} className="h-12 px-5 text-base">
          Colar
        </Button>
      </div>

      <Form method="post" className="space-y-3">
        <input type="hidden" name="_action" value="stock-photo-import" />
        <div className="space-y-2">
          <label htmlFor="manualMovementAtMulti" className="block text-sm font-medium text-slate-700">
            Data efetiva do movimento
          </label>
          <Input
            id="manualMovementAtMulti"
            name="manualMovementAt"
            type="date"
            value={manualMovementAt}
            onChange={(e) => setManualMovementAt(e.currentTarget.value)}
          />
          <p className="text-xs leading-5 text-slate-500">
            Opcional. Se preenchida, prevalece sobre as datas lidas nos cupons para todos os lotes.
          </p>
        </div>
        <textarea
          name="chatGptResponse"
          value={chatGptResponse}
          onChange={(e) => setChatGptResponse(e.target.value)}
          placeholder="Cole aqui o JSON do ChatGPT."
          className="min-h-[220px] w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-700 outline-none"
        />

        <div className="border-t border-slate-200 pt-3" />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewImport}
            disabled={!chatGptResponse.trim() || previewFetcher.state !== "idle"}
            className="h-10 flex-1"
          >
            <span className="flex items-center gap-2">
              {validationStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {validationStatus === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
              {validationStatus === "error" ? <AlertCircle className="h-4 w-4 text-red-600" /> : null}
              <span>{previewFetcher.state !== "idle" ? "Validando..." : "Validar"}</span>
            </span>
          </Button>
          <Button type="submit" disabled={!hasUpToDatePreview} className="h-10 flex-1">
            Criar lotes
          </Button>
        </div>
      </Form>

      {/* Preview agrupado por fornecedor */}
      {previewPayload ? (
        <div className="space-y-2">
          <div className="text-sm text-slate-500">
            {previewPayload.totalLines || 0} linha(s) em {previewPayload.groupCount || 0} fornecedor(es)
          </div>
          {previewPayload.groups?.map((group: any) => (
            <Collapsible key={group.supplierName} className="rounded-md bg-slate-50 px-3 py-2">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between gap-3 text-left">
                  <div>
                    <div className="text-base font-medium text-slate-900">{group.supplierName}</div>
                    <div className="text-sm text-slate-500">
                      {group.lineCount} item(s) • NF {group.invoiceNumber || "-"} • {group.movementAt || "-"}
                      {group.missingCostCount > 0 ? ` • ${group.missingCostCount} sem custo` : ""}
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 transition data-[state=open]:rotate-90">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-3 text-base text-slate-700">
                {group.previewLines?.map((line: any) => (
                  <div key={`${line.rowNumber}-${line.ingredientName}`}>
                    <div className="font-medium text-slate-900">{line.ingredientName}</div>
                    <div className="text-sm text-slate-500">
                      {line.qtyEntry ?? "-"} {line.unitEntry || line.movementUnit || ""} •{" "}
                      {line.costAmount ?? "-"} por unidade
                    </div>
                  </div>
                ))}
                {group.lineCount > 4 ? (
                  <div className="text-sm text-slate-400">+{group.lineCount - 4} item(s) não exibido(s)</div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      ) : null}

      {/* Resultado após importação — links para cada lote */}
      {importedBatches && importedBatches.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
          <div className="text-sm font-medium text-emerald-800">
            {importedBatches.length} lote(s) criado(s) com sucesso
          </div>
          {importedBatches.map((batch) => (
            <a
              key={batch.batchId}
              href={`/admin/import-stock-movements/${batch.batchId}`}
              className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-700"
            >
              <span className="font-medium">{batch.supplierName}</span>
              <span className="text-emerald-500">{batch.lineCount} item(s) →</span>
            </a>
          ))}
        </div>
      ) : null}

      {previewFetcher.data?.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {previewFetcher.data.message}
        </div>
      ) : null}

      {(actionData as any)?.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(actionData as any).message}
        </div>
      ) : null}
    </div>
  );
}
