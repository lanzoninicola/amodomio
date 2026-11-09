import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { env } from "@config/env";
import {
  publishConfiguredStatus,
  readStatusPublicationExecutionInput,
} from "~/domain/whatsapp-status/whatsapp-status-publication.server";
import {
  enforceApiKey,
  enforceRateLimit,
  handleRouteError,
} from "~/domain/z-api/route-helpers.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimitResponse = enforceRateLimit(
    request,
    env.apiRateLimitPerMinute,
    "zapi-status-publish"
  );
  if (rateLimitResponse) return rateLimitResponse;

  const authResponse = enforceApiKey(request);
  if (authResponse) return authResponse;

  try {
    const executionInput = await readStatusPublicationExecutionInput(request);
    const result = await publishConfiguredStatus(executionInput);
    return json(
      {
        ok: true,
        id: result.publication.id,
        title: result.publication.title,
        kind: result.publication.kind,
        execution: {
          id: result.execution.id,
          source: result.execution.source,
          status: result.execution.status,
          startedAt: result.execution.startedAt,
          finishedAt: result.execution.finishedAt,
          durationMs: result.execution.durationMs,
          notificationStatus: result.execution.notificationStatus,
          notificationError: result.execution.notificationError,
        },
        response: result.response,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
