import { json } from "@remix-run/node";
import { PayloadTooLargeError, TooManyRequestsError, UnauthorizedError, ValidationError } from "./errors";
import { checkRateLimit, isApiKeyValid } from "./security.server";
import { ZApiError } from "./zapi-client.server";

export function enforceRateLimit(
  request: Request,
  limitPerMinute: number,
  bucket: string
) {
  const result = checkRateLimit(request, limitPerMinute, bucket);
  if (!result.allowed) {
    return json(
      { error: "too_many_requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter ?? 60),
        },
      }
    );
  }
  return null;
}

export function enforceApiKey(request: Request) {
  if (!isApiKeyValid(request)) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function handleRouteError(error: any) {
  if (error instanceof PayloadTooLargeError) {
    return json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ValidationError) {
    return json({ error: error.message }, { status: error.status });
  }

  if (error instanceof UnauthorizedError) {
    return json({ error: error.message }, { status: error.status });
  }

  if (error instanceof TooManyRequestsError) {
    return json(
      { error: error.message },
      {
        status: error.status,
        headers: error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined,
      }
    );
  }

  if (error instanceof ZApiError) {
    return json(
      { error: error.message, details: error.body ?? null },
      { status: error.status }
    );
  }

  console.error("[z-api] unexpected error", error);
  return json({ error: "internal_error" }, { status: 500 });
}
