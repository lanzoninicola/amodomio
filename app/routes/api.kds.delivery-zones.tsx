import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
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

  const rateLimit = restApi.rateLimitCheck(request, {
    bucket: RATE_LIMIT_BUCKET,
  });
  if (!rateLimit.success) {
    const retrySeconds = rateLimit.retryIn
      ? Math.ceil(rateLimit.retryIn / 1000)
      : 60;
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

// Explicit creation from the Suitable review; importing an order never creates zones.
export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, { status: 405 });
  const limit = restApi.rateLimitCheck(request, { bucket: RATE_LIMIT_BUCKET });
  if (!limit.success)
    return json(
      { error: "Muitas solicitações. Aguarde um minuto." },
      { status: 429 }
    );
  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200)
    return json(
      { error: "Chave da API inválida." },
      { status: auth.status === 500 ? 500 : 401 }
    );
  const input = await request.json().catch(() => null);
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const city = typeof input?.city === "string" ? input.city.trim() : "";
  const state =
    typeof input?.state === "string" ? input.state.trim().toUpperCase() : "";
  if (
    !name ||
    name.length > 200 ||
    !city ||
    city.length > 200 ||
    !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(
      state
    )
  )
    return json(
      { error: "Informe nome, cidade e uma UF válida." },
      { status: 400 }
    );
  try {
    const existing = await prisma.deliveryZone.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        city: { equals: city, mode: "insensitive" },
        state: { equals: state, mode: "insensitive" },
      },
    });
    const zone =
      existing ??
      (await prisma.deliveryZone.create({ data: { name, city, state } }));
    return json({ ok: true, zone }, { status: existing ? 200 : 201 });
  } catch {
    return json(
      { error: "Não foi possível salvar o bairro. Tente novamente." },
      { status: 500 }
    );
  }
}
