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

export async function loader({ request }: LoaderFunctionArgs) {
  const q = new URL(request.url).searchParams.get("q") || "";
  return json({ posts: await listContentPosts(q), q });
}

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

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
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge
                variant={post.status === "active" ? "default" : "secondary"}
              >
                {statusLabel[post.status] || post.status}
              </Badge>
              {post.Targets.filter((target) => target.enabled).map((target) => (
                <Badge key={target.channel} variant="outline">
                  {target.channel}
                </Badge>
              ))}
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
                <TableCell className="space-x-1">
                  {post.Targets.filter((target) => target.enabled).map(
                    (target) => (
                      <Badge key={target.channel} variant="outline">
                        {target.channel}
                      </Badge>
                    )
                  )}
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
