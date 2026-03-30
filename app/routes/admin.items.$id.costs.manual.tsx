import { Form, useFetcher, useOutletContext } from "@remix-run/react";
import { useEffect, useState } from "react";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import {
  getItemCostSourceLabel,
  ITEM_COST_SOURCE_OPTIONS,
} from "~/domain/costs/item-cost-sources";
import type { AdminItemOutletContext } from "./admin.items.$id";

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).supplierName;
  const s = String(v || "").trim();
  return s || null;
}

export default function AdminItemCostsManual() {
  const { item, suppliers, costMetrics } = useOutletContext<AdminItemOutletContext>();
  const supplierFetcher = useFetcher<any>();

  const history: any[] = item._itemCostVariationHistory || [];
  const latestCost = costMetrics?.latestCost || item._itemCostVariationCurrent || history[0] || null;
  const latestCostAmount = Number(costMetrics?.latestCostPerConsumptionUnit ?? 0);
  const averageCostAmount = Number(costMetrics?.averageCostPerConsumptionUnit || 0);
  const referenceUnit = item.consumptionUm || latestCost?.unit || item.purchaseUm || "";
  const latestSupplierName =
    history.map((r: any) => getSupplierNameFromMetadata(r?.metadata)).find(Boolean) || "";
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
    ...(latestPurchaseSupplierName && !suppliers.some((s) => s.name === latestPurchaseSupplierName)
      ? [{ value: latestPurchaseSupplierName, label: `${latestPurchaseSupplierName} (última compra)`, searchText: latestPurchaseSupplierName }]
      : []),
    ...suppliers.map((s) => ({
      value: s.name,
      label: s.name,
      searchText: [s.name, s.cnpj || ""].filter(Boolean).join(" "),
    })),
    ...(createdSupplier && !suppliers.some((s) => s.name === createdSupplier.name)
      ? [{ value: createdSupplier.name, label: createdSupplier.name, searchText: createdSupplier.name }]
      : []),
  ];

  // action target is the item parent route
  const actionUrl = `/admin/items/${item.id}`;

  useEffect(() => { setCostAmount(latestCostAmount > 0 ? latestCostAmount : 0); setLatestCostDraft(latestCostAmount > 0 ? latestCostAmount : 0); }, [latestCostAmount]);
  useEffect(() => { setAverageCostDraft(averageCostAmount > 0 ? averageCostAmount : 0); }, [averageCostAmount]);
  useEffect(() => { setSupplierName(latestPurchaseSupplierName || latestSupplierName); }, [latestPurchaseSupplierName, latestSupplierName]);
  useEffect(() => { if (createdSupplier?.name) { setSupplierName(createdSupplier.name); setQuickSupplierName(""); } }, [createdSupplier]);
  useEffect(() => { setUnit(referenceUnit); }, [referenceUnit]);

  return (
    <div className="max-w-2xl space-y-4">
      {/* Reference card */}
      <div className="rounded-xl bg-slate-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valores de referência</h2>
          {latestSupplierName ? (
            <div className="text-[11px] text-slate-400">Fornecedor: <span className="text-slate-600">{latestSupplierName}</span></div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Último custo</div>
            <div className="flex items-center gap-2">
              <MoneyInput defaultValue={latestCostDraft} onValueChange={setLatestCostDraft} className="flex-1" />
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-3 text-xs"
                onClick={() => { setCostAmount(latestCostDraft); if (referenceUnit) setUnit(referenceUnit); }}>
                Usar
              </Button>
            </div>
            <div className="text-[11px] text-slate-400">{referenceUnit || "sem unidade"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Custo médio</div>
            <div className="flex items-center gap-2">
              <MoneyInput defaultValue={averageCostDraft} onValueChange={setAverageCostDraft} className="flex-1" />
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-3 text-xs"
                onClick={() => { setCostAmount(averageCostDraft); if (referenceUnit) setUnit(referenceUnit); }}>
                Usar
              </Button>
            </div>
            <div className="text-[11px] text-slate-400">{referenceUnit || "sem unidade"}</div>
          </div>
        </div>
      </div>

      {/* Cost entry form */}
      <Form method="post" action={actionUrl} className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <input type="hidden" name="_action" value="item-cost-add" />
        <input type="hidden" name="unit" value={unit} />
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="supplierName" value={supplierName} />

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Novo levantamento</h2>
          {measurementSummary ? (
            <p className="mt-1 text-sm text-slate-500">Conversão: <span className="font-medium text-slate-700">{measurementSummary}</span></p>
          ) : (
            <p className="mt-1 text-sm text-amber-700">
              Configure a conversão de unidades na aba <span className="font-semibold">Principal</span>.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">Origem</div>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar origem">{getItemCostSourceLabel(source)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ITEM_COST_SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-slate-500">{opt.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">Unidade</div>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
              <SelectContent>
                {[latestCost?.unit, item.purchaseUm, item.consumptionUm]
                  .filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i)
                  .map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500">
              Valor{unit ? <span className="ml-1 text-slate-400">({unit})</span> : null}
            </div>
            <MoneyInput name="costAmount" defaultValue={costAmount} onValueChange={setCostAmount} className="w-full" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs text-slate-500">Fornecedor ou loja</div>
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
            {latestPurchaseSupplierName ? (
              <div className="text-[11px] text-slate-400">Última compra: {latestPurchaseSupplierName}</div>
            ) : null}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 px-3 py-3">
            <input type="checkbox" name="comparisonOnly" defaultChecked className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-sm text-slate-700 leading-snug">
              Só para comparação
              <span className="mt-0.5 block text-xs text-slate-400 font-normal">
                Se marcar, não altera o custo vigente. Só adiciona histórico, e esse registro fica fora das métricas e do gráfico.
              </span>
              <span className="mt-0.5 block text-xs text-slate-400 font-normal">
                Se não marcar, atualiza o custo corrente e também grava histórico.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-slate-500">Observação <span className="text-slate-400">(opcional)</span></div>
          <Input name="notes" placeholder="Ex.: confirmação de compra, ajuste manual…" />
        </div>

        <Button type="submit" className="w-full">Salvar levantamento</Button>
      </Form>

      {/* Quick supplier create */}
      <supplierFetcher.Form method="post" action={actionUrl} className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
        <input type="hidden" name="_action" value="supplier-quick-create" />
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cadastrar fornecedor rápido</div>
        <div className="mt-2 flex gap-2">
          <Input
            name="name"
            value={quickSupplierName}
            onChange={(e) => setQuickSupplierName(e.target.value)}
            placeholder="Nome do fornecedor"
          />
          <Button type="submit" variant="outline" disabled={supplierFetcher.state !== "idle"}>
            {supplierFetcher.state !== "idle" ? "Salvando…" : "Cadastrar"}
          </Button>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">Pode completar o cadastro depois em Fornecedores.</div>
      </supplierFetcher.Form>
    </div>
  );
}
