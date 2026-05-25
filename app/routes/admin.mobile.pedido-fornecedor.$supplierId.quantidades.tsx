import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { parseSupplierOrderSelection } from "~/domain/supplier/supplier-order";
import { getSupplierOrderDraftItems } from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const supplierId = String(params.supplierId || "");
  const url = new URL(request.url);
  const selection = parseSupplierOrderSelection(url.searchParams);

  if (selection.length === 0) {
    return redirect(`/admin/mobile/pedido-fornecedor/${supplierId}/produtos`);
  }

  const result = await getSupplierOrderDraftItems(supplierId, selection);
  if (result.items.length === 0) {
    return redirect(`/admin/mobile/pedido-fornecedor/${supplierId}/produtos`);
  }

  return ok({ supplierId, ...result });
}

export default function AdminMobilePedidoFornecedorQuantidades() {
  const { payload } = useLoaderData<typeof loader>();
  const { supplier, items, unitOptions, supplierId } = payload as any;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quantidades</p>
          <p className="text-base font-semibold text-slate-900">{supplier?.name}</p>
        </div>
        <Link to={`/admin/mobile/pedido-fornecedor/${supplierId}/produtos`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Produtos
        </Link>
      </div>

      <Form method="get" action={`/admin/mobile/pedido-fornecedor/${supplierId}/resumo`} className="space-y-3">
        {items.map((item: any, index: number) => (
          <article key={item.itemId} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <input type="hidden" name="itemId" value={item.itemId} />
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{index + 1} / {items.length}</p>
              <h2 className="mt-1 text-base font-bold leading-tight text-slate-900">{item.itemName}</h2>
            </div>

            <div className="grid grid-cols-[1fr_92px] gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quantidade</span>
                <input
                  type="text"
                  inputMode="decimal"
                  name="qty"
                  defaultValue={item.qty}
                  placeholder="Ex.: 10"
                  required
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-slate-900"
                  autoFocus={index === 0}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">UM</span>
                <select
                  name="unit"
                  defaultValue={item.unit || ""}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900"
                >
                  {unitOptions.map((unit: string) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>
            </div>
          </article>
        ))}

        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white">
          Ver riepilogo
          <ChevronRight className="h-4 w-4" />
        </button>
      </Form>
    </div>
  );
}
