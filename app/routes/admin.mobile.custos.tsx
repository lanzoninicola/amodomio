import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { Search } from "lucide-react";
import { CostTrendChart } from "~/components/item-cost-monitoring/cost-trend-chart";
import { loadItemCostMonitoringPayload } from "~/domain/item/item-cost-monitoring.server";
import { ok } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Consulta de custos" }];

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

export async function loader({ request }: LoaderFunctionArgs) {
  return ok(await loadItemCostMonitoringPayload(request));
}

export default function AdminMobileCustosPage() {
  const data = useLoaderData<typeof loader>();
  const payload = data.payload as any;
  const navigation = useNavigation();
  const items = payload.items || [];
  const filters = payload.filters || { q: "" };
  const averageWindowDays = Number(payload.averageWindowDays || 30);
  const chartWindowDays = Number(payload.chartWindowDays || 60);
  const isLoading = navigation.state !== "idle";

  return (
    <div className="space-y-4 pb-4">
      <Form method="get" className="">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Buscar produto ou insumo</span>
          <div className="mt-2 flex items-center gap-2 border-b border-slate-200 pb-3">
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Ex.: muçarela, calabresa"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"
              aria-label={isLoading ? "Buscando" : "Buscar"}
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </label>
      </Form>

      {!filters.q ? (
        <section className="py-6 text-sm text-slate-600">
          Digite um nome para consultar último custo, custo médio, fornecedores e andamento do custo.
        </section>
      ) : null}

      {filters.q && items.length === 0 ? (
        <section className="py-6 text-sm text-slate-600">
          Nenhum item ativo encontrado para <span className="font-semibold text-slate-900">{filters.q}</span>.
        </section>
      ) : null}

      {items.map((item: any) => (
        <article key={item.id} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-base font-semibold leading-tight text-slate-950">
              {item.name}
            </h2>
            <Link
              to={`/admin/items/${item.id}/costs`}
              className="shrink-0 text-[11px] font-medium text-slate-500"
            >
              Abrir
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Último custo</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {item.latestCost ? fmtMoney(item.latestCost.costAmount) : "-"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {item.latestCost?.unit || item.purchaseUm || item.consumptionUm || "sem unidade"}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {item.latestCost?.validFrom ? fmtDateShort(item.latestCost.validFrom) : "Sem histórico"}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Custo médio</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {item.averageCostPerConsumptionUnit != null ? fmtMoney(item.averageCostPerConsumptionUnit) : "-"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {item.consumptionUm || item.latestCost?.unit || "sem unidade"} • {averageWindowDays} dias
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {item.averageSamplesCount > 0 ? `${item.averageSamplesCount} registro(s)` : "Sem amostras"}
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
