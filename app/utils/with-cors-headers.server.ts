interface WithCorsHeadersOptions {
  allowOrigin: string;
  allowMethods?: string[];
  allowHeaders?: string[];
}

// utils/with-cors-headers.ts
export function withCorsHeaders(
  response: Response,
  {
    allowOrigin = "*",
    allowHeaders = ["Content-Type", "x-api-key"],
    allowMethods = ["GET, POST, OPTIONS"],
  }: WithCorsHeadersOptions
): Response {
  const headers = new Headers(response.headers);

  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Headers", allowHeaders.join(","));
  headers.set("Access-Control-Allow-Methods", allowMethods.join(","));

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
