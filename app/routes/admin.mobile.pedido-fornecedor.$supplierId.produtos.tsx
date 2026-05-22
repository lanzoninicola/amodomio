import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { Check, Package, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtSupplierOrderDate, fmtSupplierOrderMoney } from "~/domain/supplier/supplier-order";
import { listSupplierOrderProducts } from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const supplierId = String(params.supplierId || "");
  const result = await listSupplierOrderProducts(supplierId);
  return ok({ supplierId, ...result });
}

export default function AdminMobilePedidoFornecedorProdutos() {
  const { payload } = useLoaderData<typeof loader>();
  const { supplier, itemRows } = payload as any;
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const [itemQuery, setItemQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    if (!query) return itemRows as any[];
    return (itemRows as any[]).filter((row) => String(row.itemName || "").toLowerCase().includes(query));
  }, [itemQuery, itemRows]);

  function toggleItem(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  if (!supplier) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <p>Fornecedor não encontrado.</p>
        <Link to="/admin/mobile/pedido-fornecedor" className="font-semibold underline underline-offset-2">
          Selecionar outro fornecedor
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fornecedor</p>
          <p className="text-base font-semibold text-slate-900">{supplier.name}</p>
          {supplier.phoneNumber ? <p className="text-xs text-slate-500">{supplier.phoneNumber}</p> : null}
        </div>
        <Link to="/admin/mobile/pedido-fornecedor" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
          Trocar
        </Link>
      </div>

      {itemRows.length > 0 ? (
        <>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={itemQuery}
              onChange={(event) => setItemQuery(event.target.value)}
              placeholder="Buscar produto..."
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-slate-900"
            />
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            {visibleItems.length} {visibleItems.length === 1 ? "produto" : "produtos"} de{" "}
            <span className="font-semibold text-slate-900">{supplier.name}</span>
          </p>

          <Form method="get" action="../quantidades" className="space-y-2">
            {Array.from(selectedIds).map((itemId) => (
              <input key={itemId} type="hidden" name="itemId" value={itemId} />
            ))}

            {visibleItems.map((row: any) => {
              const isSelected = selectedIds.has(row.itemId);
              return (
                <article
                  key={row.itemId}
                  onClick={() => toggleItem(row.itemId)}
                  className={`cursor-pointer rounded-xl border bg-white px-4 py-3 transition-colors ${
                    isSelected ? "border-green-500 bg-green-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected ? "border-green-500 bg-green-500 text-white" : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <Link
                          to={`/admin/items/${row.itemId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-sm font-semibold leading-tight text-slate-900 underline-offset-2 hover:underline"
                        >
                          {row.itemName}
                        </Link>
                      </div>
                      <p className="mt-0.5 pl-7 text-[11px] text-slate-400">
                        Última compra: {fmtSupplierOrderDate(row.lastMovementAt)}
                        {row.totalMovements > 1 ? <span className="ml-2 text-slate-300">· {row.totalMovements}x</span> : null}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold leading-none text-slate-900">{fmtSupplierOrderMoney(row.lastCost)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{row.consumptionUm || row.lastCostUnit || ""}</p>
                      {row.otherSupplierCosts?.length > 0 ? (
                        <div className="mt-1.5 space-y-0.5">
                          {row.otherSupplierCosts.map((other: any) => (
                            <p key={other.supplierName} className="text-[11px] leading-tight text-slate-400">
                              {fmtSupplierOrderMoney(other.costAmount)} <span className="text-slate-300">({other.supplierName})</span>
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}

            {selectedIds.size > 0 ? (
              <div className="sticky bottom-4 z-10 flex justify-center">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-xl"
                >
                  <Send className="h-4 w-4" />
                  Informar quantidades ({selectedIds.size} {selectedIds.size === 1 ? "item" : "itens"})
                </button>
              </div>
            ) : null}
          </Form>
        </>
      ) : !isLoading ? (
        <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
          <Package size={32} strokeWidth={1.5} />
          <p className="text-sm">Nenhuma entrada encontrada para este fornecedor.</p>
        </div>
      ) : null}
    </div>
  );
}

