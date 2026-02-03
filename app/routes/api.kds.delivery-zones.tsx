import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";

const RATE_LIMIT_BUCKET = "kds-delivery-zones";

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimit = restApi.rateLimitCheck(request, { bucket: RATE_LIMIT_BUCKET });
  if (!rateLimit.success) {
    const retrySeconds = rateLimit.retryIn ? Math.ceil(rateLimit.retryIn / 1000) : 60;
    return json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(retrySeconds) } }
    );
  }

  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    const status = auth.status === 500 ? 500 : 401;
    return json({ error: "unauthorized", message: auth.message }, { status });
  }

  const zones = await prisma.deliveryZone.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      zipCode: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return json({ ok: true, zones });
}
