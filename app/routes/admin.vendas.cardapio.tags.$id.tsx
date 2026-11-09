import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  invalidateCardapioIndexCache,
  invalidateSellingPriceHandlerCache,
} from "~/domain/cardapio/cardapio-cache.server";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function normalizeColorHex(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : "#FFFFFF";
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    if (!params.id) return badRequest("Tag inválida");
    const tag = await prismaClient.tag.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        _count: {
          select: {
            ItemTag: { where: { deletedAt: null } },
            MenuItemTag: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!tag) return badRequest("Tag não encontrada");
    return ok({ tag });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    if (!params.id) return badRequest("Tag inválida");
    const formData = await request.formData();
    const name = String(formData.get("tagName") || "").trim();
    if (!name) return badRequest("Nome da tag inválido");

    const duplicate = await prismaClient.tag.findFirst({
      where: { id: { not: params.id }, name, deletedAt: null },
      select: { id: true },
    });
    if (duplicate) return badRequest("Já existe outra tag com esse nome.");

    await tagPrismaEntity.update(params.id, {
      name,
      description: String(formData.get("description") || "").trim() || null,
      public: formData.get("public") === "on",
      clickable: formData.get("clickable") === "on",
      featuredFilter: formData.get("featuredFilter") === "on",
      colorHEX: normalizeColorHex(formData.get("colorHEX")),
      sortOrderIndex:
        Number.parseInt(String(formData.get("sortOrderIndex") || "0"), 10) || 0,
    });

    await Promise.all([
      invalidateCardapioIndexCache(),
      invalidateSellingPriceHandlerCache(),
    ]);
    return ok({ message: "Tag atualizada." });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasCardapioTagDetail() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const tag = loaderData?.payload?.tag;

  if (!tag)
    return <div className="text-sm text-slate-500">Tag não encontrada.</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <Link
            to=".."
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ChevronLeft size={14} /> lista de tags
          </Link>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {tag.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {tag._count.ItemTag + tag._count.MenuItemTag} item(ns) vinculado(s)
          </p>
        </div>
      </div>

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

      <Form method="post" className="grid max-w-5xl gap-5 lg:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tag-name">Nome</Label>
          <Input id="tag-name" name="tagName" defaultValue={tag.name} />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tag-color">Cor</Label>
            <Input
              id="tag-color"
              name="colorHEX"
              type="color"
              defaultValue={tag.colorHEX}
              className="w-full cursor-pointer p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tag-order">Ordem</Label>
            <Input
              id="tag-order"
              name="sortOrderIndex"
              type="number"
              defaultValue={tag.sortOrderIndex}
            />
          </div>
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="tag-description">Descrição pública</Label>
          <Textarea
            id="tag-description"
            name="description"
            rows={5}
            defaultValue={tag.description || ""}
            placeholder="Texto exibido ao cliente"
          />
        </div>
        <div className="flex flex-wrap gap-6 lg:col-span-2">
          <Label className="flex items-center gap-2 text-sm">
            <Switch name="public" defaultChecked={tag.public} /> Pública
          </Label>
          <Label className="flex items-center gap-2 text-sm">
            <Switch name="clickable" defaultChecked={tag.clickable} /> Clicável
          </Label>
          <Label className="flex items-center gap-2 text-sm">
            <Switch name="featuredFilter" defaultChecked={tag.featuredFilter} />{" "}
            Na barra de categorias (se pública)
          </Label>
        </div>
        <div className="lg:col-span-2">
          <button
            type="submit"
            className="h-9 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Salvar alterações
          </button>
        </div>
      </Form>
    </div>
  );
}
