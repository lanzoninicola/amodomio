import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { env } from "@config/env";
import { enforceApiKey, enforceRateLimit, handleRouteError } from "~/domain/z-api/route-helpers.server";
import { readJsonBody } from "~/domain/z-api/security.server";
import { sendVideoMessage } from "~/domain/z-api/zapi.service";

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
    const result = await sendVideoMessage(body);
    return json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
