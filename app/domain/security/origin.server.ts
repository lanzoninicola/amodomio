const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://www.amodomio.com.br",
  "https://amodomio.com.br",
]);

const getOriginFromReferer = (referer: string) => {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

export const buildAllowedOrigins = (request: Request) => {
  const requestOrigin = new URL(request.url).origin;
  return new Set([requestOrigin, ...DEFAULT_ALLOWED_ORIGINS]);
};

export const isAllowedRequestOrigin = (request: Request) => {
  const allowedOrigins = buildAllowedOrigins(request);
  const origin = request.headers.get("Origin");

  if (origin) {
    return allowedOrigins.has(origin);
  }

  const referer = request.headers.get("Referer");
  if (referer) {
    const refererOrigin = getOriginFromReferer(referer);
    return refererOrigin ? allowedOrigins.has(refererOrigin) : false;
  }

  return process.env.NODE_ENV !== "production";
};
