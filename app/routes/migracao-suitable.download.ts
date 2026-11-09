import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";

const ALLOWED_HOSTS = new Set(["media.amodomio.com.br"]);

export const headers: HeadersFunction = () => ({
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

function sanitizeFilename(input?: string | null) {
  const normalized = String(input || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "arquivo";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const src = requestUrl.searchParams.get("src");
  const filename = sanitizeFilename(requestUrl.searchParams.get("filename"));

  if (!src) {
    throw new Response("Arquivo não informado", { status: 400 });
  }

  let remoteUrl: URL;
  try {
    remoteUrl = new URL(src);
  } catch {
    throw new Response("URL inválida", { status: 400 });
  }

  if (
    remoteUrl.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(remoteUrl.hostname)
  ) {
    throw new Response("Origem não permitida", { status: 403 });
  }

  const upstream = await fetch(remoteUrl, {
    headers: { Accept: "image/*,video/*,application/octet-stream" },
  });

  if (!upstream.ok || !upstream.body) {
    throw new Response("Não foi possível baixar o arquivo", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
