import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { parseSupplierOrderSelection } from "~/domain/supplier/supplier-order";
import { saveSupplierPurchaseOrder } from "~/domain/supplier/supplier-order.server";
import { normalizePhone } from "~/domain/z-api/zapi.service";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";

export const meta: MetaFunction = () => [
  { title: "Admin Mobile | Pedido por fornecedor" },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");
  const message = String(form.get("message") || "");
  const phone = String(form.get("phone") || "");

  try {
    if (intent === "save-order") {
      const supplierId = String(form.get("supplierId") || "");
      const orderId = String(form.get("orderId") || "") || null;
      const selection = parseSupplierOrderSelection(
        new URLSearchParams(form as any)
      );
      const order = await saveSupplierPurchaseOrder(
        supplierId,
        selection,
        orderId
      );
      if (!order)
        return json(
          {
            ok: false,
            error: "Selecione produtos com UM e quantidade válidas.",
          },
          { status: 400 }
        );
      return redirect(
        `/admin/mobile/pedido-compra/por-fornecedor/pedidos/${order.id}`
      );
    }

    if (intent === "send-order" || intent === "send-test") {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        return json({ ok: false, error: "Número de telefone inválido." });
      }

      await sendTextMessage({ phone: normalized, message });
      return json({ ok: true });
    }

    return json({ ok: false, error: "Ação inválida." });
  } catch (error: any) {
    return json({
      ok: false,
      error: error?.message ?? "Erro ao enviar mensagem.",
    });
  }
}

export default function AdminMobilePedidoFornecedorLayout() {
  return <Outlet />;
}
