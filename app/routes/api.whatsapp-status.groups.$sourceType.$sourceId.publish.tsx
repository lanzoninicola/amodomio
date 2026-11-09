import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { env } from "@config/env";
import { publishStatusPublicationGroup } from "~/domain/whatsapp-status/whatsapp-status-publication-group.server";
import { readStatusPublicationExecutionInput } from "~/domain/whatsapp-status/whatsapp-status-publication.server";
import {
  enforceApiKey,
  enforceRateLimit,
  handleRouteError,
} from "~/domain/z-api/route-helpers.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimitResponse = enforceRateLimit(
    request,
    env.apiRateLimitPerMinute,
    "zapi-status-publication-group"
  );
  if (rateLimitResponse) return rateLimitResponse;

  const authResponse = enforceApiKey(request);
  if (authResponse) return authResponse;

  try {
    const executionInput = await readStatusPublicationExecutionInput(request);
    const result = await publishStatusPublicationGroup(
      {
        sourceType: String(params.sourceType || ""),
        sourceId: String(params.sourceId || ""),
      },
      executionInput
    );

    return json({
      ok: true,
      source: result.source,
      published: result.publications.length,
      executions: result.publications.map((item) => ({
        publicationId: item.publication.id,
        executionId: item.execution.id,
        status: item.execution.status,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
