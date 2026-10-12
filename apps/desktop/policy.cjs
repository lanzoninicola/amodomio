function apiRequest(input) {
  const base = new URL(input.baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !["", "/"].includes(base.pathname)
  )
    throw new Error(
      "Informe a origem HTTP/HTTPS do servidor, sem caminho ou credenciais."
    );
  const url = new URL(input.path, base.origin);
  const method = input.method || "GET";
  const allowed = {
    "/api/mobile/servers": ["GET"],
    "/api/kds/mobile-auth": ["GET", "POST", "DELETE"],
    "/api/kds/orders": ["GET", "PATCH"],
    "/api/kds/whatsapp": ["GET", "POST"],
  };
  if (url.origin !== base.origin || !allowed[url.pathname]?.includes(method))
    throw new Error("Operação não permitida.");
  if (
    input.body != null &&
    (typeof input.body !== "string" || input.body.length > 65536)
  )
    throw new Error("Corpo inválido.");
  if (
    input.token != null &&
    (typeof input.token !== "string" || input.token.length > 8192)
  )
    throw new Error("Sessão inválida.");
  return { url: url.href, method };
}
module.exports = { apiRequest };
