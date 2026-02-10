import type { ActionFunctionArgs } from "@remix-run/node";
import { badRequest, ok } from "~/utils/http-response.server";
import prismaClient from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";
import { normalizePhone, sendTextMessage } from "~/domain/z-api/zapi.service";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { authenticator } from "~/domain/auth/google.server";

const CONTEXT = "whatsapp-no-response";
const LEGACY_CONTEXT = "admin-wpp-alert-panel";
const QUICK_REPLY_SETTING_NAME = "quick-reply-message";
const QUICK_REPLY_DEFAULT =
  "Recebemos sua mensagem e vamos te responder em instantes. Obrigado pela paciencia.";

async function getQuickReplyMessage() {
  const existing =
    await settingPrismaEntity.findByContextAndName(CONTEXT, QUICK_REPLY_SETTING_NAME) ||
    await settingPrismaEntity.findByContextAndName(LEGACY_CONTEXT, QUICK_REPLY_SETTING_NAME);
  const value = existing?.value?.trim();
  return value || QUICK_REPLY_DEFAULT;
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return badRequest("Não autorizado");

  const formData = await request.formData();
  const intent = String(formData.get("_intent") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const phoneE164Raw = String(formData.get("phoneE164") ?? "").trim();
  const correlationId = `${Date.now()}-${customerId || "unknown"}`;

  if (!intent) return badRequest("Intent inválido");
  if (!customerId) return badRequest("Customer inválido");

  const customer = await prismaClient.crmCustomer.findUnique({
    where: { id: customerId },
    select: { id: true, phone_e164: true },
  });
  if (!customer) return badRequest("Cliente não encontrado");

  const phoneE164 = customer.phone_e164 || phoneE164Raw;
  const normalizedPhone = normalizePhone(phoneE164);
  if (!normalizedPhone) return badRequest("Telefone inválido");

  if (intent === "ignore") {
    const payload = {
      action: "whatsapp_alert_ignored",
      by: user.email || "admin",
      phone: normalizedPhone,
      phone_e164: normalize_phone_e164_br(normalizedPhone),
      correlationId,
    };

    await prismaClient.crmCustomerEvent.create({
      data: {
        customer_id: customer.id,
        event_type: "WHATSAPP_ALERT_IGNORED",
        source: "admin-alert-panel",
        external_id: correlationId,
        payload,
        payload_raw: JSON.stringify(payload),
      },
    });

    return ok({ customerId: customer.id, intent });
  }

  if (intent === "quick-reply") {
    const message = await getQuickReplyMessage();
    const response = await sendTextMessage(
      { phone: normalizedPhone, message },
      { timeoutMs: 10_000 }
    );

    const payload = {
      action: "whatsapp_sent",
      channel: "admin-alert-quick-reply",
      by: user.email || "admin",
      phone: normalizedPhone,
      phone_e164: normalize_phone_e164_br(normalizedPhone),
      messageText: message,
      wppResponse: response,
      correlationId,
    };

    await prismaClient.crmCustomerEvent.create({
      data: {
        customer_id: customer.id,
        event_type: "WHATSAPP_SENT",
        source: "admin-alert-panel",
        external_id: correlationId,
        payload,
        payload_raw: JSON.stringify(payload),
      },
    });

    return ok({ customerId: customer.id, intent });
  }

  return badRequest("Intent não suportado");
}
