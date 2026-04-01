import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";

/**
 * GET /api/measurement-units
 *
 * Returns the list of measurement units (unidades de consumo).
 *
 * Query params:
 *   active   - "true" | "false" | omit for all
 *   scope    - "global" | "restricted" | omit for all
 *   kind     - "weight" | "volume" | "count" | "custom" | omit for all
 *
 * Headers:
 *   x-api-key  (required) - REST API secret key
 *
 * Response 200:
 *   {
 *     "units": [
 *       {
 *         "id": "uuid",
 *         "code": "KG",
 *         "name": "Quilograma",
 *         "kind": "weight",
 *         "scope": "global",
 *         "active": true,
 *         "createdAt": "2024-01-01T00:00:00.000Z",
 *         "updatedAt": "2024-01-01T00:00:00.000Z"
 *       }
 *     ],
 *     "total": 5
 *   }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    const status = auth.status === 500 ? 500 : 401;
    return json({ error: "unauthorized", message: auth.message }, { status });
  }

  const url = new URL(request.url);
  const activeParam = url.searchParams.get("active");
  const scopeParam = url.searchParams.get("scope");
  const kindParam = url.searchParams.get("kind");

  const where: Record<string, unknown> = {};

  if (activeParam === "true") where.active = true;
  else if (activeParam === "false") where.active = false;

  if (scopeParam === "global" || scopeParam === "restricted") where.scope = scopeParam;

  const validKinds = ["weight", "volume", "count", "custom"];
  if (kindParam && validKinds.includes(kindParam)) where.kind = kindParam;

  try {
    const db = prisma as any;
    const units = await db.measurementUnit.findMany({
      where,
      orderBy: [{ active: "desc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        scope: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return json({ units, total: units.length });
  } catch (error) {
    return json({ error: "internal_server_error" }, { status: 500 });
  }
}
