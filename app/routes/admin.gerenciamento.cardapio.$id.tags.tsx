import { Tag } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { associateItemTag, listItemTags, removeItemTag } from "~/domain/item/item-tags.server";
import BadgeTag from "~/domain/tags/components/badge-tag";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";
import { urlAt } from "~/utils/url";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const item = data?.payload?.item;
  return [{ title: item?.name || "Nome não encontrado" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const menuItemId = urlAt(request.url, -2);
    if (!menuItemId) return badRequest("Nenhum item encontrado");

    const menuItem = await prismaClient.menuItem.findUnique({
      where: { id: menuItemId },
      select: {
        id: true,
        name: true,
        itemId: true,
      },
    });

    if (!menuItem) return badRequest("Item não encontrado");
    if (!menuItem.itemId) {
      return badRequest("Este item do cardápio ainda não está vinculado a um Item.");
    }

    const [allTags, itemTagRows] = await Promise.all([
      tagPrismaEntity.findAll(),
      listItemTags(menuItem.itemId),
    ]);

    return ok({
      menuItem,
      item: {
        id: menuItem.itemId,
        name: menuItem.name,
      },
      allTags: allTags || [],
      itemTags: itemTagRows.map((row) => row.Tag),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const itemId = String(values?.itemId || "").trim();
    if (!itemId) return badRequest("Item inválido");

    if (_action === "tag-create") {
      const tagName = String(values?.tagName || "").trim();
      if (!tagName) return badRequest("Nome da tag inválido");

      const tagFound = await prismaClient.tag.findFirst({
        where: { name: tagName },
      });

      if (tagFound) return ok({ message: "Tag já cadastrada", action: "tag-create" });

      const [err] = await tryit(
        tagPrismaEntity.create({
          name: tagName,
          public: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          colorHEX: "#FFFFFF",
          featuredFilter: false,
          sortOrderIndex: 0,
        })
      );

      if (err) return badRequest(err);

      return ok({ message: "Tag cadastrada", action: "tag-create" });
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
      return ok({ message: "Tag associada ao item", action: "item-tag-association" });
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

export default function SingleMenuItemTags() {
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

  if (!item) {
    return <div className="text-sm text-muted-foreground">Item não encontrado.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-8 md:grid-cols-8">
        <Form method="post" className="md:col-span-3">
          <input type="hidden" name="itemId" value={item.id} />
          <Input
            type="text"
            name="tagName"
            className="mb-2"
            placeholder="Criar tag"
          />
          <SubmitButton actionName="tag-create" labelClassName="text-xs" variant="outline" tabIndex={0} iconColor="black" />
        </Form>

        <div className="border rounded-lg p-4 flex flex-col md:col-span-5">
          <div className="grid gap-4 mb-6 md:grid-cols-4">
            <div className="flex flex-col gap-2 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {`Tags disponíveis (${currentTags.length})`}
              </span>
              <span className="text-xs text-muted-foreground">Clique na tag para associar ao item.</span>
            </div>

            <Input
              type="text"
              placeholder="Buscar tag"
              className="md:col-span-2"
              onChange={(e) => {
                const value = e.target.value.toLowerCase();
                setCurrentTags(allTags.filter((tag) => tag.name.toLowerCase().includes(value)));
              }}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {currentTags.map((tag) => (
              <Form method="post" key={tag.id}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="tag" value={jsonStringify(tag)} />
                <button type="submit" name="_action" value="item-tag-association" className="hover:underline">
                  <BadgeTag tag={tag} classNameLabel="text-sm" allowRemove={false} />
                </button>
              </Form>
            ))}
          </div>
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
                <input type="hidden" name="itemId" value={item.id} />
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
