import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { enforceRateLimit } from "~/domain/z-api/route-helpers.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = { "Cache-Control": "no-store" };
  if (!(await authenticator.isAuthenticated(request)))
    return json({ online: null }, { status: 401, headers });
  const limited = enforceRateLimit(request, 60, "media-header-status");
  if (limited) return limited;
  try {
    const mediaService = await import("~/domain/media/media.service.server");
    const result = await mediaService.checkMediaApiHealth();
    return json(
      {
        online: result.ok,
        endpoint: result.endpoint,
        httpStatus: result.status,
        baseUrl: mediaService.getMediaApiBaseUrl(),
        details: JSON.stringify(result.details ?? null).slice(0, 500),
        checkedAt: Date.now(),
      },
      { headers }
    );
  } catch {
    return json({ online: null, checkedAt: Date.now() }, { status: 502, headers });
  }
}
