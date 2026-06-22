import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { Await, Link, useLoaderData } from "@remix-run/react";
import { ChevronRight, Plus, ShoppingBasket } from "lucide-react";
import { Suspense } from "react";
import { listMobilePurchaseLists } from "~/domain/purchase/purchase-shopping-list.server";

export async function loader(_: LoaderFunctionArgs) {
  return defer({ lists: listMobilePurchaseLists() });
}

export default function AdminMobilePedidoCompraPorProdutosIndex() {
  const { lists } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-4 pb-8">
      <Link
        to="/admin/mobile/pedido-compra/por-produtos/nova"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white"
      >
        <Plus className="h-5 w-5" />
        Nova lista de compras
      </Link>

      <section className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Listas em aberto
        </p>
        <Suspense
          fallback={
            <div className="h-20 animate-pulse rounded-xl bg-slate-200" />
          }
        >
          <Await resolve={lists}>
            {(resolvedLists: any[]) =>
              resolvedLists.length > 0 ? (
                <div className="space-y-2">
                  {resolvedLists.map((list) => {
                    const purchased = list.Items.filter(
                      (item: any) => item.purchased
                    ).length;
                    return (
                      <Link
                        key={list.id}
                        to={`/admin/mobile/pedido-compra/por-produtos/${list.id}`}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                          <ShoppingBasket className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {list.name}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {purchased}/{list.Items.length} comprados
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
                  Nenhuma lista em aberto.
                </div>
              )
            }
          </Await>
        </Suspense>
      </section>
    </div>
  );
}
