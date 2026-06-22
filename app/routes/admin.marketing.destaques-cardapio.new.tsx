import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
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

export const meta: MetaFunction = () => [
  { title: "Novo destaque do cardápio | Marketing" },
];

const DEFAULT_LINK_BACKGROUND_COLOR = "#ffffff";
const DEFAULT_LINK_TEXT_COLOR = "#111111";

function normalizeHexColor(value: string | undefined, fallback: string) {
  const color = (value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

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
  const linkUrls = String(form.get("linkUrls") || "")
    .split(/\r?\n/g)
    .map((url) => url.trim());
  const linkTexts = String(form.get("linkTexts") || "")
    .split(/\r?\n/g)
    .map((text) => text.trim());
  const linkBackgroundColors = String(form.get("linkBackgroundColors") || "")
    .split(/\r?\n/g)
    .map((color) => color.trim());
  const linkTextColors = String(form.get("linkTextColors") || "")
    .split(/\r?\n/g)
    .map((color) => color.trim());

  return imageUrls.map((imageUrl, index) => ({
    imageUrl,
    fullscreenImageUrl: fullscreenUrls[index]?.trim() || imageUrl,
    alt: `${String(form.get("title") || "Destaque").trim()}, imagem ${
      index + 1
    }`,
    linkUrl: linkUrls[index] || null,
    linkText: linkTexts[index] || null,
    linkBackgroundColor: normalizeHexColor(
      linkBackgroundColors[index],
      DEFAULT_LINK_BACKGROUND_COLOR
    ),
    linkTextColor: normalizeHexColor(
      linkTextColors[index],
      DEFAULT_LINK_TEXT_COLOR
    ),
  }));
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const subtitle = String(form.get("subtitle") || "").trim();
  const key = String(form.get("key") || "").trim() || slugify(title);
  const imageItems = parseImageItems(form);

  if (!title) {
    return json(
      { ok: false, message: "Informe o título do destaque." },
      { status: 400 }
    );
  }

  if (!key) {
    return json(
      { ok: false, message: "Informe uma chave para o destaque." },
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

  const section = await prismaClient.cardapioHighlightSection.create({
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
    },
    select: { id: true },
  });

  await invalidateCardapioIndexCache();
  throw redirect(`/admin/marketing/destaques-cardapio/${section.id}`);
}

export default function AdminMarketingCardapioHighlightsNew() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-w-0 max-w-2xl flex-col gap-5 pb-12 sm:gap-6">
      <div className="space-y-4">
        <Link
          to="/admin/marketing/destaques-cardapio"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
        >
          <ChevronLeft size={14} />
          destaques
        </Link>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
            Novo destaque
          </h2>
          <p className="text-sm text-slate-500">
            Cadastre a seção promocional que aparece no cardápio público.
          </p>
        </div>
      </div>

      <Form method="post" className="flex flex-col gap-8">
        {actionData?.message ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {actionData.message}
          </div>
        ) : null}

        <HighlightSectionFields />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Salvando..." : "Criar destaque"}
          </Button>
        </div>
      </Form>
    </div>
  );
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
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}

function HighlightSectionFields({
  defaultDisplayStyle = "polaroid",
}: {
  defaultDisplayStyle?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Conteúdo"
        description="Texto e identificação da seção promocional."
      />

      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <div className="grid gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sortOrder">Ordem</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={0}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subtitle">Subtítulo</Label>
          <Input id="subtitle" name="subtitle" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="key">Chave</Label>
          <Input
            id="key"
            name="key"
            placeholder="ex.: dia-dos-namorados-2026"
          />
          <p className="text-xs text-slate-500">
            Identificador único. Se deixado vazio, é gerado a partir do título.
          </p>
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
          <Select name="displayStyle" defaultValue={defaultDisplayStyle}>
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
          defaultChecked
        />

        <SwitchRow
          name="showPromotionHint"
          label='Mostrar "Toque para ver a promoção"'
          description="Exibe a chamada abaixo da imagem no mobile e a versão equivalente no desktop."
          defaultChecked
        />

        <SwitchRow
          name="published"
          label="Publicado"
          description="Quando desligado, o destaque fica em rascunho e não aparece no site."
        />
      </div>

      <Separator />

      <SectionHeading
        title="Imagens"
        description="Uma URL por linha. As imagens ampliadas e links usam a mesma ordem das imagens públicas."
      />

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="imageUrls">Imagens públicas</Label>
          <Textarea
            id="imageUrls"
            name="imageUrls"
            rows={5}
            placeholder="Cole uma URL por linha"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="fullscreenImageUrls">Imagens ampliadas</Label>
          <Textarea
            id="fullscreenImageUrls"
            name="fullscreenImageUrls"
            rows={5}
            placeholder="Opcional. Uma URL por linha, na mesma ordem."
          />
        </div>

        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Link estilo Instagram
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Opcional. Preencha uma linha por imagem, mantendo a mesma ordem.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="linkUrls">URLs dos links</Label>
            <Textarea
              id="linkUrls"
              name="linkUrls"
              rows={4}
              placeholder="https://amodomio.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="linkTexts">Textos dos links</Label>
            <Textarea
              id="linkTexts"
              name="linkTexts"
              rows={4}
              placeholder="Amodomio.com"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="linkBackgroundColors">Cores de fundo</Label>
              <Textarea
                id="linkBackgroundColors"
                name="linkBackgroundColors"
                rows={3}
                placeholder="#ffffff"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="linkTextColors">Cores do texto</Label>
              <Textarea
                id="linkTextColors"
                name="linkTextColors"
                rows={3}
                placeholder="#111111"
              />
            </div>
          </div>
        </div>
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
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={name} className="text-sm font-medium text-slate-900">
          {label}
        </Label>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      <Switch
        id={name}
        name={name}
        defaultChecked={defaultChecked}
        className="shrink-0"
      />
    </div>
  );
}
