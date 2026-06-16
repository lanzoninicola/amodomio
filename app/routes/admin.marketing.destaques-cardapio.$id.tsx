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
import { ChevronLeft, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
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
};

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
      { ok: false, message: "Informe o título do destaque." },
      { status: 400 }
    );
  }

  if (!key) {
    return json(
      { ok: false, message: "Informe a chave do destaque." },
      { status: 400 }
    );
  }

  if (imageItems.length === 0) {
    return json(
      { ok: false, message: "Informe pelo menos uma imagem." },
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
      imageItemsJson: imageItems,
      deletedAt: null,
    },
  });

  await invalidateCardapioIndexCache();
  return json({ ok: true, message: "Destaque salvo." });
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
      <h3 className="text-lg font-semibold tracking-tighter ">
        {title}
      </h3>
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
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {section.title}
          </h2>
          <StatusBadge
            published={section.published}
            deletedAt={section.deletedAt}
          />
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

      <Form method="post" className="flex flex-col gap-8">
        <input type="hidden" name="_intent" value="update" />

        <SectionHeading
          title="Conteúdo"
          description="Texto e identificação da seção promocional."
        />

        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <div className="grid gap-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                name="title"
                required
                defaultValue={section.title}
              />
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
            <Input id="key" name="key" required defaultValue={section.key} />
          </div>
        </div>

        <Separator />

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
              Afeta apenas a versão mobile. No desktop o cartão segue sempre o
              estilo padrão.
            </p>
          </div>

          <SwitchRow
            name="showTitle"
            label="Mostrar título e subtítulo"
            description="Exibe o texto acima da imagem, no mobile."
            defaultChecked={section.showTitle ?? true}
          />

          <SwitchRow
            name="published"
            label="Publicado"
            description="Quando desligado, o destaque fica em rascunho e não aparece no site."
            defaultChecked={section.published}
          />
        </div>

        <Separator />

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
              required
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
                    <img
                      src={image.imageUrl}
                      alt={image.alt || `${section.title} ${index + 1}`}
                      className="aspect-[4/5] w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? "Salvando..." : "Salvar destaque"}
          </Button>
        </div>
      </Form>

      <Separator />

      <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5">
        <div>
          <div className="font-semibold text-red-900">Eliminar destaque</div>
          <p className="text-sm text-red-700">
            O destaque será removido da lista e despublicado do cardápio.
          </p>
        </div>
        <Form
          method="post"
          onSubmit={(event) => {
            if (!window.confirm("Eliminar este destaque?"))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="_intent" value="delete" />
          <Button type="submit" variant="destructive" disabled={isSubmitting}>
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        </Form>
      </div>
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
