import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { Search } from "lucide-react";
import { CostTrendChart } from "~/components/item-cost-monitoring/cost-trend-chart";
import { loadItemCostMonitoringPayload } from "~/domain/item/item-cost-monitoring.server";
import { ok } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin | Consulta de custo" }];

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

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="text-xs text-slate-500">{hint}</div>
    </div>
  );
}

export default function AdminCostMonitoringRoute() {
  const data = useLoaderData<typeof loader>();
  const payload = data.payload as any;
  const navigation = useNavigation();
  const items = payload.items || [];
  const filters = payload.filters || { q: "" };
  const averageWindowDays = Number(payload.averageWindowDays || 30);
  const chartWindowDays = Number(payload.chartWindowDays || 60);
  const isLoading = navigation.state !== "idle";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Consulta de custo</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Busque um produto ou insumo para ver o último custo, custo médio, leitura por fornecedor e a evolução recente do custo.
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-sm text-slate-500">
          <Link
            to="/admin/cost-impact"
            className="hover:text-slate-950"
          >
            Impacto de custos
          </Link>
          <Link
            to="/admin/stock-movements"
            className="hover:text-slate-950"
          >
            Movimentações
          </Link>
          <Link
            to="/admin/import-stock-nf"
            className="hover:text-slate-950"
          >
            Importação NF
          </Link>
        </div>
      </div>

      <Form method="get" className="border-b border-slate-200 pb-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Produto ou insumo</span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Ex.: muçarela, tomate, calabresa"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-medium text-white"
            >
              <Search className="h-4 w-4" />
              {isLoading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </label>
      </Form>

      {!filters.q ? (
        <section className="py-8 text-center text-sm text-slate-600">
          Digite um nome para consultar último custo, custo médio, fornecedores recentes e andamento do custo.
        </section>
      ) : null}

      {filters.q && items.length === 0 ? (
        <section className="py-8 text-center text-sm text-slate-600">
          Nenhum item ativo encontrado para <span className="font-semibold text-slate-900">{filters.q}</span>.
        </section>
      ) : null}

      <div className="space-y-5">
        {items.map((item: any) => (
          <article key={item.id} className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{item.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Janela média de {averageWindowDays} dias. Gráfico dos últimos {chartWindowDays} dias.
                </p>
              </div>
              <Link
                to={`/admin/items/${item.id}/costs`}
                className="inline-flex items-center justify-center text-sm text-slate-500 hover:text-slate-950"
              >
                Abrir item
              </Link>
            </div>

            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-3">
              <MetricCard
                label="Último custo"
                value={fmtMoney(item.latestCost?.costAmount)}
                hint={`${item.latestCost?.unit || item.purchaseUm || item.consumptionUm || "sem unidade"}${item.latestCost?.validFrom ? ` • ${fmtDateShort(item.latestCost.validFrom)}` : ""}`}
              />
              <MetricCard
                label="Custo médio"
                value={fmtMoney(item.averageCostPerConsumptionUnit)}
                hint={`${item.consumptionUm || item.latestCost?.unit || "sem unidade"} • ${item.averageSamplesCount || 0} leitura(s)`}
              />
              <MetricCard
                label="Fornecedores"
                value={String(item.suppliers.length || 0)}
                hint={item.suppliers[0]?.supplierName ? `Último: ${item.suppliers[0].supplierName}` : "Sem fornecedores recentes"}
              />
            </div>

            <div className="mt-5 grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-[1.6fr_1fr]">
              <section>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Andamento do custo</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Média diária em {item.trendUnit || "unidade do item"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    Pico recente
                    <div className="text-sm font-semibold text-slate-900">
                      {fmtMoney(Math.max(...item.trend.map((point: any) => Number(point.value || 0)), 0))}
                    </div>
                  </div>
                </div>
                <CostTrendChart data={item.trend} />
              </section>

              <section className="border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Custo por fornecedor</div>
                {item.suppliers.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-500">Nenhum fornecedor encontrado no histórico recente.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {item.suppliers.map((supplier: any) => (
                      <div key={`${item.id}-${supplier.supplierName}`} className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{supplier.supplierName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {supplier.validFrom ? fmtDateShort(supplier.validFrom) : "Data não informada"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-950">{fmtMoney(supplier.costAmount)}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{supplier.unit || "sem unidade"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
