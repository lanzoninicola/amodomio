import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { StatusPublicationMediaForm } from "~/domain/whatsapp-status/components/status-publication-media-form";
import {
  clearStatusPublicationGroupPublishState,
  getStatusPublicationGroup,
  publishStatusPublicationGroup,
  syncStatusPublicationGroup,
} from "~/domain/whatsapp-status/whatsapp-status-publication-group.server";
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
    (item) => item.channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });
  const source = contentPostSocialSource(target.id);
  return json({
    post,
    target,
    whatsapp: await getStatusPublicationGroup(source),
    publishEndpoint: buildContentTargetPublishEndpoint(
      new URL(request.url).origin,
      target.id
    ),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const post = await getContentPost(String(params.id || ""));
  const target = post.Targets.find(
    (item) => item.channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS
  );
  if (!target) throw new Response("Canal não encontrado", { status: 404 });

  const form = await request.formData();
  const source = contentPostSocialSource(target.id);

  if (String(form.get("_intent") || "") === "unpublish") {
    await unpublishContentTarget(target.id);
    await clearStatusPublicationGroupPublishState(source);
    return json({ ok: true, message: "Status removido do WhatsApp." });
  }

  if (post.status !== "active") {
    return json(
      { ok: false, message: "Ative o conteúdo primeiro." },
      { status: 409 }
    );
  }

  await syncStatusPublicationGroup({
    source,
    caption: String(form.get("statusPublicationCaption") || post.caption || ""),
    selectedKeys: form
      .getAll("statusPublicationItemKey")
      .map((value) => String(value)),
    items: post.Media.map((media) => ({
      key: media.id,
      title: media.title,
      kind: media.kind === "video" ? ("video" as const) : ("image" as const),
      imageUrl: media.kind === "image" ? media.mediaUrl : null,
      videoUrl: media.kind === "video" ? media.mediaUrl : null,
    })),
  });
  await markContentTargetSynced(target.id);

  if (String(form.get("_intent") || "") === "publish") {
    try {
      const result = await runContentTargetOperation({
        targetId: target.id,
        operation: "publish",
        execute: () =>
          publishStatusPublicationGroup(source, { source: "manual" }),
        response: (value) => ({
          publications: value.publications.map((item) => item.publication.id),
        }),
      });
      return json({
        ok: true,
        message: `${result.publications.length} mídia(s) publicada(s).`,
      });
    } catch (error: any) {
      return json(
        { ok: false, message: error?.message || "Erro ao publicar." },
        { status: Number(error?.status) || 500 }
      );
    }
  }

  return json({ ok: true, message: "Configuração do WhatsApp salva." });
}

export default function ContentPostWhatsappPage() {
  const { post, target, whatsapp, publishEndpoint } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const publishBlockedReason =
    post.status !== "active"
      ? "Ative a publicação antes de publicar."
      : post.Media.length === 0
      ? "Adicione mídias à publicação para poder publicar."
      : null;
  const canUnpublish =
    target.status === "active" && Boolean(target.lastPublishedAt);

  return (
    <Form method="post" className="grid gap-6">
      <StatusPublicationMediaForm
        caption={whatsapp.caption || post.caption || ""}
        captionPlaceholder={post.caption || post.title}
        mediaItems={post.Media.map((media) => ({
          key: media.id,
          kind:
            media.kind === "video" ? ("video" as const) : ("image" as const),
          imageUrl: media.kind === "image" ? media.mediaUrl : null,
          videoUrl: media.kind === "video" ? media.mediaUrl : null,
          alt: media.alt,
          label: media.title,
        }))}
        publications={whatsapp.publications}
        selectedKeys={
          post.Media.length === 1 ? [post.Media[0].id] : whatsapp.selectedKeys
        }
        publishEndpoint={publishEndpoint}
        feedback={actionData || null}
        submitting={navigation.state === "submitting"}
        publishBlockedReason={publishBlockedReason}
        canUnpublish={canUnpublish}
      />
    </Form>
  );
}
