import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { env } from "@config/env";
import {
  contentPostSocialSource,
  runContentTargetOperation,
} from "~/domain/content-post/content-post.server";
import { CONTENT_POST_CHANNELS } from "~/domain/content-post/content-post.shared";
import { publishStatusPublicationGroup } from "~/domain/whatsapp-status/whatsapp-status-publication-group.server";
import { readStatusPublicationExecutionInput } from "~/domain/whatsapp-status/whatsapp-status-publication.server";
import { publishInstagramStoryGroup } from "~/domain/instagram/instagram-story-publication-group.server";
import { readInstagramStoryExecutionInput } from "~/domain/instagram/instagram-story-publication.server";
import {
  enforceApiKey,
  enforceRateLimit,
  handleRouteError,
} from "~/domain/z-api/route-helpers.server";
import prismaClient from "~/lib/prisma/client.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  const rateLimitResponse = enforceRateLimit(
    request,
    env.apiRateLimitPerMinute,
    "content-publication-target"
  );
  if (rateLimitResponse) return rateLimitResponse;
  const authResponse = enforceApiKey(request);
  if (authResponse) return authResponse;

  try {
    const target = await prismaClient.contentPublicationTarget.findUnique({
      where: { id: String(params.id || "") },
      include: { ContentPost: true },
    });
    if (!target || target.deletedAt) {
      return json({ error: "target_not_found" }, { status: 404 });
    }
    if (!target.enabled || target.ContentPost.status !== "active") {
      return json({ error: "target_inactive" }, { status: 409 });
    }
    if (target.status === "needs_sync") {
      return json({ error: "target_needs_sync" }, { status: 409 });
    }

    const source = contentPostSocialSource(target.id);

    if (target.channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS) {
      const input = await readStatusPublicationExecutionInput(request.clone());
      const result = await runContentTargetOperation({
        targetId: target.id,
        operation: "publish",
        source: input.source,
        execute: () => publishStatusPublicationGroup(source, input),
        response: (value) => ({
          publications: value.publications.map((item) => item.publication.id),
        }),
      });
      return json({ ok: true, published: result.publications.length });
    }

    if (target.channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY) {
      const input = await readInstagramStoryExecutionInput(request.clone());
      const result = await runContentTargetOperation({
        targetId: target.id,
        operation: "publish",
        source: input.source,
        execute: () => publishInstagramStoryGroup(source, input),
        externalId: (value) =>
          value.publications.at(-1)?.publication.lastInstagramMediaId,
        response: (value) => ({
          publications: value.publications.map((item) => item.publication.id),
        }),
      });
      return json({ ok: true, published: result.publications.length });
    }

    return json({ error: "channel_not_publishable" }, { status: 409 });
  } catch (error) {
    return handleRouteError(error);
  }
}
