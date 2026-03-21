import { Form, useFetcher, useOutletContext } from "@remix-run/react";
import { useEffect, useState } from "react";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  getItemCostSourceLabel,
  ITEM_COST_SOURCE_OPTIONS,
} from "~/domain/costs/item-cost-sources";
import type { AdminItemOutletContext } from "./admin.items.$id";

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeUm(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase() || null;
}

function normalizeCostAmountToConsumptionUnit(
  cost: { costAmount?: number | null; unit?: string | null; source?: string | null },
  item: { purchaseUm?: string | null; consumptionUm?: string | null; purchaseToConsumptionFactor?: number | null }
) {
  const amount = Number(cost.costAmount ?? NaN);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const costUnit = normalizeUm(cost.unit);
  const purchaseUm = normalizeUm(item.purchaseUm);
  const consumptionUm = normalizeUm(item.consumptionUm);
  const factor = Number(item.purchaseToConsumptionFactor ?? NaN);

  if (!consumptionUm) {
    return amount;
  }

  const source = String(cost.source || "").trim().toLowerCase();
  if (!costUnit && source === "item-cost-sheet") {
    return amount;
  }

  if (costUnit === consumptionUm) {
    return amount;
  }

  if (costUnit && purchaseUm && costUnit === purchaseUm && Number.isFinite(factor) && factor > 0) {
    return amount / factor;
  }

  return null;
}

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const supplierName = (metadata as Record<string, unknown>).supplierName;
  const normalized = String(supplierName || "").trim();
  return normalized || null;
}

function isComparisonOnlyCost(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const record = metadata as Record<string, unknown>;
  return record.comparisonOnly === true || record.excludeFromMetrics === true;
}

function getCostNotes(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const notes = String((metadata as Record<string, unknown>).notes || "").trim();
  return notes || null;
}

function toValidDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function AdminItemCostsTab() {
  const { item, suppliers, costMetrics, averageWindowDays } = useOutletContext<AdminItemOutletContext>();
  const supplierFetcher = useFetcher<any>();
  const history = item._itemCostVariationHistory || [];
  const latestCost = costMetrics?.latestCost || item._itemCostVariationCurrent || history[0] || null;
  const latestCostAmount = Number(costMetrics?.latestCostPerConsumptionUnit ?? 0);
  const averageCostAmount = Number(costMetrics?.averageCostPerConsumptionUnit || 0);
  const referenceUnit = item.consumptionUm || latestCost?.unit || item.purchaseUm || "";
  const latestSupplierName =
    history.map((row: any) => getSupplierNameFromMetadata(row?.metadata)).find(Boolean) || "";
  const latestPurchaseSupplierName = String(item._latestPurchaseSupplierName || "").trim();
  const measurementSummary =
    item.purchaseUm && item.consumptionUm && item.purchaseToConsumptionFactor
      ? `1 ${item.purchaseUm} = ${Number(item.purchaseToConsumptionFactor).toFixed(6)} ${item.consumptionUm}`
      : null;

  const [costAmount, setCostAmount] = useState(latestCostAmount > 0 ? latestCostAmount : 0);
  const [latestCostDraft, setLatestCostDraft] = useState(latestCostAmount > 0 ? latestCostAmount : 0);
  const [averageCostDraft, setAverageCostDraft] = useState(averageCostAmount > 0 ? averageCostAmount : 0);
  const [source, setSource] = useState("manual");
  const [supplierName, setSupplierName] = useState(latestPurchaseSupplierName || latestSupplierName);
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const [unit, setUnit] = useState(referenceUnit);

  const createdSupplier = supplierFetcher.data?.payload?.supplier;
  const supplierOptions: SearchableSelectOption[] = [
    ...(latestPurchaseSupplierName && !suppliers.some((supplier) => supplier.name === latestPurchaseSupplierName)
      ? [{ value: latestPurchaseSupplierName, label: `${latestPurchaseSupplierName} (última compra)`, searchText: latestPurchaseSupplierName }]
      : []),
    ...suppliers.map((supplier) => ({
      value: supplier.name,
      label: supplier.name,
      searchText: [supplier.name, supplier.cnpj || ""].filter(Boolean).join(" "),
    })),
    ...(createdSupplier && !suppliers.some((supplier) => supplier.name === createdSupplier.name)
      ? [{ value: createdSupplier.name, label: createdSupplier.name, searchText: createdSupplier.name }]
      : []),
  ];
  const chartMap = new Map<string, { date: string; label: string; total: number; count: number }>();
  const chartThreshold = new Date();
  chartThreshold.setHours(0, 0, 0, 0);
  chartThreshold.setDate(chartThreshold.getDate() - (averageWindowDays - 1));

  for (const row of history) {
    if (isComparisonOnlyCost(row?.metadata)) continue;
    const date = toValidDate(row?.validFrom) || toValidDate(row?.createdAt);
    if (!date) continue;
    if (date < chartThreshold) continue;
    const dateKey = date.toISOString().slice(0, 10);
    const amount = normalizeCostAmountToConsumptionUnit(row, item);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const bucket = chartMap.get(dateKey) || {
      date: dateKey,
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: 0,
      count: 0,
    };
    bucket.total += amount;
    bucket.count += 1;
    chartMap.set(dateKey, bucket);
  }

  const chartData = Array.from(chartMap.values()).map((bucket) => ({
    ...bucket,
    value: bucket.count > 0 ? bucket.total / bucket.count : 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
  const chartMax = Math.max(...chartData.map((bucket) => bucket.value), 0);

  useEffect(() => {
    setCostAmount(latestCostAmount > 0 ? latestCostAmount : 0);
    setLatestCostDraft(latestCostAmount > 0 ? latestCostAmount : 0);
  }, [latestCostAmount]);

  useEffect(() => {
    setAverageCostDraft(averageCostAmount > 0 ? averageCostAmount : 0);
  }, [averageCostAmount]);

  useEffect(() => {
    setSupplierName(latestPurchaseSupplierName || latestSupplierName);
  }, [latestPurchaseSupplierName, latestSupplierName]);

  useEffect(() => {
    if (createdSupplier?.name) {
      setSupplierName(createdSupplier.name);
      setQuickSupplierName("");
    }
  }, [createdSupplier]);

  useEffect(() => {
    setUnit(referenceUnit);
  }, [referenceUnit]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
      <Form method="post" action=".." className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <input type="hidden" name="_action" value="item-cost-add" />
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Levantamento custo</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use as referências para copiar valores e preencha o bloco abaixo para salvar um novo levantamento.
          </p>
        </div>
        {measurementSummary ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Conversão do item: {measurementSummary}
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Configure a conversão na aba Principal para padronizar custo de compra vs consumo/estoque.
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Referências</div>
              <p className="text-xs text-slate-600">Esses campos não são enviados. Use `Usar no envio` para copiar o valor ao formulário.</p>
            </div>
            {latestSupplierName ? (
              <div className="text-right text-xs text-slate-600">
                Último fornecedor
                <div className="font-medium text-slate-900">{latestSupplierName}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Último custo</Label>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={() => {
                    setCostAmount(latestCostDraft);
                    if (referenceUnit) setUnit(referenceUnit);
                  }}
                >
                  Usar no envio
                </Button>
              </div>
              <MoneyInput defaultValue={latestCostDraft} onValueChange={setLatestCostDraft} className="w-full" />
              <div className="text-xs text-slate-500">
                {referenceUnit || "sem unidade"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Custo médio ({averageWindowDays} dias)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={() => {
                    setCostAmount(averageCostDraft);
                    if (referenceUnit) setUnit(referenceUnit);
                  }}
                >
                  Usar no envio
                </Button>
              </div>
              <MoneyInput defaultValue={averageCostDraft} onValueChange={setAverageCostDraft} className="w-full" />
              <div className="text-xs text-slate-500">
                {referenceUnit || "sem unidade"}
              </div>
            </div>
          </div>
        </div>

        <input type="hidden" name="unit" value={unit} />
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="supplierName" value={supplierName} />

        <div className="rounded-lg border border-slate-200 p-4">
          <div className="border-b border-slate-100 pb-3">
            <div className="text-base font-semibold text-slate-900">Novo levantamento</div>
            <p className="mt-1 text-sm text-slate-600">
              Este é o bloco que será salvo ao clicar no botão de ação abaixo.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <Label>Origem do custo</Label>
              <Select
                value={source}
                onValueChange={setSource}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar origem">
                    {getItemCostSourceLabel(source)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ITEM_COST_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-slate-500">{option.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>UM do levantamento</Label>
              <Select
                value={unit}
                onValueChange={setUnit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  {[latestCost?.unit, item.purchaseUm, item.consumptionUm]
                    .filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index)
                    .map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                Valor do custo ({unit || "sem unidade"})
              </Label>
              <MoneyInput name="costAmount" defaultValue={costAmount} onValueChange={setCostAmount} className="w-full" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label>Fornecedor ou loja</Label>
              <SearchableSelect
                value={supplierName}
                onValueChange={setSupplierName}
                options={supplierOptions}
                placeholder="Selecionar fornecedor"
                searchPlaceholder="Buscar fornecedor..."
                emptyText="Nenhum fornecedor encontrado."
                triggerClassName="h-10 w-full max-w-none justify-between px-3 text-sm"
                contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
              />
              <div className="mt-1 text-xs text-slate-500">
                {latestPurchaseSupplierName
                  ? `Pré-selecionado com o último fornecedor de compra: ${latestPurchaseSupplierName}.`
                  : "Selecione um fornecedor cadastrado ou cadastre um novo abaixo."}
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3">
              <input type="checkbox" name="comparisonOnly" defaultChecked className="mt-1 h-4 w-4" />
              <span className="text-sm text-slate-700">
                Usar só para comparação por fornecedor
                <span className="mt-1 block text-xs text-slate-500">
                  Mantém a cotação fora do último custo, custo médio e gráfico.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4">
            <Label htmlFor="notes">Observação</Label>
            <Input id="notes" name="notes" placeholder="Ex.: ajuste manual, confirmação de compra, revisão de custo." />
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="submit" className="md:min-w-[180px]">
              Registrar levantamento
            </Button>
          </div>
        </div>
      </Form>
      <supplierFetcher.Form method="post" action=".." className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
        <input type="hidden" name="_action" value="supplier-quick-create" />
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cadastro rápido de fornecedor</div>
        <div className="mt-2 flex gap-2">
          <Input
            name="name"
            value={quickSupplierName}
            onChange={(event) => setQuickSupplierName(event.target.value)}
            placeholder="Nome do fornecedor"
          />
          <Button type="submit" variant="outline" disabled={supplierFetcher.state !== "idle"}>
            {supplierFetcher.state !== "idle" ? "Salvando..." : "Cadastrar"}
          </Button>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Cria um fornecedor simples para usar neste levantamento. Complementos podem ser ajustados depois.
        </div>
      </supplierFetcher.Form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de custos</h2>
        <div className="mt-3 text-sm">
          <div>
            Último custo:{" "}
            {costMetrics?.latestCostPerConsumptionUnit != null
              ? `R$ ${Number(costMetrics.latestCostPerConsumptionUnit).toFixed(4)} ${referenceUnit}`.trim()
              : "não informado"}
          </div>
          <div>
            Custo médio ({averageWindowDays} dias):{" "}
            {costMetrics?.averageCostPerConsumptionUnit != null
              ? `R$ ${Number(costMetrics.averageCostPerConsumptionUnit).toFixed(4)} ${item.consumptionUm || ""}`.trim()
              : "não informado"}
          </div>
          <div>Último fornecedor: {latestSupplierName || "não informado"}</div>
        </div>

        {history.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">Nenhum custo registrado.</div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gráfico por dia nos últimos {averageWindowDays} dias
              </div>
              <div className="mt-3 overflow-x-auto">
                <div className="flex h-56 min-w-[720px] items-end gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  {chartData.map((bucket) => {
                    const height = chartMax > 0 ? Math.max(6, Math.round((bucket.value / chartMax) * 160)) : 6;
                    return (
                      <div key={bucket.date} className="flex min-w-[20px] flex-1 flex-col items-center justify-end gap-2">
                        <div className="text-[10px] text-slate-500">
                          {bucket.count > 0 ? BRL_FORMATTER.format(bucket.value) : "-"}
                        </div>
                        <div
                          className={`w-full rounded-t ${bucket.count > 0 ? "bg-slate-900" : "bg-slate-200"}`}
                          style={{ height }}
                          title={`${bucket.label} • ${bucket.count > 0 ? BRL_FORMATTER.format(bucket.value) : "Sem registro"}`}
                        />
                        <div className="text-[10px] text-slate-500">{bucket.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {history.slice(0, 8).map((c: any) => (
                <div key={c.id} className="rounded border border-slate-100 p-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">
                      {BRL_FORMATTER.format(Number(c.costAmount || 0))} {c.unit || ""}
                    </div>
                    {isComparisonOnlyCost(c.metadata) ? (
                      <div className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Só comparação
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(c.validFrom).toLocaleString("pt-BR")} • {getItemCostSourceLabel(c.source)} • {getSupplierNameFromMetadata(c.metadata) || "Sem fornecedor"}
                  </div>
                  {getCostNotes(c.metadata) ? (
                    <div className="mt-1 text-xs text-slate-600">{getCostNotes(c.metadata)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
