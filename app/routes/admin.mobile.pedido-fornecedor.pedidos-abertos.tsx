import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ArrowLeft, Clock3, Trash2 } from "lucide-react";
import {
  listOpenSupplierPurchaseOrders,
  removeOpenSupplierPurchaseOrder,
} from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader(_: LoaderFunctionArgs) {
  const openOrders = await listOpenSupplierPurchaseOrders();
  return ok({ openOrders });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");
  const orderId = String(form.get("orderId") || "");

  if (intent === "delete-order" && orderId) {
    await removeOpenSupplierPurchaseOrder(orderId);
  }

  return redirect("/admin/mobile/pedido-fornecedor/pedidos-abertos");
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
                <article
                  key={order.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <Link
                    to={`/admin/mobile/pedido-fornecedor/pedidos/${order.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {order.Supplier.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString("pt-BR")}{" "}
                        · {checkedCount}/{order.Items.length} conferidos
                      </span>
                    </span>
                    <Clock3 className="h-5 w-5 shrink-0 text-amber-600" />
                  </Link>
                  <Form method="post" className="shrink-0">
                    <input type="hidden" name="_intent" value="delete-order" />
                    <input type="hidden" name="orderId" value={order.id} />
                    <button
                      type="submit"
                      onClick={(event) => {
                        if (
                          !window.confirm(
                            `Eliminar pedido em aberto de ${order.Supplier.name}?`
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600"
                      aria-label={`Eliminar pedido de ${order.Supplier.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Form>
                </article>
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
