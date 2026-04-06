import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useRef } from "react";
import { CostTrendChart } from "~/components/item-cost-monitoring/cost-trend-chart";
import { Badge } from "~/components/ui/badge";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { loadItemCostMonitoringPayload } from "~/domain/item/item-cost-monitoring.server";
import { ok } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Consulta de custos" }];

const ITEM_CLASSIFICATIONS = [
  "insumo",
  "semi_acabado",
  "produto_final",
  "embalagem",
  "servico",
  "outro",
] as const;

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtMoney(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "-";
  return BRL_FORMATTER.format(Number(value));
}

function fmtDateShort(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

function formatClassificationLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getClassificationBadgeClass(value: string, isActive: boolean) {
  const toneByClassification: Record<string, string> = {
    insumo: isActive ? "border-sky-600 bg-sky-600 text-white" : "border-sky-200 bg-sky-50 text-sky-700",
    semi_acabado: isActive ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-700",
    produto_final: isActive ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-700",
    embalagem: isActive ? "border-violet-600 bg-violet-600 text-white" : "border-violet-200 bg-violet-50 text-violet-700",
    servico: isActive ? "border-rose-600 bg-rose-600 text-white" : "border-rose-200 bg-rose-50 text-rose-700",
    outro: isActive ? "border-slate-700 bg-slate-700 text-white" : "border-slate-200 bg-slate-50 text-slate-700",
  };

  return toneByClassification[value] || toneByClassification.outro;
}

export async function loader({ request }: LoaderFunctionArgs) {
  return ok(await loadItemCostMonitoringPayload(request));
}

export default function AdminMobileCustosPage() {
  const data = useLoaderData<typeof loader>();
  const payload = data.payload as any;
  const navigation = useNavigation();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const items = payload.items || [];
  const itemOptions = payload.itemOptions || [];
  const filters = payload.filters || { q: "", classification: "insumo" };
  const chartWindowDays = Number(payload.chartWindowDays || 60);
  const isLoading = navigation.state !== "idle";
  const mobileItemOptions: SearchableSelectOption[] = itemOptions.map((entry: any) => ({
    value: entry.id,
    label: entry.name,
    searchText: [entry.name, entry.classification || "", entry.purchaseUm || "", entry.consumptionUm || ""].filter(Boolean).join(" "),
  }));
  const selectedOption = itemOptions.find(
    (entry: any) => entry.name === filters.q && entry.classification === (filters.classification || "insumo"),
  );
  const selectedItemId = String(selectedOption?.id || "");

  return (
    <div className="space-y-4 pb-4">
      <Form method="get" className="" ref={formRef}>
        <div className="block">
          <span className="text-sm font-semibold text-slate-900">Buscar produto ou insumo</span>
          <input type="hidden" name="classification" value={filters.classification || "insumo"} />
          <input type="hidden" name="q" value={filters.q || ""} />
          <div className="mt-2">
            <SearchableSelect
              value={selectedItemId}
              onValueChange={(nextItemId) => {
                if (!formRef.current) return;
                const nextItem = itemOptions.find((entry: any) => entry.id === nextItemId);
                if (!nextItem) return;
                const formData = new FormData(formRef.current);
                formData.set("q", nextItem.name);
                formData.set("classification", nextItem.classification || "insumo");
                submit(formData, { method: "get" });
              }}
              options={mobileItemOptions}
              placeholder={isLoading ? "Buscando..." : "Selecionar produto ou insumo"}
              searchPlaceholder="Buscar item..."
              emptyText="Nenhum item encontrado."
              triggerClassName="h-11 w-full max-w-none justify-between rounded-xl border-slate-300 px-3 text-sm"
              contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ITEM_CLASSIFICATIONS.map((classification) => {
            const isActive = (filters.classification || "insumo") === classification;

            return (
              <button
                key={classification}
                type="button"
                onClick={() => {
                  if (!formRef.current) return;
                  const formData = new FormData(formRef.current);
                  formData.set("classification", classification);
                  submit(formData, { method: "get" });
                }}
                className="rounded-full"
                aria-pressed={isActive}
              >
                <Badge
                  variant="outline"
                  className={`cursor-pointer border font-medium capitalize ${getClassificationBadgeClass(classification, isActive)}`}
                >
                  {formatClassificationLabel(classification)}
                </Badge>
              </button>
            );
          })}
        </div>
      </Form>

      {!filters.q ? (
        <section className="py-6 text-sm text-slate-600">
          Digite um nome para consultar último custo, custo médio, fornecedores e andamento do custo.
        </section>
      ) : null}

      {filters.q && items.length === 0 ? (
        <section className="py-6 text-sm text-slate-600">
          Nenhum item ativo encontrado para <span className="font-semibold text-slate-900">{filters.q}</span> em{" "}
          <span className="font-semibold text-slate-900">{formatClassificationLabel(filters.classification || "insumo")}</span>.
        </section>
      ) : null}

      {items.map((item: any) => (
        <article key={item.id} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-base font-semibold leading-tight text-slate-950">
              {item.name}
            </h2>
            <Link
              to={`/admin/mobile/levantamento-custo-item?itemId=${item.id}`}
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-slate-200 px-3 text-[11px] font-medium text-slate-700"
            >
              Levantar
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Último custo</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {item.latestCost ? fmtMoney(item.latestCost.normalizedCostAmount) : "-"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {item.consumptionUm || item.latestCost?.unit || item.purchaseUm || "sem unidade"}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {item.latestCost?.validFrom ? fmtDateShort(item.latestCost.validFrom) : "Sem histórico"}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Custo médio
                <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-slate-500">
                  ({item.consumptionUm || item.latestCost?.unit || "sem unidade"})</span></div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="space-y-0.5">
                  {(item.averageCostWindows || []).map((windowMetric: any, index: number) => (
                    <div
                      key={`${item.id}-${windowMetric.averageWindowDays}`}
                      className={index > 0 ? "border-t border-slate-200 pt-1.5" : ""}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                          {windowMetric.averageWindowDays} D ({windowMetric.averageSamplesCount > 0
                            ? `${windowMetric.averageSamplesCount} Rec`
                            : "Sem amostras"})
                        </div>
                        <div className="shrink-0 text-[13px] font-semibold leading-none tracking-tight text-slate-950">
                          {windowMetric.averageCostPerConsumptionUnit != null
                            ? fmtMoney(windowMetric.averageCostPerConsumptionUnit)
                            : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Fornecedores</div>
            {item.suppliers.length === 0 ? (
              <div className="mt-2 text-xs text-slate-500">
                Nenhum fornecedor encontrado no histórico recente.
              </div>
            ) : (
              <div className="mt-2">
                {item.suppliers.map((supplier: any, index: number) => (
                  <div
                    key={`${item.id}-${supplier.supplierName}`}
                    className={`flex items-start justify-between gap-3 py-2 ${index > 0 ? "border-t border-slate-100" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{supplier.supplierName}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {supplier.validFrom ? fmtDateShort(supplier.validFrom) : "Data não informada"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold leading-none text-slate-950">{fmtMoney(supplier.costAmount)}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{supplier.unit || "sem unidade"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Andamento do custo</div>
                <div className="mt-1 text-xs text-slate-500">Média diária dos últimos {chartWindowDays} dias</div>
              </div>
              <div className="text-[11px] text-slate-500">{item.trendUnit || item.purchaseUm || item.consumptionUm || "sem unidade"}</div>
            </div>
            <div className="mt-3">
              <CostTrendChart data={item.trend} emptyLabel="Sem histórico recente para esse item." />
            </div>
          </div>


        </article>
      ))}
    </div>
  );
}
