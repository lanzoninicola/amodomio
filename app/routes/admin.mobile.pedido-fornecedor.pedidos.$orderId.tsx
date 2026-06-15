import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { Check, CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { buildSupplierOrderMessage } from "~/domain/supplier/supplier-order";
import {
  getSupplierPurchaseOrder,
  removeSupplierPurchaseOrderItem,
  toggleSupplierPurchaseOrderItemChecked,
} from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const orderId = String(params.orderId || "");
  const order = await getSupplierPurchaseOrder(orderId);
  if (!order) return redirect("/admin/mobile/pedido-fornecedor");

  const orderMessage = buildSupplierOrderMessage(
    order.Supplier.name,
    order.Items.map((item: any) => ({
      itemId: item.itemId,
      itemName: item.Item.name,
      qty: String(item.quantity),
      unit: item.unit,
    }))
  );
  return ok({ order, orderMessage });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const orderId = String(params.orderId || "");
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");
  const orderItemId = String(form.get("orderItemId") || "");

  if (intent === "toggle-check")
    await toggleSupplierPurchaseOrderItemChecked(orderId, orderItemId);
  if (intent === "remove-item")
    await removeSupplierPurchaseOrderItem(orderId, orderItemId);
  return redirect(`/admin/mobile/pedido-fornecedor/pedidos/${orderId}`);
}

export default function AdminMobilePedidoFornecedorPedido() {
  const { payload } = useLoaderData<typeof loader>();
  const { order, orderMessage } = payload as any;
  const [copied, setCopied] = useState(false);
  const checkedCount = order.Items.filter((item: any) => item.checked).length;

  function copyMessage() {
    navigator.clipboard.writeText(orderMessage).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Pedido para
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {order.Supplier.name}
            </h2>
            <p className="text-xs text-slate-500">
              {new Date(order.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              order.status === "received"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {order.status === "received" ? "Conferido" : "Aberto"}
          </span>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">
          {checkedCount} de {order.Items.length} produtos conferidos
        </p>
      </div>

      <Link
        to={`/admin/mobile/pedido-fornecedor/${order.supplierId}/produtos?orderId=${order.id}`}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800"
      >
        <Plus className="h-4 w-4" />
        Adicionar ou alterar produtos
      </Link>

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Conferência da entrega
        </p>
        {order.Items.map((item: any) => (
          <article
            key={item.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
              item.checked
                ? "border-emerald-300 bg-emerald-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <Form method="post" className="min-w-0 flex-1">
              <input type="hidden" name="_intent" value="toggle-check" />
              <input type="hidden" name="orderItemId" value={item.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-3 text-left"
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    item.checked
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {item.checked ? <Check className="h-4 w-4" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {item.Item.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {item.quantity} {item.unit}
                  </span>
                </span>
              </button>
            </Form>
            <Form method="post">
              <input type="hidden" name="_intent" value="remove-item" />
              <input type="hidden" name="orderItemId" value={item.id} />
              <button
                type="submit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600"
                aria-label={`Remover ${item.Item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Form>
          </article>
        ))}
      </section>

      {order.status === "received" ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          Entrega conferida
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
          {orderMessage}
        </pre>
      </div>
      <button
        type="button"
        onClick={copyMessage}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white"
      >
        <Copy className="h-4 w-4" />
        {copied ? "Copiado!" : "Copiar mensagem para WhatsApp"}
      </button>
    </div>
  );
}
