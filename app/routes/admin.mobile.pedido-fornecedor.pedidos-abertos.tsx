import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ArrowLeft, Clock3 } from "lucide-react";
import { listOpenSupplierPurchaseOrders } from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader(_: LoaderFunctionArgs) {
  const openOrders = await listOpenSupplierPurchaseOrders();
  return ok({ openOrders });
}

export default function AdminMobilePedidoFornecedorPedidosAbertos() {
  const { payload } = useLoaderData<typeof loader>();
  const openOrders = (payload.openOrders || []) as any[];

  return (
    <div className="space-y-4 pb-8">
      <Link
        to="/admin/mobile/pedido-fornecedor"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para fornecedores
      </Link>

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Pedidos em aberto
        </p>

        {openOrders.length > 0 ? (
          <div className="space-y-2">
            {openOrders.map((order) => {
              const checkedCount = order.Items.filter(
                (item: any) => item.checked
              ).length;

              return (
                <Link
                  key={order.id}
                  to={`/admin/mobile/pedido-fornecedor/pedidos/${order.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {order.Supplier.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                      {checkedCount}/{order.Items.length} conferidos
                    </span>
                  </span>
                  <Clock3 className="h-5 w-5 shrink-0 text-amber-600" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-600">
            Nenhum pedido em aberto.
          </div>
        )}
      </section>
    </div>
  );
}
