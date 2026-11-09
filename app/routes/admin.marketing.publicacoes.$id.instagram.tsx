import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { InstagramStoryMediaForm } from "~/domain/instagram/components/instagram-story-media-form";
import { getInstagramConnection } from "~/domain/instagram/instagram-facebook-login.server";
import {
  clearInstagramStoryGroupPublishState,
  getInstagramStoryGroup,
  publishInstagramStoryGroup,
  syncInstagramStoryGroup,
} from "~/domain/instagram/instagram-story-publication-group.server";
import {
  contentPostSocialSource,
  getContentPost,
  markContentTargetSynced,
  runContentTargetOperation,
  unpublishContentTarget,
} from "~/domain/content-post/content-post.server";
import { CONTENT_POST_CHANNELS } from "~/domain/content-post/content-post.shared";
import { buildContentTargetPublishEndpoint } from "~/domain/content-post/content-post.shared";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const post = await getContentPost(String(params.id || ""));
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });
  const source = contentPostSocialSource(target.id);
  const [instagram, connection] = await Promise.all([
    getInstagramStoryGroup(source),
    getInstagramConnection(),
  ]);
  return json({
    post,
    target,
    instagram,
    connected: connection?.status === "connected",
    publishEndpoint: buildContentTargetPublishEndpoint(
      new URL(request.url).origin,
      target.id
    ),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const post = await getContentPost(String(params.id || ""));
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });

  const form = await request.formData();
  const source = contentPostSocialSource(target.id);

  if (String(form.get("_intent") || "") === "unpublish") {
    await unpublishContentTarget(target.id);
    await clearInstagramStoryGroupPublishState(source);
    return json({ ok: true, message: "Story removido do Instagram." });
  }

  if (post.status !== "active") {
    return json(
      { ok: false, message: "Ative o conteúdo primeiro." },
      { status: 409 }
    );
  }

  await syncInstagramStoryGroup({
    source,
    selectedKeys: form
      .getAll("instagramStoryItemKey")
      .map((value) => String(value)),
    items: post.Media.map((media) => ({
      key: media.id,
      title: media.title,
      kind: media.kind === "video" ? "video" : "image",
      mediaUrl: media.fullscreenMediaUrl || media.mediaUrl,
    })),
  });
  await markContentTargetSynced(target.id);

  if (String(form.get("_intent") || "") === "publish") {
    try {
      const result = await runContentTargetOperation({
        targetId: target.id,
        operation: "publish",
        execute: () => publishInstagramStoryGroup(source, { source: "manual" }),
        externalId: (value) =>
          value.publications.at(-1)?.publication.lastInstagramMediaId,
        response: (value) => ({
          publications: value.publications.map((item) => item.publication.id),
        }),
      });
      return json({
        ok: true,
        message: `${result.publications.length} Story(s) publicado(s).`,
      });
    } catch (error: any) {
      return json(
        {
          ok: false,
          message: error?.message || "Erro ao publicar no Instagram.",
        },
        { status: Number(error?.status) || 500 }
      );
    }
  }

  return json({ ok: true, message: "Configuração do Instagram salva." });
}

export default function ContentPostInstagramPage() {
  const { post, target, instagram, connected, publishEndpoint } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const canUnpublish = target.status === "active" && Boolean(target.lastPublishedAt);

  return (
    <Form method="post" className="grid gap-6">
      <InstagramStoryMediaForm
        mediaItems={post.Media.map((media) => ({
          key: media.id,
          imageUrl: media.fullscreenMediaUrl || media.mediaUrl,
          alt: media.alt,
          label: media.title,
        }))}
        publications={instagram.publications}
        selectedKeys={instagram.selectedKeys}
        publishEndpoint={publishEndpoint}
        feedback={actionData || null}
        submitting={navigation.state === "submitting"}
        connected={connected}
        canUnpublish={canUnpublish}
      />
    </Form>
  );
}
