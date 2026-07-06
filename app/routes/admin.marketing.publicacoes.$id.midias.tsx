import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { NavLink, Outlet, useFetcher, useLoaderData } from "@remix-run/react";
import { LinkIcon, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "~/components/ui/searchable-select";
import { Textarea } from "~/components/ui/textarea";
import {
  DEFAULT_CONTENT_LINK_BACKGROUND_COLOR,
  DEFAULT_CONTENT_LINK_TEXT_COLOR,
  parseContentPostMediaForm,
} from "~/domain/content-post/content-post-media.shared";
import {
  getContentPost,
  replaceContentPostMedia,
} from "~/domain/content-post/content-post.server";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import { normalizePath } from "~/domain/media/media.shared";
import prismaClient from "~/lib/prisma/client.server";

export type ContentPostMediaOutletContext = {
  addMediaUrl: (mediaUrl: string, fullscreenMediaUrl?: string) => void;
  disabled: boolean;
  uploadPath: string;
};

export async function loader({ params }: LoaderFunctionArgs) {
  const [post, menuItems] = await Promise.all([
    getContentPost(String(params.id || "")),
    prismaClient.item.findMany({
      where: {
        active: true,
        canSell: true,
        ItemSellingInfo: { is: { slug: { not: null } } },
      },
      select: {
        id: true,
        name: true,
        ItemSellingInfo: { select: { slug: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return json({ post, menuItems });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const id = String(params.id || "");
  const post = await getContentPost(id);
  const form = await request.formData();
  try {
    await replaceContentPostMedia(
      id,
      parseContentPostMediaForm(form, post.title)
    );
    await invalidateCardapioIndexCache();
    return json({ ok: true, message: "Mídias salvas." });
  } catch (error: any) {
    return json(
      { ok: false, message: error?.message || "Erro ao salvar mídias." },
      { status: Number(error?.status) || 400 }
    );
  }
}

function MediaLinkFields({
  index,
  media,
  itemOptions,
}: {
  index: number;
  media: {
    linkUrl: string | null;
    linkText: string | null;
    linkMenuItemId: string | null;
  };
  itemOptions: SearchableSelectOption[];
}) {
  const [mode, setMode] = useState<"free" | "item">(
    media.linkMenuItemId ? "item" : "free"
  );
  const [menuItemId, setMenuItemId] = useState(media.linkMenuItemId || "");
  const [linkText, setLinkText] = useState(media.linkText || "");

  return (
    <>
      <div className="grid gap-2">
        <Label>Tipo de link</Label>
        <Select
          name={`linkMode_${index}`}
          value={mode}
          onValueChange={(value) => setMode(value === "item" ? "item" : "free")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Link livre</SelectItem>
            <SelectItem value="item">Item do cardápio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "item" ? (
        <div className="grid gap-2">
          <Label>Item do cardápio</Label>
          <input
            type="hidden"
            name={`linkMenuItemId_${index}`}
            value={menuItemId}
          />
          <SearchableSelect
            value={menuItemId}
            onValueChange={(value) => {
              setMenuItemId(value);
              if (!linkText) {
                const option = itemOptions.find((item) => item.value === value);
                if (option) setLinkText(option.label);
              }
            }}
            options={itemOptions}
            placeholder="Buscar item..."
            triggerClassName="w-full max-w-none"
          />
        </div>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor={`linkUrl_${index}`}>Link</Label>
          <Input
            id={`linkUrl_${index}`}
            name={`linkUrl_${index}`}
            defaultValue={media.linkUrl || ""}
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`linkText_${index}`}>Texto do link</Label>
        <Input
          id={`linkText_${index}`}
          name={`linkText_${index}`}
          value={linkText}
          onChange={(event) => setLinkText(event.target.value)}
        />
      </div>
    </>
  );
}

function isVideoMediaUrl(mediaUrl: string) {
  return /\.(mp4|mov|webm)(?:$|\?)/i.test(mediaUrl);
}

export default function ContentPostMediaPage() {
  const { post, menuItems } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const actionData = fetcher.data;
  const [mediaUrls, setMediaUrls] = useState(() =>
    post.Media.map((media) => media.mediaUrl).join("\n")
  );
  const [fullscreenMediaUrls, setFullscreenMediaUrls] = useState(() =>
    post.Media.map((media) => media.fullscreenMediaUrl || media.mediaUrl).join(
      "\n"
    )
  );
  const isSubmitting = fetcher.state !== "idle";
  const itemOptions: SearchableSelectOption[] = menuItems.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  const uploadPath = normalizePath(`marketing/publicacoes/${post.key}`);
  const mediaLines = mediaUrls
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  function appendLine(current: string, value: string) {
    const lines = current
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.includes(value)) return lines.join("\n");
    return [...lines, value].join("\n");
  }

  function addMediaUrl(mediaUrl: string, fullscreenMediaUrl?: string) {
    const url = mediaUrl.trim();
    const fullscreenUrl = fullscreenMediaUrl?.trim() || url;
    if (!url) return;
    setMediaUrls((current) => appendLine(current, url));
    setFullscreenMediaUrls((current) => appendLine(current, fullscreenUrl));
  }

  function removeMediaUrlAt(indexToRemove: number) {
    setMediaUrls((current) =>
      current
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((_, index) => index !== indexToRemove)
        .join("\n")
    );
    setFullscreenMediaUrls((current) =>
      current
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((_, index) => index !== indexToRemove)
        .join("\n")
    );
  }

  return (
    <fetcher.Form
      method="post"
      action={`/admin/marketing/publicacoes/${post.id}/midias`}
      preventScrollReset
      className="grid gap-5 sm:gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mídias</h2>
          <p className="text-sm text-slate-500">
            Arquivos canônicos reutilizados por todos os canais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full gap-2 sm:min-h-10 sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Salvando..." : "Salvar mídias"}
          </Button>
        </div>
      </div>
      {actionData?.message ? (
        <div className="rounded-md border p-3 text-sm">
          {actionData.message}
        </div>
      ) : null}

      <nav className="grid grid-cols-2 rounded-md border bg-slate-50 p-1">
        {[
          { label: "Mídia interna", to: "interno" },
          { label: "Link externo", to: "externo" },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center justify-center rounded px-2 text-center text-sm font-semibold transition ${
                isActive
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet
        context={
          {
            addMediaUrl,
            disabled: isSubmitting,
            uploadPath,
          } satisfies ContentPostMediaOutletContext
        }
      />

      {mediaLines.length ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Mídias no rascunho</Label>
            <span className="text-xs text-slate-500">
              {mediaLines.length} vinculada(s)
            </span>
          </div>
          <div className="grid gap-2">
            {mediaLines.map((mediaUrl, index) => (
              <div
                key={`${mediaUrl}-${index}`}
                className="grid gap-2 rounded-md border p-2 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="hidden h-14 overflow-hidden rounded bg-slate-100 sm:block">
                  {isVideoMediaUrl(mediaUrl) ? (
                    <video
                      src={mediaUrl}
                      className="h-full w-full bg-black object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <span className="min-w-0 break-all text-xs text-slate-600">
                  {mediaUrl}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 gap-2 text-red-700 sm:w-auto"
                  onClick={() => removeMediaUrlAt(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <details className="rounded-md border">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
          Editar URLs manualmente
        </summary>
        <div className="grid gap-5 border-t p-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="grid gap-2">
            <Label htmlFor="mediaUrls">Mídias públicas</Label>
            <Textarea
              id="mediaUrls"
              name="mediaUrls"
              rows={5}
              value={mediaUrls}
              onChange={(event) => setMediaUrls(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fullscreenMediaUrls">Versões ampliadas</Label>
            <Textarea
              id="fullscreenMediaUrls"
              name="fullscreenMediaUrls"
              rows={5}
              value={fullscreenMediaUrls}
              onChange={(event) => setFullscreenMediaUrls(event.target.value)}
            />
          </div>
        </div>
      </details>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {post.Media.map((media, index) => (
          <div key={media.id} className="overflow-hidden rounded-lg border">
            {media.kind === "video" ? (
              <video
                src={media.mediaUrl}
                controls
                className="aspect-[4/5] w-full bg-black object-contain"
              />
            ) : (
              <img
                src={media.mediaUrl}
                alt={media.alt || media.title}
                className="aspect-[4/5] w-full bg-slate-100 object-cover"
              />
            )}
            <div className="grid gap-3 p-3">
              <MediaLinkFields
                index={index}
                media={media}
                itemOptions={itemOptions}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name={`linkBackgroundColor_${index}`}
                  type="color"
                  defaultValue={
                    media.linkBackgroundColor ||
                    DEFAULT_CONTENT_LINK_BACKGROUND_COLOR
                  }
                />
                <Input
                  name={`linkTextColor_${index}`}
                  type="color"
                  defaultValue={
                    media.linkTextColor || DEFAULT_CONTENT_LINK_TEXT_COLOR
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Posição do link</Label>
                <Select
                  name={`linkPosition_${index}`}
                  defaultValue={media.linkPosition || "top"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Topo</SelectItem>
                    <SelectItem value="bottom">Rodapé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Abrir link</Label>
                <Select
                  name={`linkNewTab_${index}`}
                  defaultValue={media.linkNewTab === false ? "false" : "true"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Nova aba</SelectItem>
                    <SelectItem value="false">Mesma aba</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(media.linkUrl || media.linkMenuItemId) && media.linkText ? (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <LinkIcon className="h-3 w-3" /> {media.linkText}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 w-full gap-2 sm:hidden"
      >
        <Save className="h-4 w-4" />
        {isSubmitting ? "Salvando..." : "Salvar mídias"}
      </Button>
    </fetcher.Form>
  );
}
