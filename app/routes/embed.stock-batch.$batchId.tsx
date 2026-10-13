import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import {
  commitEmbedSession,
  verifyEmbedToken,
} from "~/domain/auth/embed-session.server";

// Troca o token assinado (gerado pela API da extensão) por um cookie de sessão
// restrito a este lote, usado dentro do iframe no Suitable.
export async function loader({ request, params }: LoaderFunctionArgs) {
  const batchId = String(params.batchId || "");
  const token = new URL(request.url).searchParams.get("token");
  if (!batchId || !verifyEmbedToken(batchId, token))
    return new Response("Link expirado. Reabra a importação na extensão.", {
      status: 403,
    });
  const headers = new Headers();
  for (const cookie of await commitEmbedSession(batchId))
    headers.append("Set-Cookie", cookie);
  return redirect(
    `/admin/import-stock-movements/${encodeURIComponent(batchId)}/cards`,
    { headers }
  );
}
