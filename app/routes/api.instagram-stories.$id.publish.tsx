import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { env } from "@config/env";
import {
  publishInstagramStory,
  readInstagramStoryExecutionInput,
} from "~/domain/instagram/instagram-story-publication.server";
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
    "instagram-story-publish"
  );
  if (rateLimitResponse) return rateLimitResponse;

  const authResponse = enforceApiKey(request);
  if (authResponse) return authResponse;

  try {
    const executionInput = await readInstagramStoryExecutionInput(request);
    const result = await publishInstagramStory(
      String(params.id || ""),
      executionInput
    );
    return json({
      ok: true,
      publicationId: result.publication.id,
      instagramMediaId: result.publication.lastInstagramMediaId,
      executionId: result.execution.id,
      status: result.execution.status,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
