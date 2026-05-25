import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useLocation } from "@remix-run/react";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { useState } from "react";
import { buildSupplierOrderMessage, parseSupplierOrderSelection } from "~/domain/supplier/supplier-order";
import { getSupplierOrderDraftItems } from "~/domain/supplier/supplier-order.server";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const supplierId = String(params.supplierId || "");
  const url = new URL(request.url);
  const selection = parseSupplierOrderSelection(url.searchParams).filter((item) => item.qty);

  if (selection.length === 0) {
    return redirect(`/admin/mobile/pedido-fornecedor/${supplierId}/produtos`);
  }

  const [draft, testPhoneSetting] = await Promise.all([
    getSupplierOrderDraftItems(supplierId, selection),
    settingPrismaEntity.findByOptionName("pedido-compra.test-phone"),
  ]);

  if (draft.items.length === 0) {
    return redirect(`/admin/mobile/pedido-fornecedor/${supplierId}/produtos`);
  }

  const orderMessage = buildSupplierOrderMessage(draft.supplier?.name || "", draft.items);

  return ok({
    supplierId,
    supplier: draft.supplier,
    items: draft.items,
    orderMessage,
    testPhone: testPhoneSetting?.value ?? null,
  });
}

export default function AdminMobilePedidoFornecedorResumo() {
  const { payload } = useLoaderData<typeof loader>();
  const { supplier, items, orderMessage, testPhone, supplierId } = payload as any;
  const location = useLocation();
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [copied, setCopied] = useState(false);

  const isSending = fetcher.state !== "idle";
  const sendResult = fetcher.data;

  function copyMessage() {
    navigator.clipboard.writeText(orderMessage).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  function sendOrder(phone: string, intent: string) {
    const formData = new FormData();
    formData.set("_intent", intent);
    formData.set("phone", phone);
    formData.set("message", orderMessage);
    fetcher.submit(formData, { method: "post", action: "/admin/mobile/pedido-fornecedor" });
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Riepilogo</p>
          <p className="text-base font-semibold text-slate-900">{supplier?.name}</p>
        </div>
        <Link to={`/admin/mobile/pedido-fornecedor/${supplierId}/quantidades${location.search}`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Alterar
        </Link>
      </div>

      <div className="space-y-2">
        {items.map((item: any) => (
          <article key={item.itemId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{item.itemName}</p>
              <p className="text-xs text-slate-500">{item.qty} {item.unit || ""}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">{orderMessage}</pre>
      </div>

      {sendResult ? (
        <p className={`text-sm font-medium ${sendResult.ok ? "text-emerald-600" : "text-red-600"}`}>
          {sendResult.ok ? "Mensagem enviada." : sendResult.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <button
          type="button"
          onClick={copyMessage}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copiado!" : "Copiar mensagem"}
        </button>

        <button
          type="button"
          disabled={isSending || !supplier?.phoneNumber}
          onClick={() => sendOrder(supplier.phoneNumber, "send-order")}
          title={!supplier?.phoneNumber ? "Fornecedor sem número cadastrado" : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {isSending ? "Enviando..." : "Enviar mensagem"}
        </button>

        <button
          type="button"
          disabled={isSending || !testPhone}
          onClick={() => sendOrder(testPhone, "send-test")}
          title={!testPhone ? "Configure o número de teste nas configurações globais (pedido-compra.test-phone)" : `Enviar para ${testPhone}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-600 disabled:opacity-40"
        >
          Enviar mensagem de teste
          {testPhone ? <span className="text-[11px] text-slate-400">({testPhone})</span> : null}
        </button>
      </div>
    </div>
  );
}
