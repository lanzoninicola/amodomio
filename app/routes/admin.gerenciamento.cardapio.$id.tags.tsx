import { MenuItemTag, Tag } from "@prisma/client";
import { LoaderFunctionArgs, MetaArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useOutletContext } from "@remix-run/react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { urlAt } from "~/utils/url";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { toast } from "~/components/ui/use-toast";
import { Tags, X } from "lucide-react";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import BadgeTag from "~/domain/tags/components/badge-tag";
import prismaClient from "~/lib/prisma/client.server";
import tryit from "~/utils/try-it";

export const meta: MetaFunction = ({ data }) => {
    // @ts-ignore
    const item: MenuItemWithAssociations = data?.payload?.item

    return [
        { title: item?.name || "Nome não encontrado" },
    ];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const itemId = urlAt(request.url, -2)

    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }


    const itemQuery = prismaIt(menuItemPrismaEntity.findById(itemId));
    const tagsQuery = prismaIt(tagPrismaEntity.findAll());

    const results = await Promise.all([itemQuery, tagsQuery])

    const [errItems, item] = results[0]
    const [errTags, tags] = results[1]

    if (errItems) {
        return badRequest(errItems)
    }


    return ok({
        item,
        allTags: tags
    });


}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ _action, values })

    if (_action === "tag-create") {

        const tagName = values?.tagName as string
        const itemId = values?.itemId as string

        if (!itemId) {
            return badRequest("Item não encontrado")
        }

        const tagFound = await prismaClient.tag.findFirst({
            where: {
                name: tagName
            }
        })

        if (tagFound) {
            return ok("Tag ja cadastrada")
        }

        const nextTag: Omit<Tag, "id"> = {
            name: tagName,
            public: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            colorHEX: "#FFFFFF",
        }

        const [err, _] = await tryit(prismaClient.tag.create({
            data: nextTag
        }))

        if (err) {
            return badRequest(err)
        }

        return ok({
            message: "Tag cadastrada",
            action: "tag-create"
        })

    }

    if (_action === "tag-remove") {

        const tagId = values?.tagId as string

        const tagFound = await prismaClient.tag.findFirst({
            where: {
                id: tagId
            }
        })

        if (!tagFound) {
            return badRequest("Tag nao encontrada")
        }


        const [err, _] = await tryit(tagPrismaEntity.delete(tagId))

        if (err) {
            return badRequest(err)
        }

        return ok(`Tag ${tagFound.name} removido`)
    }

    if (_action === "menu-item-tag-association") {

        const tagSelected = jsonParse(values?.tag as string) as Tag
        const itemId = values?.itemId as string

        if (!itemId) {
            return badRequest("Item não encontrado")
        }

        if (!tagSelected?.id) {
            return badRequest("Tag não informado")
        }

        const [err, _] = await prismaIt(menuItemPrismaEntity.associateTag(itemId, tagSelected))

        if (err) {
            return badRequest(err)
        }

        return ok({
            message: "Tag associado ao item",
            action: "menu-item-tag-association"
        })
    }

    if (_action === "menu-item-tag-dissociate") {

        const itemId = values?.itemId as string
        const tagId = values?.tagId as string

        const tagFound = await prismaClient.tag.findFirst({
            where: {
                id: tagId
            }
        })

        if (!tagFound) {
            return badRequest("Tag nao encontrada")
        }


        const [err, result] = await prismaIt(menuItemPrismaEntity.removeTag(itemId, tagFound?.id))

        if (err) {
            return badRequest(err)
        }

        return ok(`Tag ${tagFound.name} removido`)
    }



    return null
}


export default function SingleMenuItemTags() {
    const loaderData = useLoaderData<typeof loader>()
    const item: MenuItemWithAssociations = loaderData.payload?.item
    const allTags: Tag[] = loaderData.payload?.allTags || []
    const itemTags: Tag[] = item?.tags?.models || []

    const actionData = useActionData<typeof action>()

    if (actionData && actionData?.status > 399) {
        toast({
            title: "Erro",
            description: actionData?.message,
        })
    }

    if (actionData && actionData?.status === 200) {
        toast({
            title: "OK",
            description: actionData?.message
        })
    }

    const [currentTags, setCurrentTags] = useState(allTags)

    return (


        <div className="flex flex-col gap-4">

            <div className="grid grid-cols-8 gap-x-8">

                <Form method="post" className="col-span-3">
                    <input type="hidden" name="itemId" value={item.id} />
                    <Input type="text"
                        name="tagName"
                        className="mb-2"
                        placeholder="Criar tag"
                    />
                    <SubmitButton actionName={"tag-create"} labelClassName="text-xs" variant={"outline"} tabIndex={0} iconColor="black" />
                </Form>


                <div className="border rounded-lg p-4 flex flex-col col-span-5">
                    <div className="grid grid-cols-4 mb-6">
                        <div className="flex flex-col gap-2 col-span-2">
                            <span className="text-xs font-semibold text-muted-foreground">{`Tags disponíveis (${currentTags.length})`}</span>
                            <span className="text-xs text-muted-foreground ">Obs: clicar no tag para adiçionar</span>
                        </div>
                        <Input type="text"
                            placeholder="Buscar tag"
                            className="col-span-2"
                            onChange={
                                (e: React.ChangeEvent<HTMLInputElement>) => {
                                    const value = e.target.value
                                    const tagsFound = allTags.filter(t => t.name.toLowerCase().includes(value.toLowerCase()))
                                    setCurrentTags(tagsFound)
                                }
                            }></Input>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {
                            currentTags.map((t: Tag) => {
                                return (
                                    <Form method="post" key={t.id}>
                                        <input type="hidden" name="itemId" value={item.id} />
                                        <input type="hidden" name="tag" value={jsonStringify(t)} />
                                        <button type="submit" name="_action" value="menu-item-tag-association" className="hover:underline">
                                            <BadgeTag tag={t} actionName="tag-remove" classNameLabel="text-sm" />
                                        </button>
                                    </Form>
                                )
                            })
                        }
                    </div>
                </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col">
                <div className="flex flex-col gap-2 mb-4">
                    <span className="text-xs font-semibold text-muted-foreground">{`Tags associados (${item.tags?.all.length || 0})`}</span>
                </div>
                <ul className="flex gap-2 flex-wrap">
                    {
                        itemTags.map((t: Tag) => {

                            return (
                                <li key={t.id} >
                                    <BadgeItemTag itemId={item.id} tag={t} />
                                </li>
                            )
                        })
                    }
                </ul>
            </div>
        </div>
    )
}


function BadgeItemTag({ itemId, tag }: { itemId: string, tag: Tag }) {

    return (
        <Form method="post">
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="tagId" value={tag.id} />
            <BadgeTag tag={tag} actionName="menu-item-tag-dissociate" />
        </Form>
    )
}