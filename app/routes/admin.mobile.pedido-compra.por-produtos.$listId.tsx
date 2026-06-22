import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, redirect } from "@remix-run/node";
import { Await, Form, useLoaderData, useNavigation } from "@remix-run/react";
import { Check, ShoppingBasket } from "lucide-react";
import { Suspense } from "react";
import {
  getMobilePurchaseList,
  listMobilePurchaseSuppliers,
  updateMobilePurchaseListItem,
} from "~/domain/purchase/purchase-shopping-list.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const listId = String(params.listId || "");
  return defer({
    data: Promise.all([
      getMobilePurchaseList(listId),
      listMobilePurchaseSuppliers(),
    ]),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const listId = String(params.listId || "");
  const form = await request.formData();
  const listItemId = String(form.get("listItemId") || "");
  const supplierId = String(form.get("supplierId") || "") || null;
  const purchased = String(form.get("purchased") || "") === "true";

  if (listId && listItemId) {
    await updateMobilePurchaseListItem({
      listId,
      listItemId,
      supplierId,
      purchased,
    });
  }

  return redirect(`/admin/mobile/pedido-compra/por-produtos/${listId}`);
}

export default function AdminMobilePedidoCompraPorProdutosLista() {
  const { data } = useLoaderData<typeof loader>();

  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
      }
    >
      <Await resolve={data}>
        {([list, suppliers]: any[]) =>
          list ? (
            <PurchaseList list={list} suppliers={suppliers} />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Lista não encontrada.
            </div>
          )
        }
      </Await>
    </Suspense>
  );
}

function PurchaseList({ list, suppliers }: { list: any; suppliers: any[] }) {
  const navigation = useNavigation();
  const purchasedCount = list.Items.filter(
    (item: any) => item.purchased
  ).length;

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <ShoppingBasket className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">{list.name}</h2>
            <p className="text-xs text-slate-500">
              {purchasedCount}/{list.Items.length} comprados
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {list.Items.map((item: any) => (
          <Form
            key={item.id}
            method="post"
            className={`rounded-xl border p-3 ${
              item.purchased
                ? "border-green-300 bg-green-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <input type="hidden" name="listItemId" value={item.id} />
            <input
              type="hidden"
              name="purchased"
              value={item.purchased ? "false" : "true"}
            />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-base font-semibold ${
                    item.purchased
                      ? "text-green-800 line-through"
                      : "text-slate-900"
                  }`}
                >
                  {item.Item?.name || item.name}
                </p>
                <p className="text-sm text-slate-500">
                  {item.quantity} {item.unit || ""}
                </p>
              </div>
              <button
                type="submit"
                disabled={navigation.state !== "idle"}
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 ${
                  item.purchased
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-slate-300 bg-white text-transparent"
                }`}
                aria-label={
                  item.purchased
                    ? `Marcar ${item.name} como pendente`
                    : `Marcar ${item.name} como comprado`
                }
              >
                <Check className="h-6 w-6" />
              </button>
            </div>

            <label className="mt-3 block border-t border-slate-200 pt-3">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Comprado em
              </span>
              <select
                name="supplierId"
                defaultValue={item.supplierId || ""}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
              >
                <option value="">Selecionar supermercado</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
          </Form>
        ))}
      </div>
    </div>
  );
}
