import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request);

  const apiKey = process.env.MEDIA_UPLOAD_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: "upload_api_key_not_configured" }, { status: 503 });
  }

  const mediaService = await import("~/domain/media/media.service.server");

  return json({
    ok: true,
    uploadBaseUrl: mediaService.getMediaApiBaseUrl(),
    apiKey,
  });
}
