import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { NavLink, Outlet, useFetcher, useLoaderData } from "@remix-run/react";
import { Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { parseContentPostMediaForm } from "~/domain/content-post/content-post-media.shared";
import {
  getContentPost,
  replaceContentPostMedia,
} from "~/domain/content-post/content-post.server";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import {
  MEDIA_UPLOAD_MAX_BYTES,
  normalizePath,
} from "~/domain/media/media.shared";
import prismaClient from "~/lib/prisma/client.server";

export type ContentPostMediaOutletContext = {
  addMediaUrl: (mediaUrl: string, fullscreenMediaUrl?: string) => void;
  disabled: boolean;
  uploadPath: string;
};

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await getContentPost(String(params.id || ""));
  const assets = post.Media.length
    ? await prismaClient.mediaAsset.findMany({
        where: { url: { in: post.Media.map((media) => media.mediaUrl) } },
        select: { url: true, sizeBytes: true },
      })
    : [];
  return json({
    post,
    sizeBytesByUrl: Object.fromEntries(
      assets.map((asset) => [
        asset.url,
        asset.sizeBytes == null ? null : Number(asset.sizeBytes),
      ])
    ),
  });
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

function isVideoMediaUrl(mediaUrl: string) {
  return /\.(mp4|mov|webm)(?:$|\?)/i.test(mediaUrl);
}

function formatMegabytes(sizeBytes?: number | null) {
  return sizeBytes == null
    ? "Tamanho indisponível"
    : `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

function MediaFileDetails({
  media,
  sizeBytes,
}: {
  media: { kind: string; mediaUrl: string; alt: string | null };
  sizeBytes?: number | null;
}) {
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const duration =
    durationSeconds == null
      ? "Duração carregando..."
      : `${Math.floor(durationSeconds / 60)}:${String(
          Math.round(durationSeconds % 60)
        ).padStart(2, "0")}`;

  return (
    <>
      {media.kind === "video" ? (
        <video
          src={media.mediaUrl}
          controls
          className="aspect-[4/5] w-full bg-black object-contain"
          onLoadedMetadata={(event) =>
            setDurationSeconds(event.currentTarget.duration)
          }
        />
      ) : (
        <img
          src={media.mediaUrl}
          alt={media.alt || ""}
          className="aspect-[4/5] w-full bg-slate-100 object-cover"
        />
      )}
      <p className="px-3 pt-3 text-xs text-slate-500">
        {formatMegabytes(sizeBytes)}
        {media.kind === "video" ? ` · ${duration}` : ""}
      </p>
    </>
  );
}

export default function ContentPostMediaPage() {
  const { post, sizeBytesByUrl } = useLoaderData<typeof loader>();
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
          <p className="text-xs text-slate-500">
            Tamanho máximo por arquivo na API:{" "}
            {MEDIA_UPLOAD_MAX_BYTES / 1024 / 1024} MB.
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
        {post.Media.map((media) => (
          <div key={media.id} className="overflow-hidden rounded-lg border">
            <MediaFileDetails
              media={media}
              sizeBytes={sizeBytesByUrl[media.mediaUrl]}
            />
            <div className="p-3">
              <p className="truncate text-sm font-medium">{media.title}</p>
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
