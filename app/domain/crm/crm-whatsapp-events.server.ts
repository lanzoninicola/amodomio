import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";

type LogWhatsappSentEventInput = {
  phone: string;
  source: string;
  messageText?: string | null;
  externalId?: string | null;
  payload?: Record<string, unknown>;
};

export async function logCrmWhatsappSentEventByPhone(input: LogWhatsappSentEventInput) {
  const phoneE164 = normalize_phone_e164_br(input.phone);
  if (!phoneE164) return { ok: false as const, reason: "invalid_phone" };

  const customer = await prisma.crmCustomer.findUnique({
    where: { phone_e164: phoneE164 },
    select: { id: true },
  });
  if (!customer) return { ok: false as const, reason: "customer_not_found" };

  const payload = {
    action: "whatsapp_sent",
    phone: input.phone,
    phone_e164: phoneE164,
    messageText: input.messageText?.trim() || undefined,
    ...(input.payload ?? {}),
  };

  await prisma.crmCustomerEvent.create({
    data: {
      customer_id: customer.id,
      event_type: "WHATSAPP_SENT",
      source: input.source,
      external_id: input.externalId || null,
      payload,
      payload_raw: JSON.stringify(payload),
    },
  });

  return { ok: true as const, customerId: customer.id };
}
