import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { env } from "@config/env";
import {
  enforceApiKey,
  enforceRateLimit,
  handleRouteError,
} from "~/domain/z-api/route-helpers.server";
import { getTrackedMessage } from "~/domain/z-api/message-tracking.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const auth = enforceApiKey(request);
  if (auth) return auth;
  const limit = enforceRateLimit(
    request,
    env.apiRateLimitPerMinute,
    "zapi-status"
  );
  if (limit) return limit;
  try {
    const result = await getTrackedMessage(params.trackingId || "");
    return json(result || { error: "message_not_found" }, {
      status: result ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
