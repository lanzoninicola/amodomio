import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";

// Rota exclusiva para criação; retorna 409 se o cliente (phone_e164) já existir.
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!phone) return json({ error: "invalid_phone" }, { status: 400 });

  const phone_e164 = normalize_phone_e164_br(phone);
  if (!phone_e164) return json({ error: "invalid_phone" }, { status: 400 });

  const existing = await prisma.crmCustomer.findUnique({ where: { phone_e164 } });
  if (existing) {
    return json({ error: "customer_exists", customer_id: existing.id }, { status: 409 });
  }

  const customer = await prisma.crmCustomer.create({
    data: { phone_e164, name: name || null },
  });

  await prisma.crmCustomerEvent.create({
    data: {
      customer_id: customer.id,
      event_type: "PROFILE_CREATE",
      source: "api",
      payload: { action: "customer_create", source: "api" },
      payload_raw: "customer_create",
    },
  });

  return json(customer, { status: 201 });
}
