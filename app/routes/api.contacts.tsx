import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { env } from "@config/env";
import { enforceApiKey, enforceRateLimit, handleRouteError } from "~/domain/z-api/route-helpers.server";
import { listContacts } from "~/domain/z-api/zapi.service";

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimitResponse = enforceRateLimit(request, env.apiRateLimitPerMinute, "zapi-api");
  if (rateLimitResponse) return rateLimitResponse;

  const authResponse = enforceApiKey(request);
  if (authResponse) return authResponse;

  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? undefined;
  const pageSize = url.searchParams.get("pageSize") ?? undefined;

  try {
    const data = await listContacts({ page, pageSize });
    return json(data, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
