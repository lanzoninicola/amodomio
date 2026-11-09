import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { getZapiConnection } from "~/domain/z-api/zapi-client.server";
import { enforceRateLimit } from "~/domain/z-api/route-helpers.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = { "Cache-Control": "no-store" };
  if (!(await authenticator.isAuthenticated(request)))
    return json({ connected: null }, { status: 401, headers });
  const limited = enforceRateLimit(request, 60, "zapi-header-status");
  if (limited) return limited;
  try {
    const result = await getZapiConnection({ timeoutMs: 5_000 });
    return json(
      { connected: result.connected, checkedAt: Date.now() },
      { headers }
    );
  } catch {
    return json(
      { connected: null, checkedAt: Date.now() },
      { status: 502, headers }
    );
  }
}
