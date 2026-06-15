import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AlertCircle, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  countOpenSupplierPurchaseOrders,
  listSupplierOrderSuppliers,
} from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader(_: LoaderFunctionArgs) {
  const [suppliers, openOrdersCount] = await Promise.all([
    listSupplierOrderSuppliers(),
    countOpenSupplierPurchaseOrders(),
  ]);
  return ok({ suppliers, openOrdersCount });
}

export default function AdminMobilePedidoFornecedorIndex() {
  const { payload } = useLoaderData<typeof loader>();
  const suppliers = (payload.suppliers || []) as any[];
  const openOrdersCount = Number(payload.openOrdersCount || 0);
  const [filterQuery, setFilterQuery] = useState("");

  const visibleSuppliers = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter((supplier) =>
      String(supplier.name || "")
        .toLowerCase()
        .includes(query)
    );
  }, [filterQuery, suppliers]);

  return (
    <div className="space-y-4 pb-8">
      {openOrdersCount > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-950">
                Tem {openOrdersCount} pedido
                {openOrdersCount !== 1 ? "s" : ""} em aberto
              </p>
              <Link
                to="/admin/mobile/pedido-fornecedor/pedidos-abertos"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 py-2.5 text-sm font-semibold text-white"
              >
                Ver pedidos em aberto
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-slate-900">Fornecedor</span>
        <div className="mt-2 flex items-center gap-2 border-b border-slate-200 pb-3">
          <input
            type="search"
            value={filterQuery}
            onChange={(event) => setFilterQuery(event.target.value)}
            placeholder="Filtrar fornecedor..."
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-slate-900"
            autoFocus
          />
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Search className="h-4 w-4" />
          </span>
        </div>
      </label>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {visibleSuppliers.length} fornecedor
          {visibleSuppliers.length !== 1 ? "es" : ""}
        </p>
        <div className="space-y-1">
          {visibleSuppliers.map((supplier) => (
            <Link
              key={supplier.id}
              to={`${supplier.id}/produtos`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  {supplier.name}
                </span>
                {supplier.phoneNumber ? (
                  <span className="block text-xs text-slate-500">
                    {supplier.phoneNumber}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
