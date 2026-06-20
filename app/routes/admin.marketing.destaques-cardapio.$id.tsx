import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { ChevronLeft, LinkIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";

type ImageItem = {
  imageUrl: string;
  fullscreenImageUrl?: string | null;
  alt?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  linkBackgroundColor?: string | null;
  linkTextColor?: string | null;
};

const DEFAULT_LINK_BACKGROUND_COLOR = "#ffffff";
const DEFAULT_LINK_TEXT_COLOR = "#111111";

function normalizeHexColor(value: string, fallback: string) {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.section.title || "Destaque"} | Marketing` },
];

function parseSortOrder(value: FormDataEntryValue | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function parseImageItems(form: FormData) {
  const imageUrls = String(form.get("imageUrls") || "")
    .split(/\r?\n/g)
    .map((url) => url.trim())
    .filter(Boolean);
  const fullscreenUrls = String(form.get("fullscreenImageUrls") || "")
    .split(/\r?\n/g)
    .map((url) => url.trim());
  const title = String(form.get("title") || "Destaque").trim();

  return imageUrls.map((imageUrl, index) => ({
    imageUrl,
    fullscreenImageUrl: fullscreenUrls[index]?.trim() || imageUrl,
    alt: `${title}, imagem ${index + 1}`,
    linkUrl: String(form.get(`linkUrl_${index}`) || "").trim() || null,
    linkText: String(form.get(`linkText_${index}`) || "").trim() || null,
    linkBackgroundColor: normalizeHexColor(
      String(form.get(`linkBackgroundColor_${index}`) || ""),
      DEFAULT_LINK_BACKGROUND_COLOR
    ),
    linkTextColor: normalizeHexColor(
      String(form.get(`linkTextColor_${index}`) || ""),
      DEFAULT_LINK_TEXT_COLOR
    ),
  }));
}

function getImageItems(value: unknown): ImageItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const imageUrl = String((item as ImageItem).imageUrl || "").trim();
      if (!imageUrl) return null;
      return {
        imageUrl,
        fullscreenImageUrl:
          String((item as ImageItem).fullscreenImageUrl || "").trim() ||
          imageUrl,
        alt: String((item as ImageItem).alt || "").trim() || null,
        linkUrl: String((item as ImageItem).linkUrl || "").trim() || null,
        linkText: String((item as ImageItem).linkText || "").trim() || null,
        linkBackgroundColor: normalizeHexColor(
          String((item as ImageItem).linkBackgroundColor || ""),
          DEFAULT_LINK_BACKGROUND_COLOR
        ),
        linkTextColor: normalizeHexColor(
          String((item as ImageItem).linkTextColor || ""),
          DEFAULT_LINK_TEXT_COLOR
        ),
      };
    })
    .filter((item): item is ImageItem => Boolean(item));
}

function imageUrlsText(items: ImageItem[]) {
  return items.map((item) => item.imageUrl).join("\n");
}

function fullscreenUrlsText(items: ImageItem[]) {
  return items
    .map((item) => item.fullscreenImageUrl || item.imageUrl)
    .join("\n");
}

export async function loader({ params }: LoaderFunctionArgs) {
  const section = await prismaClient.cardapioHighlightSection.findFirst({
    where: {
      id: String(params.id || ""),
    },
  });

  if (!section) throw new Response("Destaque não encontrado", { status: 404 });

  return json({
    section: {
      ...section,
      images: getImageItems(section.imageItemsJson),
    },
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const form = await request.formData();
  const intent = String(form.get("_intent") || "update");
  const activeTab = String(form.get("_activeTab") || "content");

  if (intent === "delete") {
    await prismaClient.cardapioHighlightSection.update({
      where: { id },
      data: { deletedAt: new Date(), published: false },
    });
    await invalidateCardapioIndexCache();
    throw redirect("/admin/marketing/destaques-cardapio");
  }

  const title = String(form.get("title") || "").trim();
  const subtitle = String(form.get("subtitle") || "").trim();
  const key = String(form.get("key") || "").trim();
  const imageItems = parseImageItems(form);

  if (!title) {
    return json(
      {
        ok: false,
        message: "Informe o título do destaque.",
        activeTab: "content",
      },
      { status: 400 }
    );
  }

  if (!key) {
    return json(
      {
        ok: false,
        message: "Informe a chave do destaque.",
        activeTab: "content",
      },
      { status: 400 }
    );
  }

  if (imageItems.length === 0) {
    return json(
      {
        ok: false,
        message: "Informe pelo menos uma imagem.",
        activeTab: "images",
      },
      { status: 400 }
    );
  }

  const displayStyle = String(form.get("displayStyle") || "polaroid").trim();

  await prismaClient.cardapioHighlightSection.update({
    where: { id },
    data: {
      key,
      title,
      subtitle: subtitle || null,
      published: form.get("published") === "on",
      sortOrder: parseSortOrder(form.get("sortOrder")),
      displayStyle: displayStyle === "default" ? "default" : "polaroid",
      showTitle: form.get("showTitle") === "on",
      showPromotionHint: form.get("showPromotionHint") === "on",
      imageItemsJson: imageItems,
      deletedAt: null,
    },
  });

  await invalidateCardapioIndexCache();
  return json({ ok: true, message: "Destaque salvo.", activeTab });
}

function StatusBadge({
  published,
  deletedAt,
}: {
  published: boolean;
  deletedAt: string | null;
}) {
  if (deletedAt) {
    return <Badge variant="secondary">Arquivado</Badge>;
  }
  if (published) {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Publicado
      </Badge>
    );
  }
  return <Badge variant="outline">Rascunho</Badge>;
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold tracking-tighter ">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function AdminMarketingCardapioHighlightsDetail() {
  const { section } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const images = section.images || [];
  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => {
    if (actionData?.activeTab) {
      setActiveTab(actionData.activeTab);
    }
  }, [actionData]);

  return (
    <div className="flex max-w-2xl flex-col gap-6 pb-12">
      <div className="space-y-4">
        <Link
          to="/admin/marketing/destaques-cardapio"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
        >
          <ChevronLeft size={14} />
          destaques
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {section.title}
            </h2>
            <StatusBadge
              published={section.published}
              deletedAt={section.deletedAt}
            />
          </div>

          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar destaque?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O destaque será removido da lista e despublicado do
                    cardápio. Esta ação não pode ser desfeita por esta tela.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <Form method="post">
                    <input type="hidden" name="_intent" value="delete" />
                    <AlertDialogAction asChild>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={isSubmitting}
                      >
                        Eliminar destaque
                      </Button>
                    </AlertDialogAction>
                  </Form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              type="submit"
              form="highlight-edit-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
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

      <Form
        id="highlight-edit-form"
        method="post"
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="_intent" value="update" />
        <input type="hidden" name="_activeTab" value={activeTab} />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <div className="overflow-x-auto border-b border-slate-100">
            <TabsList className="flex h-auto min-w-max items-center justify-start gap-6 rounded-none bg-transparent p-0 text-sm">
              <TabsTrigger
                value="content"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition hover:text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
              >
                Conteúdo
              </TabsTrigger>
              <TabsTrigger
                value="appearance"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition hover:text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
              >
                Aparência
              </TabsTrigger>
              <TabsTrigger
                value="images"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition hover:text-slate-700 data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
              >
                Imagens
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="content"
            forceMount
            className="mt-0 space-y-6 data-[state=inactive]:hidden"
          >
            <SectionHeading
              title="Conteúdo"
              description="Texto e identificação da seção promocional."
            />

            <div className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" name="title" defaultValue={section.title} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sortOrder">Ordem</Label>
                  <Input
                    id="sortOrder"
                    name="sortOrder"
                    type="number"
                    defaultValue={section.sortOrder}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="subtitle">Subtítulo</Label>
                <Input
                  id="subtitle"
                  name="subtitle"
                  defaultValue={section.subtitle || ""}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="key">Chave</Label>
                <Input id="key" name="key" defaultValue={section.key} />
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="appearance"
            forceMount
            className="mt-0 space-y-6 data-[state=inactive]:hidden"
          >
            <SectionHeading
              title="Aparência e visibilidade"
              description="Controla como o destaque aparece no cardápio público."
            />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="displayStyle">Estilo visual</Label>
                <Select
                  name="displayStyle"
                  defaultValue={section.displayStyle ?? "polaroid"}
                >
                  <SelectTrigger id="displayStyle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="polaroid">
                      Foto instantânea (polaroid)
                    </SelectItem>
                    <SelectItem value="default">
                      Padrão (sem estilo especial)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Afeta apenas a versão mobile. No desktop o cartão segue sempre
                  o estilo padrão.
                </p>
              </div>

              <SwitchRow
                name="showTitle"
                label="Mostrar título e subtítulo"
                description="Exibe o texto acima da imagem, no mobile."
                defaultChecked={section.showTitle ?? true}
              />

              <SwitchRow
                name="showPromotionHint"
                label='Mostrar "Toque para ver a promoção"'
                description="Exibe a chamada abaixo da imagem no mobile e a versão equivalente no desktop."
                defaultChecked={section.showPromotionHint ?? true}
              />

              <SwitchRow
                name="published"
                label="Publicado"
                description="Quando desligado, o destaque fica em rascunho e não aparece no site."
                defaultChecked={section.published}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="images"
            forceMount
            className="mt-0 space-y-6 data-[state=inactive]:hidden"
          >
            <SectionHeading
              title="Imagens"
              description="Uma URL por linha. As imagens ampliadas são opcionais — use quando quiser uma versão em maior resolução para o modo expandido."
            />

            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="imageUrls">Imagens públicas</Label>
                <Textarea
                  id="imageUrls"
                  name="imageUrls"
                  rows={6}
                  defaultValue={imageUrlsText(images)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fullscreenImageUrls">Imagens ampliadas</Label>
                <Textarea
                  id="fullscreenImageUrls"
                  name="fullscreenImageUrls"
                  rows={6}
                  defaultValue={fullscreenUrlsText(images)}
                />
              </div>

              {images.length ? (
                <div className="grid gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    Preview das imagens
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {images.map((image, index) => (
                      <div
                        key={`${image.imageUrl}-${index}`}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <div className="relative">
                          <img
                            src={image.imageUrl}
                            alt={image.alt || `${section.title} ${index + 1}`}
                            className="aspect-[4/5] w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          {image.linkUrl && image.linkText ? (
                            <div
                              className="absolute left-1/2 top-5 inline-flex max-w-[88%] -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold shadow-lg"
                              style={{
                                backgroundColor:
                                  image.linkBackgroundColor ||
                                  DEFAULT_LINK_BACKGROUND_COLOR,
                                color:
                                  image.linkTextColor ||
                                  DEFAULT_LINK_TEXT_COLOR,
                              }}
                            >
                              <LinkIcon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{image.linkText}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="grid gap-3 border-t border-slate-200 bg-white p-3">
                          <div className="grid gap-2">
                            <Label htmlFor={`linkUrl_${index}`}>
                              Link da imagem {index + 1}
                            </Label>
                            <Input
                              id={`linkUrl_${index}`}
                              name={`linkUrl_${index}`}
                              type="url"
                              defaultValue={image.linkUrl || ""}
                              placeholder="https://..."
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor={`linkText_${index}`}>
                              Texto do link
                            </Label>
                            <Input
                              id={`linkText_${index}`}
                              name={`linkText_${index}`}
                              defaultValue={image.linkText || ""}
                              placeholder="Amodomio.com"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                              <Label htmlFor={`linkBackgroundColor_${index}`}>
                                Fundo
                              </Label>
                              <Input
                                id={`linkBackgroundColor_${index}`}
                                name={`linkBackgroundColor_${index}`}
                                type="color"
                                defaultValue={
                                  image.linkBackgroundColor ||
                                  DEFAULT_LINK_BACKGROUND_COLOR
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`linkTextColor_${index}`}>
                                Texto
                              </Label>
                              <Input
                                id={`linkTextColor_${index}`}
                                name={`linkTextColor_${index}`}
                                type="color"
                                defaultValue={
                                  image.linkTextColor || DEFAULT_LINK_TEXT_COLOR
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </Form>
    </div>
  );
}

function SwitchRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={name} className="text-sm font-medium text-slate-900">
          {label}
        </Label>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      <Switch id={name} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}
