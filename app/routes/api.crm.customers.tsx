import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";

type ContactRequest = {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  preferred_channel?: string;
  source?: string;
  gender?: string;
};

const RATE_LIMIT_BUCKET = "crm-contact";

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    const status = auth.status === 500 ? 500 : 401;
    return json({ error: "unauthorized", message: auth.message }, { status });
  }

  const url = new URL(request.url);
  const phone = (url.searchParams.get("phone") || "").trim();
  const digits = phone.replace(/\D+/g, "");
  const last8 = digits.slice(-8);

  if (!last8 || last8.length < 8) {
    return json({ error: "invalid_phone" }, { status: 400 });
  }

  const customer = await prisma.crmCustomer.findFirst({
    where: { phone_e164: { endsWith: last8 } },
    select: { id: true, name: true, phone_e164: true },
  });

  return json({
    exists: Boolean(customer),
    customer,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimit = restApi.rateLimitCheck(request, {
    bucket: RATE_LIMIT_BUCKET,
  });

  if (!rateLimit.success) {
    const retrySeconds = rateLimit.retryIn ? Math.ceil(rateLimit.retryIn / 1000) : 60;
    return json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(retrySeconds) } }
    );
  }

  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    const status = auth.status === 500 ? 500 : 401;
    return json({ error: "unauthorized", message: auth.message }, { status });
  }

  let body: ContactRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const source = typeof body?.source === "string" && body.source.trim() ? body.source.trim() : "rest-api";
  const preferredChannelRaw =
    typeof body?.preferred_channel === "string" ? body.preferred_channel.trim().toLowerCase() : "";
  const genderRaw =
    typeof body?.gender === "string"
      ? body.gender.trim().toLowerCase()
      : "";

  if (!name) return json({ error: "invalid_name" }, { status: 400 });
  if (!phone) return json({ error: "invalid_phone" }, { status: 400 });

  const phone_e164 = normalize_phone_e164_br(phone);
  if (!phone_e164) return json({ error: "invalid_phone" }, { status: 400 });

  const preferred_channel = ["whatsapp", "phone", "unknown"].includes(preferredChannelRaw)
    ? preferredChannelRaw
    : undefined;
  const gender = ["female", "male", "unknown"].includes(genderRaw) ? genderRaw : undefined;

  const existing = await prisma.crmCustomer.findUnique({ where: { phone_e164 } });
  const customer = existing
    ? await prisma.crmCustomer.update({
        where: { phone_e164 },
        data: {
          name,
          email: email || undefined,
          preferred_channel: preferred_channel ?? undefined,
          gender: gender ?? undefined,
        },
      })
    : await prisma.crmCustomer.create({
        data: {
          phone_e164,
          name,
          email: email || null,
          preferred_channel: preferred_channel ?? "unknown",
          gender: gender ?? "unknown",
        },
      });

  const eventPayload = {
    action: "contact_received",
    name,
    phone,
    email: email || undefined,
    message: message || undefined,
    preferred_channel: preferred_channel || undefined,
    source,
    gender: gender || undefined,
  };

  await prisma.crmCustomerEvent.create({
    data: {
      customer_id: customer.id,
      event_type: "CONTACT_FORM",
      source,
      payload: eventPayload,
      payload_raw: JSON.stringify(eventPayload),
    },
  });

  return json(
    { customer_id: customer.id, created: !existing },
    { status: existing ? 200 : 201 }
  );
}
