import type { LoaderFunctionArgs } from "@remix-run/node";

const ALLOWED_HOSTS = new Set([
  "media.amodomio.com.br",
  "res.cloudinary.com",
]);

function sanitizeFilename(input?: string | null) {
  const raw = String(input || "").trim();
  if (!raw) return "arquivo";

  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "arquivo";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const src = url.searchParams.get("src");
  const filename = sanitizeFilename(url.searchParams.get("filename"));

  if (!src) {
    throw new Response("Arquivo não informado", { status: 400 });
  }

  let remoteUrl: URL;
  try {
    remoteUrl = new URL(src);
  } catch {
    throw new Response("URL inválida", { status: 400 });
  }

  if (!["http:", "https:"].includes(remoteUrl.protocol)) {
    throw new Response("Protocolo inválido", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(remoteUrl.hostname)) {
    throw new Response("Host não permitido", { status: 403 });
  }

  const upstream = await fetch(remoteUrl.toString());

  if (!upstream.ok || !upstream.body) {
    throw new Response("Não foi possível baixar o arquivo", { status: 502 });
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
