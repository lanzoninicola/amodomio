import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { slugifyString } from "~/utils/slugify";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function toBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const [item, categories, groups] = await Promise.all([
      (prismaClient as any).item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          name: true,
          ItemSellingInfo: {
            select: {
              id: true,
              ingredients: true,
              longDescription: true,
              categoryId: true,
              itemGroupId: true,
              notesPublic: true,
              slug: true,
              upcoming: true,
            },
          },
        },
      }),
      prismaClient.category.findMany({
        where: { type: "menu" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
        },
      }),
      prismaClient.itemGroup.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: {
          id: true,
          key: true,
          name: true,
        },
      }),
    ]);

    if (!item) return badRequest("Item não encontrado");

    return ok({
      item,
      categories,
      groups,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "");

    if (actionName !== "update-commercial-info") {
      return badRequest("Ação inválida");
    }

    const ingredients = String(formData.get("ingredients") || "").trim();
    const longDescriptionRaw = String(formData.get("longDescription") || "").trim();
    const notesPublicRaw = String(formData.get("notesPublic") || "").trim();
    const slugRaw = String(formData.get("slug") || "").trim();
    const upcoming = toBool(formData.get("upcoming"));
    const categoryId = String(formData.get("categoryId") || "").trim();
    const itemGroupIdRaw = String(formData.get("itemGroupId") || "").trim();
    const slug = slugRaw ? slugifyString(slugRaw) : null;

    if (!categoryId) {
      return badRequest("Categoria inválida");
    }

    if (slug) {
      const slugConflict = await (prismaClient as any).itemSellingInfo.findFirst({
        where: {
          slug,
          itemId: { not: itemId },
        },
        select: { itemId: true },
      });

      if (slugConflict) {
        return badRequest("Slug já está em uso por outro item.");
      }
    }

    const [category, group] = await Promise.all([
      prismaClient.category.findFirst({
        where: {
          id: categoryId,
          type: "menu",
        },
        select: { id: true },
      }),
      itemGroupIdRaw
        ? prismaClient.itemGroup.findFirst({
            where: {
              id: itemGroupIdRaw,
              deletedAt: null,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!category) {
      return badRequest("Categoria de cardápio não encontrada");
    }

    if (itemGroupIdRaw && !group) {
      return badRequest("Grupo não encontrado");
    }

    await (prismaClient as any).itemSellingInfo.upsert({
      where: { itemId },
      update: {
        ingredients: ingredients || null,
        longDescription: longDescriptionRaw || null,
        notesPublic: notesPublicRaw || null,
        slug,
        upcoming,
        categoryId,
        itemGroupId: itemGroupIdRaw || null,
      },
      create: {
        itemId,
        ingredients: ingredients || null,
        longDescription: longDescriptionRaw || null,
        notesPublic: notesPublicRaw || null,
        slug,
        upcoming,
        categoryId,
        itemGroupId: itemGroupIdRaw || null,
      },
    });

    return ok("Informações comerciais atualizadas.");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemVendaComercialRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const payload = (loaderData?.payload || {}) as {
    item?: {
      id: string;
      name: string;
      ItemSellingInfo?: {
        id: string;
        ingredients: string | null;
        longDescription: string | null;
        notesPublic: string | null;
        slug: string | null;
        upcoming: boolean;
        categoryId: string | null;
        itemGroupId: string | null;
      } | null;
    } | null;
    categories?: Array<{
      id: string;
      name: string;
    }>;
    groups?: Array<{
      id: string;
      key: string;
      name: string;
    }>;
  };

  const item = payload.item || null;
  const sellingInfo = item?.ItemSellingInfo || null;
  const categories = payload.categories || [];
  const groups = payload.groups || [];
  const [categoryIdValue, setCategoryIdValue] = useState(sellingInfo?.categoryId || "");
  const [groupIdValue, setGroupIdValue] = useState(sellingInfo?.itemGroupId || "__EMPTY__");
  const [upcomingValue, setUpcomingValue] = useState(sellingInfo?.upcoming === true);

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }

    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }
  }, [actionData]);

  useEffect(() => {
    setCategoryIdValue(sellingInfo?.categoryId || "");
    setGroupIdValue(sellingInfo?.itemGroupId || "__EMPTY__");
    setUpcomingValue(sellingInfo?.upcoming === true);
  }, [sellingInfo?.categoryId, sellingInfo?.itemGroupId, sellingInfo?.upcoming]);

  if (!item) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Item não encontrado</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <Form method="post" className="space-y-10">
        <input type="hidden" name="_action" value="update-commercial-info" />
        <input type="hidden" name="categoryId" value={categoryIdValue} />
        <input type="hidden" name="itemGroupId" value={groupIdValue === "__EMPTY__" ? "" : groupIdValue} />
        <input type="hidden" name="upcoming" value={upcomingValue ? "true" : "false"} />

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Conteúdo</h3>
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ingredients">Lista ingredientes</Label>
              <Textarea
                id="ingredients"
                name="ingredients"
                defaultValue={sellingInfo?.ingredients || ""}
                placeholder="Ex.: molho de tomate, muçarela, manjericão..."
                className="min-h-32"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longDescription">Descrição extensa</Label>
              <Textarea
                id="longDescription"
                name="longDescription"
                defaultValue={sellingInfo?.longDescription || ""}
                placeholder="Texto comercial mais completo para o canal."
                className="min-h-32"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Organização</h3>
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="categoryIdSelect">Categoria</Label>
              <Select value={categoryIdValue} onValueChange={setCategoryIdValue}>
                <SelectTrigger id="categoryIdSelect">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemGroupIdSelect">Grupo</Label>
              <Select value={groupIdValue} onValueChange={setGroupIdValue}>
                <SelectTrigger id="itemGroupIdSelect">
                  <SelectValue placeholder="Sem grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem grupo</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Publicação</h3>
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug público</Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={sellingInfo?.slug || ""}
                placeholder={slugifyString(item.name) || "slug-publico"}
              />
              <p className="text-xs text-slate-500">Usado na URL do detalhe quando a source do cardápio é `items`.</p>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                A visibilidade publica por canal e controlada na aba <span className="font-semibold">Canais</span>.
                Aqui ficam apenas os dados comerciais gerais do item.
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="upcomingSwitch">Lançamento futuro</Label>
                  <p className="text-xs text-slate-500">Quando ativo, o item fica fora da vitrine pública nativa.</p>
                </div>
                <button
                  id="upcomingSwitch"
                  type="button"
                  onClick={() => setUpcomingValue((current) => !current)}
                  className={`inline-flex h-6 w-11 items-center rounded-full transition ${
                    upcomingValue ? "bg-slate-900" : "bg-slate-300"
                  }`}
                  aria-pressed={upcomingValue}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                      upcomingValue ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Observações</h3>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notesPublic">Observações públicas</Label>
            <Textarea
              id="notesPublic"
              name="notesPublic"
              defaultValue={sellingInfo?.notesPublic || ""}
              placeholder="Informações adicionais visíveis para o cliente."
              className="min-h-28"
            />
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-8">
          <div className="text-sm text-slate-600">
            <div className="font-medium text-slate-900">{item.name}</div>
          </div>
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
            Salvar informações comerciais
          </Button>
        </section>
      </Form>
    </div>
  );
}
