import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import {
  contentPostSocialSource,
  duplicateContentPost,
  getContentPost,
  listContentPosts,
  runContentTargetOperation,
  softDeleteContentPost,
  unpublishContentTarget,
} from "~/domain/content-post/content-post.server";
import {
  CONTENT_POST_CHANNELS,
  CONTENT_POST_STATUSES,
  type ContentPostChannel,
} from "~/domain/content-post/content-post.shared";
import {
  clearStatusPublicationGroupPublishState,
  publishStatusPublicationGroup,
} from "~/domain/whatsapp-status/whatsapp-status-publication-group.server";
import {
  clearInstagramStoryGroupPublishState,
  publishInstagramStoryGroup,
} from "~/domain/instagram/instagram-story-publication-group.server";
import prismaClient from "~/lib/prisma/client.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const searchParams = new URL(request.url).searchParams;
  const q = searchParams.get("q") || "";
  const publicationStatus = parsePublicationStatusFilter(
    searchParams.get("publicationStatus")
  );
  const posts = await listContentPosts(q);
  const whatsappTargetIds = posts.flatMap((post) =>
    post.Targets.filter(
      (target) => target.channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS
    ).map((target) => target.id)
  );
  const instagramTargetIds = posts.flatMap((post) =>
    post.Targets.filter(
      (target) => target.channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY
    ).map((target) => target.id)
  );
  const sourceType = contentPostSocialSource("__target__").sourceType;
  const [configuredWhatsappTargets, configuredInstagramTargets] =
    await Promise.all([
      whatsappTargetIds.length
        ? prismaClient.whatsappStatusPublication.findMany({
            where: {
              sourceType,
              sourceId: { in: whatsappTargetIds },
              active: true,
              deletedAt: null,
            },
            select: { sourceId: true },
            distinct: ["sourceId"],
          })
        : [],
      instagramTargetIds.length
        ? prismaClient.instagramStoryPublication.findMany({
            where: {
              sourceType,
              sourceId: { in: instagramTargetIds },
              active: true,
              deletedAt: null,
            },
            select: { sourceId: true },
            distinct: ["sourceId"],
          })
        : [],
    ]);
  const configuredWhatsappTargetIds = new Set(
    configuredWhatsappTargets
      .map((item) => item.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  );
  const configuredInstagramTargetIds = new Set(
    configuredInstagramTargets
      .map((item) => item.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId))
  );

  const normalizedPosts = posts.map((post) => ({
    ...post,
    Targets: post.Targets.map((target) => {
      const status =
        target.status === "active" && !target.lastPublishedAt
          ? "needs_sync"
          : target.status;

      return {
        ...target,
        status,
        canPublishDirect:
          post.status === CONTENT_POST_STATUSES.ACTIVE &&
          status !== "active" &&
          (target.channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED ||
            (target.channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS &&
              configuredWhatsappTargetIds.has(target.id)) ||
            (target.channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY &&
              configuredInstagramTargetIds.has(target.id))),
        canUnpublish: status === "active" && Boolean(target.lastPublishedAt),
      };
    }),
  }));
  const filteredPosts =
    publicationStatus === "all"
      ? normalizedPosts
      : normalizedPosts.filter((post) =>
          post.Targets.some(
            (target) =>
              getPublicationStatusFilterValue(target) === publicationStatus
          )
        );

  return json({
    posts: filteredPosts,
    q,
    publicationStatus,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");
  const contentPostId = String(form.get("contentPostId") || "");

  if (intent === "duplicate-post") {
    const duplicated = await duplicateContentPost(contentPostId);
    return json({ ok: true, id: duplicated.id });
  }

  if (intent === "delete-post") {
    await softDeleteContentPost(contentPostId);
    await invalidateCardapioIndexCache();
    return json({ ok: true });
  }

  const channel = String(form.get("channel") || "") as ContentPostChannel;
  const post = await getContentPost(contentPostId);
  const target = post.Targets.find((t) => t.channel === channel);
  if (!target) {
    throw new Response("Canal não encontrado", { status: 404 });
  }

  if (intent === "unpublish") {
    await unpublishContentTarget(target.id);
    const source = contentPostSocialSource(target.id);
    if (channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS) {
      await clearStatusPublicationGroupPublishState(source);
    }
    if (channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY) {
      await clearInstagramStoryGroupPublishState(source);
    }
    if (channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED) {
      await invalidateCardapioIndexCache();
    }
    return json({ ok: true });
  }

  if (
    intent === "publish-cardapio" &&
    channel === CONTENT_POST_CHANNELS.CARDAPIO_FEATURED
  ) {
    if (post.status !== CONTENT_POST_STATUSES.ACTIVE) {
      return json(
        { ok: false, message: "Ative o conteúdo primeiro." },
        { status: 409 }
      );
    }

    await runContentTargetOperation({
      targetId: target.id,
      operation: "publish",
      source: "manual",
      execute: async () => ({ channel }),
      response: (value) => value,
    });
    await invalidateCardapioIndexCache();
    return json({ ok: true });
  }

  if (
    intent === "publish-whatsapp" &&
    channel === CONTENT_POST_CHANNELS.WHATSAPP_STATUS
  ) {
    if (post.status !== CONTENT_POST_STATUSES.ACTIVE) {
      return json(
        { ok: false, message: "Ative o conteúdo primeiro." },
        { status: 409 }
      );
    }

    const source = contentPostSocialSource(target.id);
    try {
      const result = await runContentTargetOperation({
        targetId: target.id,
        operation: "publish",
        source: "manual",
        execute: () =>
          publishStatusPublicationGroup(source, { source: "manual" }),
        response: (value) => ({
          publications: value.publications.map((item) => item.publication.id),
        }),
      });
      return json({ ok: true, published: result.publications.length });
    } catch (error: any) {
      return json(
        { ok: false, message: error?.message || "Erro ao publicar." },
        { status: Number(error?.status) || 500 }
      );
    }
  }

  if (
    intent === "publish-instagram" &&
    channel === CONTENT_POST_CHANNELS.INSTAGRAM_STORY
  ) {
    if (post.status !== CONTENT_POST_STATUSES.ACTIVE) {
      return json(
        { ok: false, message: "Ative o conteúdo primeiro." },
        { status: 409 }
      );
    }

    const source = contentPostSocialSource(target.id);
    try {
      const result = await runContentTargetOperation({
        targetId: target.id,
        operation: "publish",
        source: "manual",
        execute: () =>
          publishInstagramStoryGroup(source, { source: "manual" }),
        externalId: (value) =>
          value.publications.at(-1)?.publication.lastInstagramMediaId,
        response: (value) => ({
          publications: value.publications.map((item) => item.publication.id),
        }),
      });
      return json({ ok: true, published: result.publications.length });
    } catch (error: any) {
      return json(
        { ok: false, message: error?.message || "Erro ao publicar." },
        { status: Number(error?.status) || 500 }
      );
    }
  }

  return json({ ok: false }, { status: 400 });
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

const PUBLICATION_STATUS_FILTERS = [
  { value: "all", label: "Todos os status" },
  { value: "draft", label: "Rascunho" },
  { value: "needs_sync", label: "Aguardando publicação" },
  { value: "active", label: "Publicado" },
  { value: "failed", label: "Falhou" },
  { value: "removed", label: "Removido" },
] as const;

type PublicationStatusFilter =
  (typeof PUBLICATION_STATUS_FILTERS)[number]["value"];

function parsePublicationStatusFilter(
  value: string | null
): PublicationStatusFilter {
  return PUBLICATION_STATUS_FILTERS.some((item) => item.value === value)
    ? (value as PublicationStatusFilter)
    : "active";
}

function getPublicationStatusFilterValue(target: {
  status: string;
  lastPublishedAt?: string | Date | null;
}): PublicationStatusFilter {
  if (target.status === "active" && target.lastPublishedAt) return "active";
  if (target.status === "needs_sync") return "needs_sync";
  if (target.status === "failed") return "failed";
  if (target.status === "removed" || target.status === "removal_pending") {
    return "removed";
  }
  return "draft";
}

function getPostStatusChip(status: string) {
  if (status === "active") {
    return {
      label: statusLabel[status] || status,
      className:
        "h-6 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50",
      variant: "outline" as const,
    };
  }

  return {
    label: statusLabel[status] || status,
    className:
      "h-6 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50",
    variant: "outline" as const,
  };
}

function PostStatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const statusChip = getPostStatusChip(status);
  return (
    <Badge
      variant={statusChip.variant}
      className={`${className} ${statusChip.className}`.trim()}
    >
      {statusChip.label}
    </Badge>
  );
}

const CHANNEL_TTL_HOURS: Record<string, number | null> = {
  [CONTENT_POST_CHANNELS.CARDAPIO_FEATURED]: null,
  [CONTENT_POST_CHANNELS.WHATSAPP_STATUS]: 24,
  [CONTENT_POST_CHANNELS.INSTAGRAM_STORY]: 24,
};

const CHANNEL_LABELS: Record<string, string> = {
  [CONTENT_POST_CHANNELS.CARDAPIO_FEATURED]: "Cardápio",
  [CONTENT_POST_CHANNELS.WHATSAPP_STATUS]: "WhatsApp",
  [CONTENT_POST_CHANNELS.INSTAGRAM_STORY]: "Instagram",
};

const ALL_CHANNELS = [
  CONTENT_POST_CHANNELS.CARDAPIO_FEATURED,
  CONTENT_POST_CHANNELS.WHATSAPP_STATUS,
  CONTENT_POST_CHANNELS.INSTAGRAM_STORY,
];

const TARGET_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  needs_sync: "Aguardando publicação",
  active: "Publicado",
  removal_pending: "Removendo",
  removed: "Removido",
  failed: "Falhou",
};

function getTargetStatusTone(target: TargetInfo) {
  if (target.status === "active" && target.lastPublishedAt) {
    return {
      label: "Publicado",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
      icon: CheckCircle2,
    };
  }

  if (target.status === "failed") {
    return {
      label: "Falhou",
      className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
      icon: AlertTriangle,
    };
  }

  if (target.status === "needs_sync" || target.status === "removal_pending") {
    return {
      label: TARGET_STATUS_LABELS[target.status] ?? target.status,
      className:
        "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
      icon: RefreshCw,
    };
  }

  return {
    label: TARGET_STATUS_LABELS[target.status] ?? target.status,
    className: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    icon: XCircle,
  };
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExpiresAt(
  channel: string,
  lastPublishedAt: string | Date | null | undefined
): Date | null {
  const ttl = CHANNEL_TTL_HOURS[channel];
  if (!ttl || !lastPublishedAt) return null;
  return new Date(new Date(lastPublishedAt).getTime() + ttl * 60 * 60 * 1000);
}

type TargetInfo = {
  id: string;
  channel: string;
  status: string;
  lastPublishedAt: string | null;
  removedAt: string | null;
  updatedAt: string | null;
  canPublishDirect?: boolean;
  canUnpublish?: boolean;
};

function ChannelActionButton({
  postId,
  channel,
  intent,
  label,
  confirmMessage,
  icon: Icon,
  tone = "danger",
}: {
  postId: string;
  channel: string;
  intent: string;
  label: string;
  confirmMessage: string;
  icon: LucideIcon;
  tone?: "danger" | "success";
}) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
      : "border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700";

  return (
    <fetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="_intent" value={intent} />
      <input type="hidden" name="contentPostId" value={postId} />
      <input type="hidden" name="channel" value={channel} />
      <button
        type="submit"
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-50 ${toneClassName}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!confirm(confirmMessage)) {
            e.preventDefault();
          }
        }}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {busy ? "Processando..." : label}
      </button>
    </fetcher.Form>
  );
}

function DuplicatePostButton({ postId }: { postId: string }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="_intent" value="duplicate-post" />
      <input type="hidden" name="contentPostId" value={postId} />
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-6 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        onClick={(e) => {
          e.stopPropagation();
          if (!confirm("Duplicar esta publicação como rascunho?")) {
            e.preventDefault();
          }
        }}
        title="Duplicar publicação"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? "Copiando..." : "Duplicar"}
      </button>
    </fetcher.Form>
  );
}

function DeletePostButton({ postId }: { postId: string }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="_intent" value="delete-post" />
      <input type="hidden" name="contentPostId" value={postId} />
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-6 items-center gap-1.5 rounded-full border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        onClick={(e) => {
          e.stopPropagation();
          if (!confirm("Eliminar esta publicação?")) {
            e.preventDefault();
          }
        }}
        title="Eliminar publicação"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {busy ? "Eliminando..." : "Eliminar"}
      </button>
    </fetcher.Form>
  );
}

function ChannelStatusPill({ target }: { target: TargetInfo }) {
  const statusTone = getTargetStatusTone(target);

  return (
    <Badge
      variant="outline"
      className={`h-6 rounded-full px-2.5 text-xs font-semibold ${statusTone.className}`}
    >
      {statusTone.label}
    </Badge>
  );
}

function ChannelRow({ target }: { target: TargetInfo }) {
  const displayPublishedAt =
    target.status === "active" ? fmtDate(target.lastPublishedAt) : null;
  const expiresAt = target.lastPublishedAt
    ? getExpiresAt(target.channel, target.lastPublishedAt)
    : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const ttl = CHANNEL_TTL_HOURS[target.channel];
  const expirationLabel =
    ttl === null
      ? "Expira"
      : expiresAt
      ? isExpired
        ? "Expirou"
        : "Expira"
      : null;
  const expirationValue =
    ttl === null ? "Sem expiração" : expiresAt ? fmtDate(expiresAt) : null;
  const hasDetails = Boolean(displayPublishedAt);

  if (!hasDetails) return null;

  return (
    <div className="space-y-3 pt-3">
      <Separator className="bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Publicação
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-slate-600">
            {displayPublishedAt}
          </div>
        </div>
        {expirationLabel && expirationValue ? (
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {expirationLabel}
            </div>
            <div
              className={`mt-0.5 truncate text-xs font-medium ${
                ttl === null
                  ? "text-slate-500"
                  : isExpired
                  ? "text-rose-600"
                  : "text-amber-600"
              }`}
            >
              {expirationValue}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const PUBLISH_INTENT_BY_CHANNEL: Record<string, string> = {
  [CONTENT_POST_CHANNELS.CARDAPIO_FEATURED]: "publish-cardapio",
  [CONTENT_POST_CHANNELS.WHATSAPP_STATUS]: "publish-whatsapp",
  [CONTENT_POST_CHANNELS.INSTAGRAM_STORY]: "publish-instagram",
};

function ChannelActions({
  target,
  postId,
}: {
  target: TargetInfo;
  postId: string;
}) {
  const canPublishDirect = Boolean(target.canPublishDirect);
  const canUnpublish = Boolean(target.canUnpublish);

  if (!canPublishDirect && !canUnpublish) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2">
      {canPublishDirect ? (
        <ChannelActionButton
          postId={postId}
          channel={target.channel}
          intent={PUBLISH_INTENT_BY_CHANNEL[target.channel] ?? "publish"}
          label="Publicar"
          confirmMessage={`Publicar esta publicação no ${
            CHANNEL_LABELS[target.channel] ?? target.channel
          } agora?`}
          icon={Send}
          tone="success"
        />
      ) : null}
      {canUnpublish ? (
        <ChannelActionButton
          postId={postId}
          channel={target.channel}
          intent="unpublish"
          label="Despublicar"
          confirmMessage={`Despublicar esta publicação do ${
            CHANNEL_LABELS[target.channel] ?? target.channel
          }?`}
          icon={RefreshCw}
        />
      ) : null}
    </div>
  );
}

function ChannelList({
  targets,
  postId,
}: {
  targets: TargetInfo[];
  postId: string;
}) {
  const byChannel = new Map(targets.map((t) => [t.channel, t]));
  return (
    <div className="grid gap-2">
      {ALL_CHANNELS.map((ch) => {
        const t = byChannel.get(ch);
        const label = CHANNEL_LABELS[ch] ?? ch;
        return (
          <div
            key={ch}
            className="min-h-20 rounded-lg bg-slate-50/70 px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </div>
                {t ? <ChannelStatusPill target={t} /> : null}
              </div>
              {t ? <ChannelActions target={t} postId={postId} /> : null}
            </div>
            {t ? (
              <ChannelRow target={t} />
            ) : (
              <span className="mt-2 block text-xs text-slate-300">
                Sem canal
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ContentPostsIndex() {
  const { posts, q, publicationStatus } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-3">
      <Form method="get" className="flex flex-wrap items-center gap-6">
        <div className="relative flex min-w-[260px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Pesquise por título ou chave"
            className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            className="absolute right-2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            title="Filtrar"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="whitespace-nowrap">Status da publicação</span>
          <Select name="publicationStatus" defaultValue={publicationStatus}>
            <SelectTrigger className="h-9 w-[220px] bg-white text-sm text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PUBLICATION_STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <button className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          Filtrar
        </button>
      </Form>

      <div className="text-sm text-slate-500">
        {posts.length} publicação(ões)
      </div>

      {posts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          Nenhuma publicação encontrada com os filtros atuais.
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {posts.map((post) => {
          return (
            <article
              key={post.id}
              className="rounded-lg border border-slate-200 bg-white p-4 transition hover:bg-slate-50/40"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-950">
                    <Link to={post.id} className="hover:underline">
                      {post.title}
                    </Link>
                  </h2>
                  <div className="truncate text-xs text-slate-500">
                    {post.key}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <PostStatusBadge status={post.status} />
                    <Badge className="w-max bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 hover:bg-blue-100">
                      {post._count.Media} mídia(s)
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <DuplicatePostButton postId={post.id} />
                  <DeletePostButton postId={post.id} />
                </div>
              </div>

              <ChannelList
                targets={post.Targets as TargetInfo[]}
                postId={post.id}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
