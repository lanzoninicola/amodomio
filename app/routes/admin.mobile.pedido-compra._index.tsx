import { Link } from "@remix-run/react";
import { Boxes, Store } from "lucide-react";

const optionClassName =
  "grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm";

export default function AdminMobilePedidoCompraIndex() {
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
