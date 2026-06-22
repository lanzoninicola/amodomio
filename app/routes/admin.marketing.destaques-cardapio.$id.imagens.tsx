import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { LinkIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  DEFAULT_HIGHLIGHT_LINK_BACKGROUND_COLOR,
  DEFAULT_HIGHLIGHT_LINK_TEXT_COLOR,
  getCardapioHighlightAdminImages,
  parseCardapioHighlightAdminImages,
} from "~/domain/cardapio/cardapio-highlight-admin.shared";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const section = await prismaClient.cardapioHighlightSection.findUnique({
    where: { id: String(params.id || "") },
    select: { title: true, imageItemsJson: true },
  });
  if (!section) throw new Response("Destaque não encontrado", { status: 404 });
  return json({
    section: {
      title: section.title,
      images: getCardapioHighlightAdminImages(section.imageItemsJson),
    },
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const section = await prismaClient.cardapioHighlightSection.findUnique({
    where: { id },
    select: { title: true },
  });
  if (!section) throw new Response("Destaque não encontrado", { status: 404 });

  const form = await request.formData();
  const images = parseCardapioHighlightAdminImages(form, section.title);
  if (!images.length) {
    return json(
      { ok: false, message: "Informe pelo menos uma imagem." },
      { status: 400 }
    );
  }

  await prismaClient.cardapioHighlightSection.update({
    where: { id },
    data: { imageItemsJson: images, deletedAt: null },
  });
  await invalidateCardapioIndexCache();
  return json({ ok: true, message: "Imagens salvas." });
}

export default function CardapioHighlightImagesPage() {
  const { section } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const images = section.images;

  return (
    <Form method="post" className="grid min-w-0 gap-6">
      <div>
        <h2 className="text-lg font-semibold">Imagens</h2>
        <p className="text-sm text-slate-500">
          URLs, versões ampliadas e links de cada imagem.
        </p>
      </div>

      {actionData?.message ? (
        <div
          className={
            actionData.ok
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {actionData.message}
        </div>
      ) : null}

      <a
        href="/admin/assets"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-blue-200 px-4 text-sm font-semibold text-blue-600 hover:bg-blue-50 sm:w-fit"
      >
        Abrir gerenciador de assets
      </a>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="imageUrls">Imagens públicas</Label>
          <Textarea
            id="imageUrls"
            name="imageUrls"
            rows={7}
            defaultValue={images.map((image) => image.imageUrl).join("\n")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fullscreenImageUrls">Imagens ampliadas</Label>
          <Textarea
            id="fullscreenImageUrls"
            name="fullscreenImageUrls"
            rows={7}
            defaultValue={images
              .map((image) => image.fullscreenImageUrl || image.imageUrl)
              .join("\n")}
          />
        </div>
      </div>

      {images.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`${image.imageUrl}-${index}`}
              className="overflow-hidden rounded-lg border border-slate-200"
            >
              <div className="relative">
                <img
                  src={image.imageUrl}
                  alt={image.alt || `${section.title} ${index + 1}`}
                  className="aspect-[4/5] w-full bg-slate-100 object-cover"
                />
                {image.linkUrl && image.linkText ? (
                  <div
                    className="absolute left-1/2 top-5 flex max-w-[88%] -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-lg"
                    style={{
                      backgroundColor:
                        image.linkBackgroundColor ||
                        DEFAULT_HIGHLIGHT_LINK_BACKGROUND_COLOR,
                      color:
                        image.linkTextColor ||
                        DEFAULT_HIGHLIGHT_LINK_TEXT_COLOR,
                    }}
                  >
                    <LinkIcon className="h-4 w-4" />
                    <span className="truncate">{image.linkText}</span>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 p-3">
                <div className="grid gap-2">
                  <Label htmlFor={`linkUrl_${index}`}>Link</Label>
                  <Input
                    id={`linkUrl_${index}`}
                    name={`linkUrl_${index}`}
                    defaultValue={image.linkUrl || ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`linkText_${index}`}>Texto do link</Label>
                  <Input
                    id={`linkText_${index}`}
                    name={`linkText_${index}`}
                    defaultValue={image.linkText || ""}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    name={`linkBackgroundColor_${index}`}
                    type="color"
                    defaultValue={
                      image.linkBackgroundColor ||
                      DEFAULT_HIGHLIGHT_LINK_BACKGROUND_COLOR
                    }
                  />
                  <Input
                    name={`linkTextColor_${index}`}
                    type="color"
                    defaultValue={
                      image.linkTextColor || DEFAULT_HIGHLIGHT_LINK_TEXT_COLOR
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={navigation.state === "submitting"}
          className="w-full sm:w-auto"
        >
          {navigation.state === "submitting" ? "Salvando..." : "Salvar imagens"}
        </Button>
      </div>
    </Form>
  );
}
