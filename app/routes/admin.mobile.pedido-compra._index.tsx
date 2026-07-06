import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Boxes, Clock3, Store } from "lucide-react";
import { countOpenSupplierPurchaseOrders } from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

const optionClassName =
  "grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm";

export async function loader(_: LoaderFunctionArgs) {
  const openOrdersCount = await countOpenSupplierPurchaseOrders();
  return ok({ openOrdersCount });
}

export default function AdminMobilePedidoCompraIndex() {
  const { payload } = useLoaderData<typeof loader>();
  const openOrdersCount = Number(payload.openOrdersCount || 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        to="/admin/mobile/pedido-compra/por-fornecedor"
        className={optionClassName}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <Store className="h-5 w-5" />
        </span>
        <span className="contents">
          <span className="text-xs font-semibold leading-tight text-slate-900">
            Por fornecedor
          </span>
          <span className="col-span-2 text-[11px] leading-snug text-slate-600">
            Escolha o fornecedor e depois os produtos
          </span>
        </span>
      </Link>

      <Link
        to="/admin/mobile/pedido-compra/pedidos-abertos"
        className={optionClassName}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Clock3 className="h-5 w-5" />
        </span>
        <span className="contents">
          <span className="text-xs font-semibold leading-tight text-slate-900">
            Pedidos abertos
          </span>
          <span className="col-span-2 text-[11px] leading-snug text-slate-600">
            {openOrdersCount > 0
              ? `${openOrdersCount} pedido${
                  openOrdersCount !== 1 ? "s" : ""
                } aguardando conferencia`
              : "Acompanhe pedidos ainda nao finalizados"}
          </span>
        </span>
      </Link>

      <Link
        to="/admin/mobile/pedido-compra/por-produtos"
        className={optionClassName}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <Boxes className="h-5 w-5" />
        </span>
        <span className="contents">
          <span className="text-xs font-semibold leading-tight text-slate-900">
            Por produtos
          </span>
          <span className="col-span-2 text-[11px] leading-snug text-slate-600">
            Monte uma lista e compre em vários fornecedores
          </span>
        </span>
      </Link>
    </div>
  );
}
