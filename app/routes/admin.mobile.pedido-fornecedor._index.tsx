import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { listSupplierOrderSuppliers } from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader(_: LoaderFunctionArgs) {
  const suppliers = await listSupplierOrderSuppliers();
  return ok({ suppliers });
}

export default function AdminMobilePedidoFornecedorIndex() {
  const { payload } = useLoaderData<typeof loader>();
  const suppliers = (payload.suppliers || []) as any[];
  const [filterQuery, setFilterQuery] = useState("");

  const visibleSuppliers = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter((supplier) => String(supplier.name || "").toLowerCase().includes(query));
  }, [filterQuery, suppliers]);

  return (
    <div className="space-y-4 pb-8">
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
          {visibleSuppliers.length} fornecedor{visibleSuppliers.length !== 1 ? "es" : ""}
        </p>
        <div className="space-y-1">
          {visibleSuppliers.map((supplier) => (
            <Link
              key={supplier.id}
              to={`${supplier.id}/produtos`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span>
                <span className="block text-sm font-medium text-slate-900">{supplier.name}</span>
                {supplier.phoneNumber ? <span className="block text-xs text-slate-500">{supplier.phoneNumber}</span> : null}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

