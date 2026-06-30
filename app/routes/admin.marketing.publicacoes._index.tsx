import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ChevronRight, Search } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { listContentPosts } from "~/domain/content-post/content-post.server";
import { CONTENT_POST_CHANNELS } from "~/domain/content-post/content-post.shared";

export async function loader({ request }: LoaderFunctionArgs) {
  const q = new URL(request.url).searchParams.get("q") || "";
  return json({ posts: await listContentPosts(q), q });
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

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

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExpiresAt(channel: string, lastPublishedAt: string | Date | null | undefined): Date | null {
  const ttl = CHANNEL_TTL_HOURS[channel];
  if (!ttl || !lastPublishedAt) return null;
  return new Date(new Date(lastPublishedAt).getTime() + ttl * 60 * 60 * 1000);
}

type TargetInfo = {
  channel: string;
  enabled: boolean;
  status: string;
  lastPublishedAt: string | null;
  removedAt: string | null;
};

function ChannelRow({ target }: { target: TargetInfo }) {
  const label = CHANNEL_LABELS[target.channel] ?? target.channel;
  const publishedAt = fmtDate(target.lastPublishedAt);
  const expiresAt = target.lastPublishedAt
    ? getExpiresAt(target.channel, target.lastPublishedAt)
    : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const ttl = CHANNEL_TTL_HOURS[target.channel];

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <Badge
          variant={target.enabled && target.status === "active" ? "default" : "outline"}
          className="text-xs"
        >
          {label}
        </Badge>
        {!target.enabled && (
          <span className="text-xs text-slate-400">desativado</span>
        )}
      </div>
      {publishedAt ? (
        <div className="pl-1 text-xs text-slate-500">
          <span>pub {publishedAt}</span>
          {ttl === null ? (
            <span className="ml-2 text-slate-400">permanente</span>
          ) : expiresAt ? (
            <span className={`ml-2 ${isExpired ? "text-rose-500" : "text-amber-600"}`}>
              {isExpired ? "expirou" : "expira"} {fmtDate(expiresAt)}
            </span>
          ) : null}
        </div>
      ) : target.enabled ? (
        <div className="pl-1 text-xs text-slate-400">aguardando publicação</div>
      ) : null}
    </div>
  );
}

function ChannelList({
  targets,
}: {
  targets: TargetInfo[];
}) {
  const byChannel = new Map(targets.map((t) => [t.channel, t]));
  return (
    <div className="flex flex-col gap-2">
      {ALL_CHANNELS.map((ch) => {
        const t = byChannel.get(ch);
        if (!t) return null;
        return <ChannelRow key={ch} target={t} />;
      })}
    </div>
  );
}

export default function ContentPostsIndex() {
  const { posts, q } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-3">
      <Form method="get" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400 sm:top-2.5" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Pesquise por título ou chave"
            className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-base sm:h-9 sm:text-sm"
          />
        </div>
        <button className="h-11 rounded-full border px-4 text-sm font-semibold sm:h-9">
          Filtrar
        </button>
      </Form>

      <div className="text-sm text-slate-500">
        {posts.length} publicação(ões)
      </div>

      <div className="grid gap-3 md:hidden">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={post.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{post.title}</div>
                <div className="mt-1 text-sm text-slate-500">{post.key}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-3">
              <Badge
                variant={post.status === "active" ? "default" : "secondary"}
                className="mb-3"
              >
                {statusLabel[post.status] || post.status}
              </Badge>
              <ChannelList targets={post.Targets as TargetInfo[]} />
            </div>
          </Link>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Publicação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Canais</TableHead>
              <TableHead>Mídias</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell>
                  <Link
                    to={post.id}
                    className="font-semibold hover:text-blue-600"
                  >
                    {post.title}
                  </Link>
                  <div className="text-xs text-slate-500">{post.key}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={post.status === "active" ? "default" : "secondary"}
                  >
                    {statusLabel[post.status] || post.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ChannelList targets={post.Targets as TargetInfo[]} />
                </TableCell>
                <TableCell>{post._count.Media}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
