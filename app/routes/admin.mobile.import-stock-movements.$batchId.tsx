import type { MetaFunction } from "@remix-run/node";
import { Form, Link, Outlet, useFetcher, useLoaderData, useOutlet } from "@remix-run/react";
import { CheckCircle2, ExternalLink, EyeOff, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PendingConversionForm } from "~/components/admin/import-stock-conversion-form";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";

export { action, loader } from "./admin.import-stock-movements.$batchId";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Lote de estoque" }];

const ITEM_CLASSIFICATIONS = [
  "insumo",
  "semi_acabado",
  "produto_final",
  "embalagem",
  "servico",
  "outro",
] as const;

function normalizeItemUnit(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function formatDate(value: any) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function formatMoney(value: any) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDocumentLabel(value: any) {
  const documentNumber = String(value || "").trim();
  if (!documentNumber) return "-";
  if (documentNumber.startsWith("CUPOM-")) return "Cupom fiscal";
  return documentNumber;
}

function capitalizeWords(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    ready: Number(summary?.ready || 0),
    readyToImport: Number(summary?.readyToImport || 0),
    invalid: Number(summary?.invalid || 0),
    pendingMapping: Number(summary?.pendingMapping || 0),
    pendingSupplier: Number(summary?.pendingSupplier || 0),
    pendingConversion: Number(summary?.pendingConversion || 0),
    imported: Number(summary?.imported || 0),
    ignored: Number(summary?.ignored || 0),
    skippedDuplicate: Number(summary?.skippedDuplicate || 0),
    error: Number(summary?.error || 0),
  };
}

function supplierReconciliationLabel(line: any) {
  if (line?.supplierReconciliationStatus === "manual") return "conciliado manualmente";
  if (line?.supplierReconciliationStatus === "matched" || line?.supplierId) return "conciliado com cadastro";
  if (line?.supplierReconciliationStatus === "unmatched") return "pendente de conciliação";
  return "sem conciliação iniciada";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "imported":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "pending_mapping":
    case "pending_supplier":
    case "pending_conversion":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "invalid":
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "skipped_duplicate":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "ignored":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "pending_mapping":
      return "Pend. vínculo";
    case "pending_supplier":
      return "Pend. fornecedor";
    case "pending_conversion":
      return "Pend. conversão";
    case "skipped_duplicate":
      return "Duplicada";
    case "ignored":
      return "Ignorada";
    case "invalid":
      return "Inválida";
    case "ready":
      return "Pronta";
    case "imported":
      return "Importada";
    default:
      return status || "-";
  }
}

function getLineSubtitle(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.toLowerCase() === "entrada por documento") return "";
  return normalized;
}

function MobileItemMapperCard({
  batchId,
  categories,
  items,
  line,
  unitOptions,
}: {
  batchId: string;
  categories: Array<{ id: string; name: string }>;
  items: any[];
  line: any;
  unitOptions: string[];
}) {
  const createItemFetcher = useFetcher<any>();
  const [selectedItemId, setSelectedItemId] = useState(String(line.mappedItemId || ""));
  const [applyToAllSameIngredient, setApplyToAllSameIngredient] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [classification, setClassification] = useState<(typeof ITEM_CLASSIFICATIONS)[number]>("insumo");
  const [categoryId, setCategoryId] = useState("__EMPTY__");
  const [consumptionUm, setConsumptionUm] = useState(() => {
    const normalizedUnit = normalizeItemUnit(line.movementUnit);
    return normalizedUnit && unitOptions.includes(normalizedUnit) ? normalizedUnit : "__EMPTY__";
  });

  useEffect(() => {
    setSelectedItemId(String(line.mappedItemId || ""));
  }, [line.mappedItemId]);

  useEffect(() => {
    if (createItemFetcher.state !== "idle") return;
    if (!createItemFetcher.data?.status) return;

    if (createItemFetcher.data.status >= 400) {
      toast({
        title: "Erro",
        description: createItemFetcher.data.message,
        variant: "destructive",
      });
      return;
    }

    const createdItemId = String(createItemFetcher.data?.payload?.createdItemId || "");
    if (createdItemId) {
      setSelectedItemId(createdItemId);
      setCreateDialogOpen(false);
      toast({
        title: "Ok",
        description: "Item criado e vinculado ao lote.",
      });
    }
  }, [createItemFetcher.data, createItemFetcher.state]);

  const selectedItem = items.find((item) => item.id === selectedItemId);
  const itemOptions: SearchableSelectOption[] = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: `${item.name} [${item.classification || "-"}] (${item.purchaseUm || item.consumptionUm || "-"})`,
        searchText: [item.name, item.classification || "", item.purchaseUm || "", item.consumptionUm || "", item.id]
          .filter(Boolean)
          .join(" "),
      })),
    [items],
  );

  return (
    <div className="space-y-3 border-b border-slate-200 pb-4">
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Vincular item</div>
        <SearchableSelect
          value={selectedItemId}
          onValueChange={setSelectedItemId}
          options={itemOptions}
          placeholder="Selecionar item do sistema"
          searchPlaceholder="Buscar item..."
          emptyText="Nenhum item encontrado."
          triggerClassName="h-11 w-full max-w-none justify-between rounded-xl border-slate-300 px-4 text-sm"
          contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={applyToAllSameIngredient}
          onChange={(event) => setApplyToAllSameIngredient(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        aplicar para ingredientes iguais neste lote
      </label>

      <Form method="post" className="space-y-2">
        <input type="hidden" name="_action" value="batch-map-item" />
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="lineId" value={line.id} />
        <input type="hidden" name="ingredientNameNormalized" value={line.ingredientNameNormalized || ""} />
        <input type="hidden" name="itemId" value={selectedItemId} />
        <input type="hidden" name="saveAlias" value="on" />
        {applyToAllSameIngredient ? <input type="hidden" name="applyToAllSameIngredient" value="on" /> : null}
        <Button type="submit" className="h-11 w-full rounded-xl" disabled={!selectedItemId}>
          Vincular item
        </Button>
      </Form>

      <div className="flex items-center gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="h-10 flex-1 rounded-xl">
              <Plus className="mr-1 h-4 w-4" />
              Novo item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Criar item</DialogTitle>
            </DialogHeader>

            <createItemFetcher.Form method="post" className="space-y-3">
              <input type="hidden" name="_action" value="batch-create-and-map-item" />
              <input type="hidden" name="batchId" value={batchId} />
              <input type="hidden" name="lineId" value={line.id} />
              <input type="hidden" name="ingredientNameNormalized" value={line.ingredientNameNormalized || ""} />
              <input type="hidden" name="classification" value={classification} />
              <input type="hidden" name="categoryId" value={categoryId === "__EMPTY__" ? "" : categoryId} />
              <input type="hidden" name="consumptionUm" value={consumptionUm === "__EMPTY__" ? "" : consumptionUm} />

              <div className="space-y-1">
                <Label htmlFor={`mobile-item-name-${line.id}`}>Nome do item</Label>
                <Input
                  id={`mobile-item-name-${line.id}`}
                  name="itemName"
                  defaultValue={capitalizeWords(line.ingredientName || "")}
                  placeholder="Nome do novo item"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`mobile-item-classification-${line.id}`}>Classificação</Label>
                <Select
                  value={classification}
                  onValueChange={(value) => setClassification(value as (typeof ITEM_CLASSIFICATIONS)[number])}
                >
                  <SelectTrigger id={`mobile-item-classification-${line.id}`} className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecione a classificação" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CLASSIFICATIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`mobile-item-unit-${line.id}`}>Unidade de medida</Label>
                <Select value={consumptionUm} onValueChange={setConsumptionUm}>
                  <SelectTrigger id={`mobile-item-unit-${line.id}`} className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecionar unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__EMPTY__">Selecionar...</SelectItem>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`mobile-item-category-${line.id}`}>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id={`mobile-item-category-${line.id}`} className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__EMPTY__">Sem categoria</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="h-11 w-full rounded-xl" disabled={createItemFetcher.state !== "idle"}>
                {createItemFetcher.state !== "idle" ? "Criando..." : "Criar e vincular"}
              </Button>
            </createItemFetcher.Form>
          </DialogContent>
        </Dialog>

        {selectedItem ? (
          <Link
            to={`/admin/items/${selectedItem.id}/main`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            <ExternalLink className="mr-1 h-4 w-4" />
            Abrir item
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminMobileImportStockMovementsBatchRoute() {
  const loaderData = useLoaderData<any>();
  const outlet = useOutlet();
  const payload = loaderData?.payload || {};
  const selected = payload.selected as any;
  const selectedBatch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const items = (selected?.items || []) as any[];
  const appliedChanges = (selected?.appliedChanges || []) as any[];
  const unitOptions = (payload.unitOptions || []) as string[];
  const categories = (payload.categories || []) as Array<{ id: string; name: string }>;
  const summary = summaryFromAny(selected?.summary || selectedBatch?.summary);
  const defaultFilter =
    summary.pendingMapping > 0
      ? "pending_mapping"
      : summary.pendingConversion > 0
        ? "pending_conversion"
        : summary.ready > 0
          ? "ready"
          : "all";
  const [statusFilter, setStatusFilter] = useState(defaultFilter);

  const availableStatuses = useMemo(
    () =>
      Array.from(new Set(lines.map((line) => String(line.status || "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [lines],
  );

  const filteredLines = useMemo(() => {
    if (statusFilter === "all") return lines;
    return lines.filter((line) => String(line.status || "") === statusFilter);
  }, [lines, statusFilter]);

  if (!selectedBatch) return null;
  if (outlet) return <Outlet />;

  return (
    <div className="space-y-5 pb-6">
      <section className="space-y-3 rounded-2xl  bg-white/90 px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-950">{selectedBatch.name}</h2>
            <Badge variant="outline" className={statusBadgeClass(String(selectedBatch.status))}>
              {selectedBatch.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{selectedBatch.originalFileName || "sem arquivo"}</p>
          <p className="text-xs text-slate-500">Aba: {selectedBatch.worksheetName || "-"}</p>
          <p className="text-xs text-slate-500">JSON fornecedor: {selectedBatch.supplierNotesFileName || "não anexado"}</p>
        </div>

        <div className="grid grid-cols-4 gap-x-3 gap-y-3">
          {[
            ["Total", summary.total],
            ["Pend.", summary.pendingMapping + summary.pendingConversion + summary.pendingSupplier],
            ["Prontas", summary.readyToImport],
            ["Ign.", summary.ignored],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-semibold text-slate-950">{value as any}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-x-3 gap-y-3">
          {[
            ["Vínculo", summary.pendingMapping],
            ["Fornecedor", summary.pendingSupplier],
            ["Conversão", summary.pendingConversion],
            ["Erros", summary.error + summary.invalid],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
              <div className="mt-1 text-base font-semibold text-slate-950">{value as any}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {summary.pendingSupplier > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Faltam {summary.pendingSupplier} registro(s) para conciliar com o fornecedor.
            </div>
          ) : null}

          <Button asChild variant="outline" className="h-11 w-full rounded-xl border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100">
            <Link to={`/admin/mobile/import-stock-movements/${selectedBatch.id}/supplier-reconciliation`}>
              Abrir conciliação de fornecedor
            </Link>
          </Button>

          <Form method="post">
            <input type="hidden" name="_action" value="batch-import" />
            <input type="hidden" name="batchId" value={selectedBatch.id} />
            <Button type="submit" className="h-11 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={summary.readyToImport <= 0}>
              Importar linhas conciliadas ({summary.readyToImport})
            </Button>
          </Form>

          {appliedChanges.length > 0 ? (
            <Form method="post">
              <input type="hidden" name="_action" value="batch-rollback" />
              <input type="hidden" name="batchId" value={selectedBatch.id} />
              <Button type="submit" variant="outline" className="h-11 w-full rounded-xl">
                Desfazer importação ({appliedChanges.length})
              </Button>
            </Form>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Linhas do lote</h3>
            <p className="text-xs text-slate-500">{filteredLines.length} de {lines.length} linha(s)</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold ${statusFilter === "all"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700"
              }`}
          >
            Todos
          </button>
          {availableStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold ${statusFilter === status
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-700"
                }`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredLines.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Nenhuma linha para o filtro selecionado.
            </div>
          ) : (
            filteredLines.map((line) => (
              <article key={line.id} className="space-y-3  p-3 rounded-lg bg-white/90 pb-5 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="text-left">
                          <h4 className="text-sm font-semibold text-slate-950">
                            <span className="mr-1 text-slate-500">[{line.rowNumber}]</span>
                            {line.ingredientName}
                          </h4>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-2xl">
                        <DialogHeader>
                          <DialogTitle>Detalhes da linha</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 text-sm">
                          <div className="border-b border-slate-200 pb-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Documento</div>
                            <div className="mt-1 text-slate-900">{formatDocumentLabel(line.invoiceNumber)}</div>
                            <div className="text-xs text-slate-500">{formatDate(line.movementAt)}</div>
                          </div>
                          <div className="border-b border-slate-200 pb-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Fornecedor</div>
                            <div className="mt-1 text-slate-900">{line.supplierName || "-"}</div>
                            <div className="text-xs text-slate-500">{line.supplierCnpj || "sem CNPJ"}</div>
                            <div className="text-xs text-slate-500">{supplierReconciliationLabel(line)}</div>
                          </div>
                          {line.supplierReconciliationSource || line.supplierMatchSource ? (
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Conciliação</div>
                              <div className="mt-1 text-slate-900">{line.supplierReconciliationSource || line.supplierMatchSource}</div>
                            </div>
                          ) : null}
                        </div>
                      </DialogContent>
                    </Dialog>
                    {getLineSubtitle(line.motivo) ? (
                      <p className="mt-1 text-xs text-slate-500">{getLineSubtitle(line.motivo)}</p>
                    ) : null}
                    {line.status === "pending_mapping" ? (
                      <div className="mt-2">
                        <Badge variant="outline" className={statusBadgeClass(String(line.status))}>
                          {getStatusLabel(String(line.status))}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {line.status !== "pending_mapping" ? (
                      <Badge variant="outline" className={statusBadgeClass(String(line.status))}>
                        {getStatusLabel(String(line.status))}
                      </Badge>
                    ) : null}
                    <Form method="post">
                      <input type="hidden" name="_action" value={line.status === "ignored" ? "batch-unignore-line" : "batch-ignore-line"} />
                      <input type="hidden" name="batchId" value={selectedBatch.id} />
                      <input type="hidden" name="lineId" value={line.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500">
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    </Form>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Entrada</div>
                    <div className="mt-1 text-slate-800">
                      {line.qtyEntry ?? "-"} {line.unitEntry || ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Consumo</div>
                    <div className="mt-1 text-slate-800">
                      {line.qtyConsumption ?? "-"} {line.unitConsumption || ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Custo</div>
                    <div className="mt-1 text-slate-800">
                      {formatMoney(line.costAmount)} / {line.movementUnit || "-"}
                    </div>
                    <div className="text-xs text-slate-500">total: {formatMoney(line.costTotalAmount)}</div>
                  </div>
                </div>

                {line.mappedItemName || line.mappedItemId ? (
                  <div className="border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Item do sistema
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{line.mappedItemName || line.mappedItemId}</div>
                    <div className="text-xs text-slate-500">{line.mappingSource || "-"}</div>
                  </div>
                ) : null}

                {line.status === "pending_mapping" ? (
                  <MobileItemMapperCard
                    batchId={selectedBatch.id}
                    categories={categories}
                    items={items}
                    line={line}
                    unitOptions={unitOptions}
                  />
                ) : null}

                <div className="border-b border-slate-200 pb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Conversão</div>
                  {line.status === "ignored" ? (
                    <div className="mt-1 text-sm text-slate-400">Linha ignorada</div>
                  ) : line.status === "pending_conversion" ? (
                    <PendingConversionForm batchId={selectedBatch.id} line={line} mobile />
                  ) : (
                    <>
                      <div className="mt-1 text-sm text-slate-800">
                        {line.convertedCostAmount != null
                          ? `${formatMoney(line.convertedCostAmount)} / ${line.targetUnit || "-"}`
                          : "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {line.conversionSource || "-"}
                        {line.conversionFactorUsed ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}` : ""}
                      </div>
                    </>
                  )}
                </div>

                {line.errorMessage ? (
                  <div className="text-sm text-red-700">
                    {line.errorMessage}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
