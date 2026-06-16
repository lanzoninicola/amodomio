import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { Edit, Search } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Destaques do cardápio | Marketing" },
];

function countImages(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();

  const sections = await prismaClient.cardapioHighlightSection.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { subtitle: { contains: q, mode: "insensitive" } },
              { key: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return json({ sections, q });
}

export default function AdminMarketingCardapioHighlightsIndex() {
  const { sections, q } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-3">
      <Form method="get" className="flex flex-wrap items-center gap-3">
        <div className="relative flex min-w-[260px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Pesquise por título, subtítulo ou chave"
            className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Filtrar
        </button>
      </Form>

      <div className="text-sm text-slate-500">{sections.length} destaque(s)</div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destaque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Imagens</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead>Atualizado em</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.length ? (
              sections.map((section) => (
                <TableRow key={section.id}>
                  <TableCell>
                    <Link
                      to={section.id}
                      className="font-semibold text-slate-900 hover:text-blue-600"
                    >
                      {section.title}
                    </Link>
                    <div className="mt-0.5 max-w-xl truncate text-xs text-slate-500">
                      {section.subtitle || section.key}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        section.deletedAt
                          ? "outline"
                          : section.published
                          ? "default"
                          : "secondary"
                      }
                    >
                      {section.deletedAt
                        ? "Arquivado"
                        : section.published
                        ? "Publicado"
                        : "Rascunho"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {countImages(section.imageItemsJson)}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {section.sortOrder}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {formatDate(section.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={section.id}
                      aria-label={`Editar ${section.title}`}
                      className="inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Edit size={15} />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-28 text-center text-sm text-slate-500"
                >
                  Nenhum destaque encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
