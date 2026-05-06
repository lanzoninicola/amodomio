import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { env } from "@config/env";
import { logCrmWhatsappSentEventByPhone } from "~/domain/crm/crm-whatsapp-events.server";
import { enforceApiKey, enforceRateLimit, handleRouteError } from "~/domain/z-api/route-helpers.server";
import { readJsonBody } from "~/domain/z-api/security.server";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimitResponse = enforceRateLimit(request, env.apiRateLimitPerMinute, "zapi-api");
  if (rateLimitResponse) return rateLimitResponse;

  const authResponse = enforceApiKey(request);
  if (authResponse) return authResponse;

  try {
    const body = await readJsonBody(request);
    const result = await sendTextMessage(body);
    await logCrmWhatsappSentEventByPhone({
      phone: String(body?.phone || ""),
      source: "api.messages.text",
      messageText: String(body?.message || ""),
      payload: {
        channel: "api.messages.text",
        fromMe: true,
        wppResponse: result,
      },
    });
    return json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
