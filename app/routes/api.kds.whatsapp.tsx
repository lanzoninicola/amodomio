import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import { getEffectiveRoles } from "~/domain/auth/user-access";
import { ensureKdsWhatsappSetting } from "~/domain/kds/whatsapp-settings.server";
import { getOrderForApiById } from "~/domain/kds/server";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";
import {
  enforceRateLimit,
  handleRouteError,
} from "~/domain/z-api/route-helpers.server";
import { readJsonBody } from "~/domain/z-api/security.server";

async function access(request: Request) {
  const { user } = await getAuthenticatedBearerSession(request);
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const roles = getEffectiveRoles(user);
  if (!roles.some((role) => ["kdsOperator", "admin"].includes(role)))
    return json(
      { message: "Perfil sem acesso ao WhatsApp da cozinha." },
      { status: 403 }
    );
  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const denied = await access(request);
  if (denied) return denied;
  const setting = await ensureKdsWhatsappSetting();
  return json({ enabled: setting.value === "true" });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, { status: 405 });
  const denied = await access(request);
  if (denied) return denied;
  const limited = enforceRateLimit(request, 10, "kds-whatsapp");
  if (limited) return limited;
  if ((await ensureKdsWhatsappSetting()).value !== "true")
    return json(
      {
        message:
          "WhatsApp da cozinha desativado nas configurações do servidor.",
      },
      { status: 403 }
    );
  try {
    const body = await readJsonBody(request, 16_384);
    if (
      typeof body?.orderId !== "string" ||
      typeof body?.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 4096
    )
      return json(
        { message: "Informe o pedido e uma mensagem de até 4096 caracteres." },
        { status: 400 }
      );
    const order = await getOrderForApiById(body.orderId);
    if (!order)
      return json({ message: "Pedido não encontrado." }, { status: 404 });
    if (!order.customerPhone?.trim())
      return json({ message: "Pedido sem telefone." }, { status: 400 });
    await sendTextMessage({
      phone: order.customerPhone,
      message: body.message.trim(),
    });
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
