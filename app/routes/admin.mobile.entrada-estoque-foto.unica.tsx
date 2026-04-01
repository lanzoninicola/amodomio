import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { createStockMovementImportBatchFromVisionPayload } from "~/domain/stock-movement/stock-movement-import.server";
import {
  DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL,
  STOCK_PHOTO_CHATGPT_PROMPT_SETTING_NAME,
  STOCK_PHOTO_CHATGPT_RETURN_URL_SETTING_NAME,
  STOCK_PHOTO_CHATGPT_SETTINGS_CONTEXT,
  DEFAULT_STOCK_PHOTO_CHATGPT_PROMPT_TEMPLATE,
} from "~/domain/stock-movement/stock-photo-chatgpt-settings";
import {
  buildStockPhotoPrompt,
  formatDateInputValue,
  parseFlexibleDate,
  parseVisionResponse,
  str,
} from "~/domain/stock-movement/stock-photo-chatgpt";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
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
    const [suppliers, promptSetting, returnUrlSetting] = await Promise.all([
      supplierPrismaEntity.findAll(),
      prismaClient.setting.findFirst({
        where: { context: STOCK_PHOTO_CHATGPT_SETTINGS_CONTEXT, name: STOCK_PHOTO_CHATGPT_PROMPT_SETTING_NAME },
        orderBy: [{ createdAt: "desc" }],
      }),
      prismaClient.setting.findFirst({
        where: { context: STOCK_PHOTO_CHATGPT_SETTINGS_CONTEXT, name: STOCK_PHOTO_CHATGPT_RETURN_URL_SETTING_NAME },
        orderBy: [{ createdAt: "desc" }],
      }),
    ]);

    return ok({
      suppliers,
      promptTemplate: String(promptSetting?.value || DEFAULT_STOCK_PHOTO_CHATGPT_PROMPT_TEMPLATE),
      returnUrl:
        String(returnUrlSetting?.value || "").trim() ||
        `${url.origin}/admin/mobile/entrada-estoque-foto/unica` ||
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
    const selectedSupplierName = str(formData.get("supplierName")) || null;
    const manualMovementAt = parseFlexibleDate(formData.get("manualMovementAt"));

    if (actionName === "supplier-quick-create") {
      const name = str(formData.get("name"));
      if (!name) return badRequest("Informe o nome do fornecedor.");
      const created = await supplierPrismaEntity.create({ name });
      return ok({
        message: "Fornecedor criado com sucesso.",
        supplier: { id: created.id, name: created.name, cnpj: created.cnpj },
      });
    }

    if (!chatGptResponse) return badRequest("Cole a resposta do ChatGPT.");

    const parsed = parseVisionResponse(chatGptResponse);
    const resolvedDocumentMovementAt = manualMovementAt || parseFlexibleDate(parsed.document.movementAt);
    const resolvedLines = parsed.lines.map((line) => ({
      ...line,
      movementAt: manualMovementAt
        ? manualMovementAt.toISOString()
        : line.movementAt || parsed.document.movementAt || null,
    }));

    if (actionName === "stock-photo-preview") {
      const missingInvoiceCount = resolvedLines.filter((line) => !line.invoiceNumber).length;
      const missingDateCount = resolvedLines.filter((line) => !line.movementAt).length;
      const missingCostCount = resolvedLines.filter((line) => !(Number(line.costAmount) > 0)).length;

      return ok({
        document: {
          ...parsed.document,
          movementAt: resolvedDocumentMovementAt ? formatDateInputValue(resolvedDocumentMovementAt) : null,
        },
        summary: { lines: resolvedLines.length, missingInvoiceCount, missingDateCount, missingCostCount },
        previewLines: resolvedLines.slice(0, 8),
      });
    }

    if (actionName === "stock-photo-import") {
      const user = await authenticator.isAuthenticated(request);
      const actor = (user as any)?.email || (user as any)?.displayName || (user as any)?.name || null;
      const movementAt = resolvedDocumentMovementAt;
      const batchLabelDate = movementAt?.toLocaleDateString("pt-BR") || new Date().toLocaleDateString("pt-BR");
      const batchSupplierName = selectedSupplierName || parsed.document.supplierName || "sem fornecedor";

      const result = await createStockMovementImportBatchFromVisionPayload({
        batchName: `Cupom fiscal ${batchSupplierName} ${batchLabelDate}`,
        uploadedBy: actor,
        originalFileName: "chatgpt-photo-import.json",
        worksheetName: "chatgpt-vision",
        notes: parsed.document.notes || "Lote criado no mobile a partir de foto analisada pelo ChatGPT.",
        movementAt,
        invoiceNumber: parsed.document.invoiceNumber,
        supplierName: selectedSupplierName || parsed.document.supplierName,
        supplierCnpj: parsed.document.supplierCnpj,
        lines: resolvedLines.map((line) => ({
          rowNumber: line.rowNumber,
          movementAt: parseFlexibleDate(line.movementAt),
          invoiceNumber: line.invoiceNumber,
          supplierName: selectedSupplierName || line.supplierName,
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
          rawData: { source: "chatgpt-vision", line, document: parsed.document },
        })),
      });

      return redirect(`/admin/import-stock-movements/${result.batchId}`);
    }

    return badRequest("Ação inválida.");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminMobileEntradaEstoqueFotoUnicaPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const previewFetcher = useFetcher<any>();
  const supplierFetcher = useFetcher<any>();
  const payload = data.payload as any;
  const suppliers = payload.suppliers || [];
  const returnUrl = String(payload.returnUrl || "").trim() || DEFAULT_STOCK_PHOTO_CHATGPT_RETURN_URL;
  const promptTemplate = String(payload.promptTemplate || "").trim() || DEFAULT_STOCK_PHOTO_CHATGPT_PROMPT_TEMPLATE;
  const [promptDraft, setPromptDraft] = useState("");
  const [chatGptResponse, setChatGptResponse] = useState("");
  const [lastPreviewedSignature, setLastPreviewedSignature] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [manualMovementAt, setManualMovementAt] = useState("");
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const createdSupplier = supplierFetcher.data?.payload?.supplier;

  const supplierOptions: SearchableSelectOption[] = [
    ...suppliers.map((supplier: any) => ({
      value: supplier.name,
      label: supplier.name,
      searchText: [supplier.name, supplier.cnpj || ""].filter(Boolean).join(" "),
    })),
    ...(createdSupplier && !suppliers.some((s: any) => s.name === createdSupplier.name)
      ? [{ value: createdSupplier.name, label: createdSupplier.name, searchText: createdSupplier.name }]
      : []),
  ];

  const selectedSupplier = [...suppliers, ...(createdSupplier ? [createdSupplier] : [])].find(
    (s: any) => s.name === supplierName,
  ) || null;

  const defaultPrompt = useMemo(
    () => buildStockPhotoPrompt({ supplierName: supplierName || null, supplierCnpj: selectedSupplier?.cnpj || null, returnUrl, promptTemplate }),
    [supplierName, selectedSupplier?.cnpj, returnUrl, promptTemplate],
  );

  useEffect(() => { setPromptDraft(defaultPrompt); }, [defaultPrompt]);

  const currentPreviewSignature = `${chatGptResponse.trim()}::${manualMovementAt}`;

  useEffect(() => {
    if (previewFetcher.state === "idle" && previewFetcher.data?.status === 200) {
      setLastPreviewedSignature(currentPreviewSignature);
    }
  }, [currentPreviewSignature, previewFetcher.state, previewFetcher.data]);

  useEffect(() => {
    if (createdSupplier?.name) {
      setSupplierName(createdSupplier.name);
      setQuickSupplierName("");
      setQuickSupplierOpen(false);
    }
  }, [createdSupplier]);

  const previewPayload = previewFetcher.data?.payload;
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
      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fornecedor</div>
      </div>

      <section className="space-y-3">
        <SearchableSelect
          value={supplierName}
          onValueChange={setSupplierName}
          options={supplierOptions}
          placeholder="Selecionar fornecedor"
          searchPlaceholder="Buscar fornecedor..."
          emptyText="Nenhum fornecedor encontrado."
          triggerClassName="h-12 w-full max-w-none justify-between rounded-lg border-slate-300 px-4 text-base"
          contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
        />

        <Collapsible open={quickSupplierOpen} onOpenChange={setQuickSupplierOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left"
            >
              <div className="text-base font-medium text-slate-900">Adicionar fornecedor rapido</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 transition data-[state=open]:rotate-90">
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <supplierFetcher.Form method="post" className="space-y-3">
              <input type="hidden" name="_action" value="supplier-quick-create" />
              <Input
                name="name"
                value={quickSupplierName}
                onChange={(e) => setQuickSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
                className="h-12 text-base"
              />
              <Button type="submit" variant="outline" className="h-12 w-full text-base" disabled={supplierFetcher.state !== "idle"}>
                {supplierFetcher.state !== "idle" ? "Salvando..." : "Cadastrar fornecedor"}
              </Button>
            </supplierFetcher.Form>
          </CollapsibleContent>
        </Collapsible>
      </section>

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
            toastContent="Cole no ChatGPT e anexe a foto do cupom."
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
            <div className="text-base font-medium text-slate-900">Prompt curto</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 transition group-open:rotate-90">
              <ChevronRight className="h-4 w-4" />
            </div>
          </summary>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Leia a imagem anexada e retorne apenas um bloco <code>```json```</code> com{" "}
            <code>document</code> e <code>lines</code>, sem texto extra. Em <code>document</code>,
            informe <code>supplierName</code>, <code>supplierCnpj</code>, <code>invoiceNumber</code>,{" "}
            <code>movementAt</code> (YYYY-MM-DD) e <code>notes</code>. Em <code>lines</code>, liste
            os itens com <code>rowNumber</code>, <code>ingredientName</code>, <code>qtyEntry</code>,{" "}
            <code>unitEntry</code>, <code>costAmount</code>, <code>costTotalAmount</code> e{" "}
            <code>observation</code>. Use <code>null</code> para o que estiver ilegível.
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
        <input type="hidden" name="supplierName" value={supplierName} />
        <div className="space-y-2">
          <label htmlFor="manualMovementAt" className="block text-sm font-medium text-slate-700">
            Data efetiva do movimento
          </label>
          <Input
            id="manualMovementAt"
            name="manualMovementAt"
            type="date"
            value={manualMovementAt}
            onChange={(e) => setManualMovementAt(e.currentTarget.value)}
          />
          <p className="text-xs leading-5 text-slate-500">
            Use este campo quando o cupom for de dias ou semanas anteriores. Se preenchido,
            esta data prevalece sobre a data lida pelo ChatGPT.
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
            Criar lote
          </Button>
        </div>
      </Form>

      {previewPayload ? (
        <Collapsible className="rounded-md bg-slate-50 px-3 py-2">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between gap-3 text-left">
              <div>
                <div className="text-base font-medium text-slate-900">Preview</div>
                <div className="text-sm text-slate-500">{previewPayload.summary?.lines || 0} linha(s)</div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 transition data-[state=open]:rotate-90">
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-3 text-base text-slate-700">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{previewPayload.summary?.lines || 0} linha(s)</span>
              <span>{previewPayload.summary?.missingInvoiceCount || 0} sem NF</span>
              <span>{previewPayload.summary?.missingDateCount || 0} sem data</span>
              <span>{previewPayload.summary?.missingCostCount || 0} sem custo</span>
            </div>
            <div className="text-sm text-slate-500">
              {previewPayload.document?.supplierName || "-"} • Doc.{" "}
              {previewPayload.document?.invoiceNumber || "-"} •{" "}
              {previewPayload.document?.movementAt || "-"}
            </div>
            {previewPayload.previewLines?.length > 0 ? (
              <div className="space-y-2 pt-1">
                {previewPayload.previewLines.map((line: any) => (
                  <div key={`${line.rowNumber}-${line.ingredientName}`} className="text-base">
                    <div className="font-medium text-slate-900">{line.ingredientName}</div>
                    <div className="text-sm text-slate-500">
                      {line.qtyEntry ?? "-"} {line.unitEntry || line.movementUnit || ""} •{" "}
                      {line.costAmount ?? "-"} por unidade • {line.movementAt || "sem data"}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {previewFetcher.data?.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {previewFetcher.data.message}
        </div>
      ) : null}

      {actionData?.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.message}
        </div>
      ) : null}
    </div>
  );
}
