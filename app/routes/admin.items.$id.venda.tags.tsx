import { Tag } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import {
  associateItemTag,
  listItemTags,
  removeItemTag,
} from "~/domain/item/item-tags.server";
import BadgeTag from "~/domain/tags/components/badge-tag";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";

export const meta = buildAdminItemsMeta("Tags de venda");

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const item = await prismaClient.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!item) return badRequest("Item não encontrado");

    const [allTags, itemTagRows] = await Promise.all([
      tagPrismaEntity.findAll(),
      listItemTags(itemId),
    ]);

    return ok({
      item,
      allTags: allTags || [],
      itemTags: itemTagRows.map((row) => row.Tag),
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
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "tag-create") {
      const tagName = String(values?.tagName || "").trim();
      if (!tagName) return badRequest("Nome da tag inválido");
      const description = String(values?.description || "").trim();
      const isPublic = values?.public === "on";
      const clickable = values?.clickable === "on";

      const tagFound = await prismaClient.tag.findFirst({
        where: { name: tagName },
      });

      if (tagFound)
        return ok({ message: "Tag já cadastrada", action: "tag-create" });

      const [err] = await tryit(
        tagPrismaEntity.create({
          name: tagName,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          colorHEX: "#FFFFFF",
          featuredFilter: false,
          sortOrderIndex: 0,
          description: description || null,
          clickable,
          public: isPublic,
        })
      );

      if (err) return badRequest(err);

      return ok({ message: "Tag cadastrada", action: "tag-create" });
    }

    if (_action === "tag-update") {
      const tagId = String(values?.tagId || "").trim();
      const tagName = String(values?.tagName || "").trim();
      const description = String(values?.description || "").trim();
      const isPublic = values?.public === "on";
      const clickable = values?.clickable === "on";
      if (!tagId) return badRequest("Tag inválida");
      if (!tagName) return badRequest("Nome da tag inválido");

      const tagFound = await prismaClient.tag.findFirst({
        where: { id: tagId },
        select: { id: true },
      });

      if (!tagFound) return badRequest("Tag não encontrada");

      await tagPrismaEntity.update(tagId, {
        name: tagName,
        description: description || null,
        public: isPublic,
        clickable,
      });

      return ok({ message: "Tag atualizada", action: "tag-update" });
    }

    if (_action === "tag-remove") {
      const tagId = String(values?.tagId || "").trim();
      if (!tagId) return badRequest("Tag inválida");

      const tagFound = await prismaClient.tag.findFirst({
        where: { id: tagId },
      });

      if (!tagFound) return badRequest("Tag não encontrada");

      const [err] = await tryit(tagPrismaEntity.delete(tagId));
      if (err) return badRequest(err);

      return ok(`Tag ${tagFound.name} removida`);
    }

    if (_action === "item-tag-association") {
      const tagSelected = jsonParse(String(values?.tag || "")) as Tag | null;
      if (!tagSelected?.id) return badRequest("Tag não informada");

      await associateItemTag(itemId, tagSelected.id);
      return ok({
        message: "Tag associada ao item",
        action: "item-tag-association",
      });
    }

    if (_action === "item-tag-dissociate") {
      const tagId = String(values?.tagId || "").trim();
      if (!tagId) return badRequest("Tag inválida");

      const tagFound = await prismaClient.tag.findFirst({
        where: { id: tagId },
      });

      if (!tagFound) return badRequest("Tag não encontrada");

      await removeItemTag(itemId, tagFound.id);
      return ok(`Tag ${tagFound.name} removida`);
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemVendaTagsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const payload = (loaderData?.payload || {}) as {
    item?: { id: string; name: string };
    allTags?: Tag[];
    itemTags?: Tag[];
  };

  const item = payload.item;
  const allTags = payload.allTags || [];
  const itemTags = payload.itemTags || [];

  if (actionData && actionData.status > 399) {
    toast({
      title: "Erro",
      description: actionData.message,
    });
  }

  if (actionData && actionData.status === 200) {
    toast({
      title: "OK",
      description: actionData.message,
    });
  }

  const [currentTags, setCurrentTags] = useState(allTags);

  useEffect(() => {
    setCurrentTags(allTags);
  }, [allTags]);

  if (!item) {
    return (
      <div className="text-sm text-muted-foreground">Item não encontrado.</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-8 md:grid-cols-8">
        <Form method="post" className="space-y-3 md:col-span-3">
          <div className="space-y-1">
            <Label htmlFor="tagName">Nova tag</Label>
            <Input
              id="tagName"
              type="text"
              name="tagName"
              placeholder="Criar tag"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Descrição pública</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Texto exibido na modal do cardápio"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <Label className="flex items-center gap-2 text-sm">
              <Switch name="public" />
              Pública
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Switch name="clickable" />
              Clicável
            </Label>
          </div>
          <SubmitButton
            actionName="tag-create"
            labelClassName="text-xs"
            variant="outline"
            tabIndex={0}
            iconColor="black"
          />
        </Form>

        <div className="border rounded-lg p-4 flex flex-col md:col-span-5">
          <div className="grid gap-4 mb-6 md:grid-cols-4">
            <div className="flex flex-col gap-2 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {`Tags disponíveis (${currentTags.length})`}
              </span>
              <span className="text-xs text-muted-foreground">
                Clique na tag para associar ao item.
              </span>
            </div>

            <Input
              type="text"
              placeholder="Buscar tag"
              className="md:col-span-2"
              onChange={(e) => {
                const value = e.target.value.toLowerCase();
                setCurrentTags(
                  allTags.filter((tag) =>
                    tag.name.toLowerCase().includes(value)
                  )
                );
              }}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {currentTags.map((tag) => (
              <Form method="post" key={tag.id}>
                <input type="hidden" name="tag" value={jsonStringify(tag)} />
                <button
                  type="submit"
                  name="_action"
                  value="item-tag-association"
                  className="hover:underline"
                >
                  <BadgeTag
                    tag={tag}
                    classNameLabel="text-sm"
                    allowRemove={false}
                  />
                </button>
              </Form>
            ))}
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">
            Configuração pública das tags
          </span>
          <span className="text-xs text-muted-foreground">
            Tags públicas aparecem no cardápio. Tags clicáveis com descrição
            abrem a modal no card do sabor.
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {allTags.map((tag) => (
            <Form key={tag.id} method="post" className="rounded-lg border p-3">
              <input type="hidden" name="tagId" value={tag.id} />
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`tag-name-${tag.id}`}>Nome</Label>
                  <Input
                    id={`tag-name-${tag.id}`}
                    name="tagName"
                    defaultValue={tag.name}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`tag-description-${tag.id}`}>Descrição</Label>
                  <Textarea
                    id={`tag-description-${tag.id}`}
                    name="description"
                    rows={3}
                    defaultValue={(tag as any).description || ""}
                    placeholder="Descrição exibida ao cliente"
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <Label className="flex items-center gap-2 text-sm">
                    <Switch name="public" defaultChecked={tag.public} />
                    Pública
                  </Label>
                  <Label className="flex items-center gap-2 text-sm">
                    <Switch
                      name="clickable"
                      defaultChecked={Boolean((tag as any).clickable)}
                    />
                    Clicável
                  </Label>
                </div>
                <SubmitButton
                  actionName="tag-update"
                  labelClassName="text-xs"
                  variant="outline"
                  tabIndex={0}
                  iconColor="black"
                />
              </div>
            </Form>
          ))}
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col">
        <div className="flex flex-col gap-2 mb-4">
          <span className="text-xs font-semibold text-muted-foreground">{`Tags associadas (${itemTags.length})`}</span>
        </div>
        <ul className="flex gap-2 flex-wrap">
          {itemTags.map((tag) => (
            <li key={tag.id}>
              <Form method="post">
                <input type="hidden" name="tagId" value={tag.id} />
                <BadgeTag tag={tag} actionName="item-tag-dissociate" />
              </Form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
