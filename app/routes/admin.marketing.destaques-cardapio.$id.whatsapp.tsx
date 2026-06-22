import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { getCardapioHighlightAdminImages } from "~/domain/cardapio/cardapio-highlight-admin.shared";
import {
  getStatusPublicationGroup,
  publishStatusPublicationGroup,
  syncStatusPublicationGroup,
} from "~/domain/whatsapp-status/whatsapp-status-publication-group.server";
import { buildStatusGroupPublishEndpoint } from "~/domain/whatsapp-status/whatsapp-status-publication.shared";
import { StatusPublicationMediaForm } from "~/domain/whatsapp-status/components/status-publication-media-form";
import prismaClient from "~/lib/prisma/client.server";

const SOURCE_TYPE = "cardapio-highlight";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const id = String(params.id || "");
  const section = await prismaClient.cardapioHighlightSection.findUnique({
    where: { id },
    select: { id: true, title: true, subtitle: true, imageItemsJson: true },
  });
  if (!section) throw new Response("Destaque não encontrado", { status: 404 });

  const whatsapp = await getStatusPublicationGroup({
    sourceType: SOURCE_TYPE,
    sourceId: id,
  });
  return json({
    section: {
      ...section,
      images: getCardapioHighlightAdminImages(section.imageItemsJson),
    },
    whatsapp,
    publishEndpoint: buildStatusGroupPublishEndpoint(
      new URL(request.url).origin,
      SOURCE_TYPE,
      id
    ),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const form = await request.formData();
  const section = await prismaClient.cardapioHighlightSection.findUnique({
    where: { id },
    select: { id: true, title: true, imageItemsJson: true, deletedAt: true },
  });
  if (!section || section.deletedAt) {
    throw new Response("Destaque não encontrado", { status: 404 });
  }

  const images = getCardapioHighlightAdminImages(section.imageItemsJson);
  const source = { sourceType: SOURCE_TYPE, sourceId: section.id };
  await syncStatusPublicationGroup({
    source,
    caption: String(form.get("statusPublicationCaption") || ""),
    selectedKeys: form
      .getAll("statusPublicationItemKey")
      .map((value) => String(value)),
    items: images.map((image, index) => ({
      key: String(index),
      title: `${section.title} — imagem ${index + 1}`,
      kind: "image",
      imageUrl: image.imageUrl,
    })),
  });

  if (String(form.get("_intent") || "") === "publish") {
    try {
      const result = await publishStatusPublicationGroup(source, {
        source: "manual",
      });
      return json({
        ok: true,
        message: `${result.publications.length} imagem(ns) publicada(s).`,
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

export default function CardapioHighlightWhatsappPage() {
  const { section, whatsapp, publishEndpoint } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <Form method="post" className="grid min-w-0 gap-6">
      <StatusPublicationMediaForm
        caption={whatsapp.caption}
        captionPlaceholder={`${section.title}\n${section.subtitle || ""}`}
        mediaItems={section.images.map((image, index) => ({
          key: String(index),
          imageUrl: image.imageUrl,
          alt: image.alt,
          label: `Imagem ${index + 1}`,
        }))}
        publications={whatsapp.publications}
        selectedKeys={whatsapp.selectedKeys}
        publishEndpoint={publishEndpoint}
        feedback={actionData || null}
        submitting={navigation.state === "submitting"}
      />
    </Form>
  );
}
