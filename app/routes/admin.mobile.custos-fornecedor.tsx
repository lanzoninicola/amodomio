import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Separator } from "~/components/ui/separator";
import { loadSupplierItemCostsPayload } from "~/domain/item/item-cost-monitoring.server";
import { ok } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Custos por fornecedor" }];

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
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

export async function loader({ request }: LoaderFunctionArgs) {
  return ok(await loadSupplierItemCostsPayload(request));
}

export default function AdminMobileCustosFornecedorPage() {
  const data = useLoaderData<typeof loader>();
  const payload = data.payload as any;
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const suppliers: { id: string; name: string }[] = payload.suppliers || [];
  const items: any[] = payload.items || [];
  const selectedSupplier: string = payload.supplierName || "";
  const [filterQuery, setFilterQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");

  const visibleSuppliers = filterQuery.trim()
    ? suppliers.filter((s) =>
      s.name.toLowerCase().includes(filterQuery.trim().toLowerCase()),
    )
    : suppliers;

  const visibleItems = itemQuery.trim()
    ? items.filter((item) =>
      item.name.toLowerCase().includes(itemQuery.trim().toLowerCase()),
    )
    : items;

  return (
    <div className="space-y-4 pb-4">
      {/* Supplier search / filter */}
      {!selectedSupplier ? (
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Fornecedor</span>
          <div className="mt-2 flex items-center gap-2 border-b border-slate-200 pb-3">
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar fornecedor"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-900 placeholder:text-slate-400"
              autoFocus
            />
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </span>
          </div>
        </label>
      ) : (
        <Form method="get">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Fornecedor</span>
            <div className="mt-2 flex items-center gap-2 border-b border-slate-200 pb-3">
              <input
                type="search"
                name="supplier"
                defaultValue={selectedSupplier}
                placeholder="Ex.: Makro, Laticínios"
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
      )}

      {/* Supplier list when none selected */}
      {!selectedSupplier && (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {visibleSuppliers.length} fornecedor{visibleSuppliers.length !== 1 ? "es" : ""}
          </p>
          {visibleSuppliers.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              Nenhum fornecedor encontrado para{" "}
              <span className="font-semibold text-slate-900">"{filterQuery}"</span>.
            </p>
          ) : (
            <div className="space-y-1">
              {visibleSuppliers.map((s) => (
                <Link
                  key={s.id}
                  to={`?supplier=${encodeURIComponent(s.name)}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-900">{s.name}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* No results */}
      {selectedSupplier && !isLoading && items.length === 0 && (
        <p className="py-6 text-sm text-slate-600">
          Nenhum item encontrado no histórico de{" "}
          <span className="font-semibold text-slate-900">{selectedSupplier}</span>.
        </p>
      )}

      {/* Items list */}
      {selectedSupplier && items.length > 0 && (
        <>
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <input
              type="search"
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="Buscar produto"
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-slate-900 placeholder:text-slate-400"
            />
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            {visibleItems.length} {visibleItems.length === 1 ? "item" : "itens"}
            {itemQuery.trim() ? (
              <> encontrado{visibleItems.length !== 1 ? "s" : ""} para <span className="font-semibold text-slate-900">"{itemQuery}"</span></>
            ) : (
              <> comprados de <span className="font-semibold text-slate-900">{selectedSupplier}</span></>
            )}
          </p>

          <div className="space-y-4">
            {visibleItems.length === 0 && (
              <p className="py-4 text-sm text-slate-500">
                Nenhum produto encontrado para{" "}
                <span className="font-semibold text-slate-900">"{itemQuery}"</span>.
              </p>
            )}
            {visibleItems.map((item, itemIndex) => {
              const thisAmt = item.thisSupplierCost ? Number(item.thisSupplierCost.costAmount) : null;
              const otherAmts = item.otherSuppliers.map((s: any) => Number(s.costAmount));
              const allAmts = [thisAmt, ...otherAmts].filter((v): v is number => Number.isFinite(v));
              const minAmt = allAmts.length > 0 ? Math.min(...allAmts) : null;
              const maxAmt = allAmts.length > 0 ? Math.max(...allAmts) : null;
              const hasOthers = item.otherSuppliers.length > 0;
              const thisIsCheapest = thisAmt !== null && minAmt !== null && thisAmt <= minAmt && hasOthers;
              const thisIsMostExpensive = thisAmt !== null && maxAmt !== null && thisAmt >= maxAmt && hasOthers;

              return (
                <article key={item.id} className="rounded-xl bg-white shadow-md py-2">
                  {/* Item header */}
                  <div className="flex items-start justify-between gap-3 px-3 pt-3 pb-2">
                    <h2 className="min-w-0 flex-1 text-sm font-semibold leading-tight text-slate-950">
                      {item.name}
                    </h2>
                    <Link
                      to={`/admin/mobile/levantamento-custo-item?itemId=${item.id}`}
                      className="inline-flex h-7 shrink-0 items-center rounded-full border border-slate-200 px-2.5 text-[11px] font-medium text-slate-600"
                    >
                      Levantar
                    </Link>
                  </div>

                  {/* This supplier's cost */}
                  <div
                    className={`mx-3 rounded-xl px-3 py-2.5 ${thisIsCheapest
                      ? "border border-emerald-200 bg-emerald-50"
                      : thisIsMostExpensive
                        ? "border border-orange-200 bg-orange-50"
                        : "border border-slate-200 bg-white"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {selectedSupplier}
                          </span>
                          {thisIsCheapest && (
                            <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                              Mais barato
                            </span>
                          )}
                          {thisIsMostExpensive && !thisIsCheapest && (
                            <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                              Mais caro
                            </span>
                          )}
                        </div>
                        {item.thisSupplierCost?.validFrom && (
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {fmtDateShort(item.thisSupplierCost.validFrom)}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`text-xl font-bold leading-none ${thisIsCheapest
                            ? "text-emerald-700"
                            : thisIsMostExpensive
                              ? "text-orange-700"
                              : "text-slate-950"
                            }`}
                        >
                          {fmtMoney(item.thisSupplierCost?.costAmount)}
                        </div>
                        {(item.thisSupplierCost?.unit || item.consumptionUm || item.purchaseUm) && (
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {item.thisSupplierCost?.unit || item.consumptionUm || item.purchaseUm}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Other suppliers */}
                  {hasOthers && (
                    <div className="mt-2 px-3 pb-3">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Outros fornecedores
                      </div>
                      <div>
                        {item.otherSuppliers.map((supplier: any, index: number) => {
                          const amt = Number(supplier.costAmount);
                          const isCheapest = minAmt !== null && amt <= minAmt;
                          const isMostExpensive = maxAmt !== null && amt >= maxAmt && index === 0;
                          return (
                            <div key={`${item.id}-${supplier.supplierName}`}>
                              {index > 0 && <Separator className="my-1" />}
                              <div
                                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${isCheapest
                                  ? "bg-emerald-50"
                                  : isMostExpensive
                                    ? "bg-slate-50"
                                    : ""
                                  }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-xs font-medium text-slate-700">
                                      {supplier.supplierName}
                                    </span>
                                    {isCheapest && !thisIsCheapest && (
                                      <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                        Mais barato
                                      </span>
                                    )}
                                  </div>
                                  {supplier.validFrom && (
                                    <div className="text-[10px] text-slate-400">
                                      {fmtDateShort(supplier.validFrom)}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 text-right">
                                  <div
                                    className={`text-sm font-semibold ${isCheapest ? "text-emerald-700" : "text-slate-700"
                                      }`}
                                  >
                                    {fmtMoney(supplier.costAmount)}
                                  </div>
                                  {supplier.unit && (
                                    <div className="text-[10px] text-slate-400">{supplier.unit}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
