import { MenuItemTag } from "@prisma/client";
import { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData, useOutletContext } from "@remix-run/react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { urlAt } from "~/utils/url";
import SubmitButton from "~/components/primitives/submit-button/submit-button";



export async function loader({ request }: LoaderArgs) {
    const itemId = urlAt(request.url, -2)

    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }

    const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(itemId));
    const [errAllTags, allTags] = await prismaIt(menuItemTagPrismaEntity.findAllDistinct());
    const [errItemTags, itemTags] = await prismaIt(menuItemTagPrismaEntity.findByItemId(itemId));

    let err = errAllTags || errItemTags;

    if (err) {
        return serverError(err);
    }

    if (!allTags) {
        return badRequest("Nenhum tags encontrado");
    }

    return ok({
        item,
        allTags,
        itemTags
    });
}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-tag-add") {

        const name = values?.tagName as string

        const itemId = values?.itemId as string

        if (!itemId) {
            return badRequest("Item não encontrado")
        }

        const alreadyExists = await menuItemPrismaEntity.hasTag(itemId, name)

        if (alreadyExists === true) {
            return null
        }

        const [err, _] = await prismaIt(menuItemPrismaEntity.addTag(itemId, name))

        if (err) {
            return badRequest(err)
        }

        return ok("Tag adicionada")
    }

    if (_action === "menu-item-tag-remove") {

        const itemId = values?.itemId as string
        const name = values?.tagName as string

        const [err, result] = await prismaIt(menuItemPrismaEntity.removeTag(itemId, name))

        if (err) {
            return badRequest(err)
        }

        return ok("Tag removida")
    }

    return null
}


export default function SingleMenuItemTags() {
    const loaderData = useLoaderData<typeof loader>()
    const item: MenuItemWithAssociations = loaderData.payload?.item
    const allTags = loaderData.payload?.allTags || []
    const itemTags = loaderData.payload?.itemTags || []

    const [filteredTags, setFilteredTags] = useState(allTags)

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
                    <SubmitButton actionName={"menu-item-tag-add"} labelClassName="text-xs" variant={"outline"} tabIndex={0} />
                </Form>


                <div className="border rounded-lg p-4 flex flex-col col-span-5">
                    <div className="grid grid-cols-4 mb-6">
                        <div className="flex flex-col gap-2 col-span-2">
                            <span className="text-xs font-semibold text-muted-foreground">{`Tags disponíveis (${filteredTags.length})`}</span>
                            <span className="text-xs text-muted-foreground ">Obs: clicar no tag para adiçionar</span>
                        </div>
                        <Input type="text"
                            placeholder="Buscar tag"
                            className="col-span-2"
                            onChange={
                                (e: React.ChangeEvent<HTMLInputElement>) => {
                                    const value = e.target.value
                                    setFilteredTags(allTags.filter((t: MenuItemTag) => t.name.toLowerCase().includes(value.toLowerCase())))
                                }
                            }></Input>
                    </div>
                    <div className="flex gap-4">
                        {
                            filteredTags.map((t: MenuItemTag) => {
                                return (
                                    <Form method="post" key={t.id}>
                                        <input type="hidden" name="itemId" value={item.id} />
                                        <input type="hidden" name="tagName" value={t.name} />
                                        <button type="submit" name="_action" value="menu-item-tag-add" className="hover:underline">
                                            <Badge className="w-fit">{t.name}</Badge>
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
                    <span className="text-xs font-semibold text-muted-foreground">{`Tags associados (${itemTags.length})`}</span>
                    <span className="text-xs text-muted-foreground ">Obs: clicar no tag para excluir</span>
                </div>
                {
                    itemTags.map((t: MenuItemTag) => <BadgeTag key={t.id} itemId={item.id} tag={t} />)
                }
            </div>
        </div>
    )
}


function BadgeTag({ itemId, tag }: { itemId: string, tag: MenuItemTag }) {


    return (
        <Badge className="w-fit">
            <Form method="post">
                <input type="hidden" name="itemId" value={itemId} />
                <input type="hidden" name="tagName" value={tag.name} />
                <button type="submit" name="_action" value="menu-item-tag-remove" className="hover:underline">
                    {tag.name}
                </button>
            </Form>
        </Badge>
    )
}