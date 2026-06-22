import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ChevronRight, Edit, ImageIcon, Search } from "lucide-react";
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
      <Form
        method="get"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
      >
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Pesquise por título, subtítulo ou chave"
            className="h-11 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-base focus:border-slate-400 focus:outline-none sm:h-9 sm:text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:h-9 sm:w-auto"
        >
          Filtrar
        </button>
      </Form>

      <div className="text-sm text-slate-500">
        {sections.length} destaque(s)
      </div>

      <div className="grid gap-3 md:hidden">
        {sections.length ? (
          sections.map((section) => (
            <Link
              key={section.id}
              to={section.id}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition active:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">
                    {section.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {section.subtitle || section.key}
                  </div>
                </div>
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {countImages(section.imageItemsJson)} imagem(ns)
                </span>
                <span>Ordem {section.sortOrder}</span>
                <span className="ml-auto">
                  Atualizado {formatDate(section.updatedAt)}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            Nenhum destaque encontrado.
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
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
