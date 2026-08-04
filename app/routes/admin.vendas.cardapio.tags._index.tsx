import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ArrowUpDown, Search, SlidersHorizontal, XCircle } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import {
  invalidateCardapioIndexCache,
  invalidateSellingPriceHandlerCache,
} from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function normalizeColorHex(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : "#FFFFFF";
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const showNew = url.searchParams.get("new") === "1";
    const tags = await prismaClient.tag.findMany({
      where: {
        deletedAt: null,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      include: {
        _count: {
          select: {
            ItemTag: { where: { deletedAt: null } },
            MenuItemTag: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    });

    return ok({ tags, filters: { q }, showNew });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("tagName") || "").trim();
    if (!name) return badRequest("Nome da tag inválido");

    const existing = await prismaClient.tag.findFirst({
      where: { name, deletedAt: null },
      select: { id: true },
    });
    if (existing) return badRequest("Já existe uma tag com esse nome.");

    const tag = await tagPrismaEntity.create({
      name,
      description: null,
      public: formData.get("public") === "on",
      clickable: false,
      featuredFilter: false,
      colorHEX: normalizeColorHex(formData.get("colorHEX")),
      sortOrderIndex:
        Number.parseInt(String(formData.get("sortOrderIndex") || "0"), 10) || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await Promise.all([
      invalidateCardapioIndexCache(),
      invalidateSellingPriceHandlerCache(),
    ]);

    return ok({ message: "Tag cadastrada.", tagId: tag.id });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasCardapioTagsIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const payload = loaderData?.payload;
  const tags = payload?.tags || [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{tags.length} tag(s)</span>
        <span>·</span>
        <span>{tags.filter((tag) => tag.public).length} pública(s)</span>
      </div>

      <Form method="get" className="flex flex-wrap items-center gap-6">
        <div className="relative flex min-w-[260px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            type="search"
            defaultValue={payload?.filters.q}
            placeholder="Pesquise pelo nome da tag"
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
        <Link
          to="/admin/vendas/cardapio/tags"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
        >
          <XCircle className="h-3.5 w-3.5" />
          limpar filtros
        </Link>
      </Form>

      {payload?.showNew ? (
        <Form
          method="post"
          className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[minmax(220px,1fr)_160px_100px_auto_auto] md:items-end"
        >
          <div className="space-y-1">
            <Label htmlFor="new-tag-name">Nome</Label>
            <Input id="new-tag-name" name="tagName" autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-tag-color">Cor</Label>
            <Input
              id="new-tag-color"
              name="colorHEX"
              type="color"
              defaultValue="#FFFFFF"
              className="w-full cursor-pointer p-1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-tag-order">Ordem</Label>
            <Input
              id="new-tag-order"
              name="sortOrderIndex"
              type="number"
              defaultValue={0}
            />
          </div>
          <Label className="flex h-9 items-center gap-2 text-sm">
            <Switch name="public" /> Pública
          </Label>
          <button
            type="submit"
            className="h-9 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Criar tag
          </button>
        </Form>
      ) : null}

      {actionData?.message ? (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            actionData.status === 200
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {actionData.message}
        </div>
      ) : null}

      <div className="overflow-hidden bg-white">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Nome <ArrowUpDown className="ml-1 inline h-3 w-3" />
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Cor
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Exibição pública
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Itens vinculados
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                Ordem
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="px-4 py-8 text-sm text-slate-500"
                >
                  Nenhuma tag encontrada.
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow
                  key={tag.id}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <TableCell className="px-4 py-3">
                    <Link
                      to={tag.id}
                      className="font-semibold text-slate-900 hover:text-blue-600"
                    >
                      {tag.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-4 rounded-full border"
                        style={{ backgroundColor: tag.colorHEX }}
                      />
                      {tag.colorHEX}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">
                    {tag.public
                      ? tag.featuredFilter
                        ? "Barra de categorias"
                        : tag.clickable
                        ? "Pública e clicável"
                        : "Pública"
                      : "Interna"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">
                    {tag._count.ItemTag + tag._count.MenuItemTag}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm text-slate-600">
                    {tag.sortOrderIndex}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
