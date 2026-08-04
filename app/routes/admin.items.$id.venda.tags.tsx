import { Tag } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
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
      <div className="rounded-lg border p-4">
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {`Tags disponíveis (${currentTags.length})`}
            </span>
            <span className="text-xs text-muted-foreground">
              Clique na tag para associar ao item. A descrição pública,
              visibilidade e comportamento clicável são configurados no
              gerenciamento global de tags.
            </span>
          </div>

          <Input
            type="text"
            placeholder="Buscar tag"
            className="md:col-span-2"
            onChange={(e) => {
              const value = e.target.value.toLowerCase();
              setCurrentTags(
                allTags.filter((tag) => tag.name.toLowerCase().includes(value))
              );
            }}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {currentTags.map((tag) => (
            <Form method="post" key={tag.id} className="min-w-0">
              <input type="hidden" name="tag" value={jsonStringify(tag)} />
              <button
                type="submit"
                name="_action"
                value="item-tag-association"
                className="flex w-full justify-start hover:underline"
              >
                <BadgeTag
                  tag={tag}
                  classNameContainer="max-w-full"
                  classNameLabel="text-sm"
                  allowRemove={false}
                />
              </button>
            </Form>
          ))}
        </div>

        <Link
          to="/admin/vendas/cardapio/tags"
          className="mt-4 inline-flex text-xs font-semibold uppercase tracking-wide underline"
        >
          Gerenciar tags públicas
        </Link>
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
