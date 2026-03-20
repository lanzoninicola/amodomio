import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { Search } from "lucide-react";
import { calculateItemCostMetrics, getItemAverageCostWindowDays } from "~/domain/item/item-cost-metrics.server";
import prismaClient from "~/lib/prisma/client.server";
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

function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR");
}

function fmtDateShort(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const supplierName = (metadata as Record<string, unknown>).supplierName;
  const normalized = String(supplierName || "").trim();
  return normalized || null;
}

function pickPrimaryItemVariation(item: any) {
  const activeVariations = (item?.ItemVariation || []).filter((row: any) => !row?.deletedAt);

  return activeVariations.find((row: any) => row.isReference) || activeVariations[0] || null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const averageWindowDays = await getItemAverageCostWindowDays();

  if (!q) {
    return ok({
      filters: { q: "" },
      averageWindowDays,
      items: [],
    });
  }

  const items = await db.item.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      ItemVariation: {
        where: { deletedAt: null },
        include: {
          ItemCostVariation: {
            select: {
              id: true,
              costAmount: true,
              unit: true,
              validFrom: true,
              createdAt: true,
              source: true,
            },
          },
          ItemCostVariationHistory: {
            select: {
              id: true,
              costAmount: true,
              unit: true,
              validFrom: true,
              createdAt: true,
              source: true,
              metadata: true,
            },
            orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
            take: 30,
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
    orderBy: [{ name: "asc" }],
    take: 20,
  });

  const payload = items.map((item: any) => {
    const baseVariation = pickPrimaryItemVariation(item);
    const history = baseVariation?.ItemCostVariationHistory || [];
    const currentCost = baseVariation?.ItemCostVariation || null;
    const historyForMetrics = history.length > 0 ? history : currentCost ? [currentCost] : [];
    const metrics = calculateItemCostMetrics({
      item,
      history: historyForMetrics,
      averageWindowDays,
    });

    const suppliersMap = new Map<string, any>();
    for (const row of history) {
      const supplierName = getSupplierNameFromMetadata(row?.metadata);
      if (!supplierName) continue;
      const existing = suppliersMap.get(supplierName);
      const rowDate = new Date(row?.validFrom || row?.createdAt || 0).getTime();
      const existingDate = existing
        ? new Date(existing.validFrom || existing.createdAt || 0).getTime()
        : Number.NEGATIVE_INFINITY;
      if (!existing || rowDate > existingDate) {
        suppliersMap.set(supplierName, row);
      }
    }

    const suppliers = Array.from(suppliersMap.entries())
      .map(([supplierName, row]) => ({
        supplierName,
        costAmount: Number(row?.costAmount || 0),
        unit: row?.unit || item.purchaseUm || item.consumptionUm || null,
        source: row?.source || null,
        validFrom: row?.validFrom || row?.createdAt || null,
      }))
      .sort((a, b) => {
        const aDate = new Date(a.validFrom || 0).getTime();
        const bDate = new Date(b.validFrom || 0).getTime();
        return bDate - aDate;
      });

    return {
      id: item.id,
      name: item.name,
      consumptionUm: item.consumptionUm,
      purchaseUm: item.purchaseUm,
      latestCost: metrics.latestCost
        ? {
          costAmount: Number(metrics.latestCost.costAmount || 0),
          unit: metrics.latestCost.unit || item.purchaseUm || item.consumptionUm || null,
          validFrom: metrics.latestCost.validFrom || metrics.latestCost.createdAt || null,
          source: metrics.latestCost.source || null,
        }
        : null,
      averageCostPerConsumptionUnit: metrics.averageCostPerConsumptionUnit,
      averageSamplesCount: metrics.averageSamplesCount,
      suppliers,
    };
  });

  return ok({
    filters: { q },
    averageWindowDays,
    items: payload,
  });
}

export default function AdminMobileCustosPage() {
  const data = useLoaderData<typeof loader>();
  const payload = data.payload as any;
  const navigation = useNavigation();
  const items = payload.items || [];
  const filters = payload.filters || { q: "" };
  const averageWindowDays = Number(payload.averageWindowDays || 30);
  const isLoading = navigation.state !== "idle";

  return (
    <div className="space-y-4 pb-4">
      <Form method="get" className="">
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Buscar produto ou insumo</span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Ex.: muçarela, calabresa"
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm"
            />
            <button
              type="submit"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white"
              aria-label={isLoading ? "Buscando" : "Buscar"}
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </label>
      </Form>

      {!filters.q ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Digite um nome para consultar último custo, custo médio e custos recentes por fornecedor.
        </section>
      ) : null}

      {filters.q && items.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Nenhum item ativo encontrado para <span className="font-semibold text-slate-900">{filters.q}</span>.
        </section>
      ) : null}

      {items.map((item: any) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-base font-semibold leading-tight text-slate-950">
              {item.name}
            </h2>
            <Link
              to={`/admin/items/${item.id}/costs`}
              className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-700"
            >
              Abrir
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 px-3 py-3">
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

            <div className="rounded-xl bg-slate-50 px-3 py-3">
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
        </article>
      ))}
    </div>
  );
}
