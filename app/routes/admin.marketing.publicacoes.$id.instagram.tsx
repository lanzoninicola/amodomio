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
  getInstagramStoryGroup,
  publishInstagramStoryGroup,
  syncInstagramStoryGroup,
} from "~/domain/instagram/instagram-story-publication-group.server";
import {
  contentPostSocialSource,
  getContentPost,
  markContentTargetSynced,
  runContentTargetOperation,
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
  if (!target.enabled || post.status !== "active") {
    return json(
      { ok: false, message: "Ative o conteúdo e o canal Instagram primeiro." },
      { status: 409 }
    );
  }

  const form = await request.formData();
  const source = contentPostSocialSource(target.id);
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

  return (
    <Form method="post" className="grid gap-6">
      {!target.enabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Habilite Instagram Story na aba Canais.
        </div>
      ) : null}
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
      />
    </Form>
  );
}
