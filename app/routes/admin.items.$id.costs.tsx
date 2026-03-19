import { Form, useOutletContext } from "@remix-run/react";
import { useEffect, useState } from "react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { AdminItemOutletContext } from "./admin.items.$id";

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const supplierName = (metadata as Record<string, unknown>).supplierName;
  const normalized = String(supplierName || "").trim();
  return normalized || null;
}

function toValidDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function AdminItemCostsTab() {
  const { item, costMetrics, averageWindowDays } = useOutletContext<AdminItemOutletContext>();
  const history = item._itemCostVariationHistory || [];
  const latestCost = costMetrics?.latestCost || item._itemCostVariationCurrent || history[0] || null;
  const latestCostAmount = Number(latestCost?.costAmount || 0);
  const averageCostAmount = Number(costMetrics?.averageCostPerConsumptionUnit || 0);
  const latestSupplierName =
    history.map((row: any) => getSupplierNameFromMetadata(row?.metadata)).find(Boolean) || "";
  const measurementSummary =
    item.purchaseUm && item.consumptionUm && item.purchaseToConsumptionFactor
      ? `1 ${item.purchaseUm} = ${Number(item.purchaseToConsumptionFactor).toFixed(6)} ${item.consumptionUm}`
      : null;

  const [costAmount, setCostAmount] = useState(latestCostAmount > 0 ? latestCostAmount : 0);
  const [latestCostDraft, setLatestCostDraft] = useState(latestCostAmount > 0 ? latestCostAmount : 0);
  const [averageCostDraft, setAverageCostDraft] = useState(averageCostAmount > 0 ? averageCostAmount : 0);
  const [supplierName, setSupplierName] = useState(latestSupplierName);

  const chartMap = new Map<string, { date: string; label: string; total: number; count: number }>();
  const chartThreshold = new Date();
  chartThreshold.setHours(0, 0, 0, 0);
  chartThreshold.setDate(chartThreshold.getDate() - (averageWindowDays - 1));

  for (const row of history) {
    const date = toValidDate(row?.validFrom) || toValidDate(row?.createdAt);
    if (!date) continue;
    if (date < chartThreshold) continue;
    const dateKey = date.toISOString().slice(0, 10);
    const amount = Number(row?.costAmount ?? NaN);
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
    setSupplierName(latestSupplierName);
  }, [latestSupplierName]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Form method="post" action=".." className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <input type="hidden" name="_action" value="item-cost-add" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Registrar custo</h2>
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
                <Button type="button" variant="ghost" className="h-auto px-2 py-1 text-xs" onClick={() => setCostAmount(latestCostDraft)}>
                  Usar no envio
                </Button>
              </div>
              <MoneyInput defaultValue={latestCostDraft} onValueChange={setLatestCostDraft} className="w-full" />
              <div className="text-xs text-slate-500">
                {latestCost?.unit || item.purchaseUm || item.consumptionUm || "sem unidade"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Custo médio ({averageWindowDays} dias)</Label>
                <Button type="button" variant="ghost" className="h-auto px-2 py-1 text-xs" onClick={() => setCostAmount(averageCostDraft)}>
                  Usar no envio
                </Button>
              </div>
              <MoneyInput defaultValue={averageCostDraft} onValueChange={setAverageCostDraft} className="w-full" />
              <div className="text-xs text-slate-500">
                {item.consumptionUm || latestCost?.unit || "sem unidade"}
              </div>
            </div>
          </div>
        </div>

        <input type="hidden" name="unit" value={latestCost?.unit || item.purchaseUm || ""} />
        <input type="hidden" name="supplierName" value={supplierName} />

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-sm font-semibold text-slate-900">Novo custo manual</div>
          <p className="mt-1 text-sm text-slate-600">Escolha o valor que deseja salvar para este item. A unidade e o último fornecedor continuam sendo usados em segundo plano.</p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <Label>Valor do custo</Label>
              <MoneyInput name="costAmount" defaultValue={costAmount} onValueChange={setCostAmount} className="w-full" />
            </div>
            <div>
              <Label htmlFor="source">Como esse custo foi definido</Label>
              <Input id="source" name="source" defaultValue="manual" />
            </div>
          </div>

          <div className="mt-3">
            <Label htmlFor="notes">Observação</Label>
            <Input id="notes" name="notes" placeholder="Ex.: ajuste manual, confirmação de compra, revisão de custo." />
          </div>
        </div>

        <Button type="submit" variant="outline">
          Registrar custo
        </Button>
      </Form>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de custos</h2>
        <div className="mt-3 text-sm">
          <div>
            Último custo:{" "}
            {latestCost ? `R$ ${Number(latestCost.costAmount || 0).toFixed(2)} ${latestCost.unit || ""}` : "não informado"}
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
                  <div className="font-medium">
                    {BRL_FORMATTER.format(Number(c.costAmount || 0))} {c.unit || ""}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(c.validFrom).toLocaleString("pt-BR")} • {c.source || "manual"} • {getSupplierNameFromMetadata(c.metadata) || "Sem fornecedor"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
