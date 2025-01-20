import { Form, Link, useActionData, useOutletContext } from "@remix-run/react";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import { AdminCardapioOutletContext } from "./admin.gerenciamento.cardapio";
import { MenuItem } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { toast } from "~/components/ui/use-toast";

import tryit from "~/utils/try-it";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { menuItemPriceVariationsEntity } from "~/domain/cardapio/menu-item-price-variations.prisma.entity.server";
import randomReactKey from "~/utils/random-react-key";
import { Category } from "~/domain/category/category.model.server";
import MenuItemCard from "~/domain/cardapio/components/menu-item-card/menu-item-card";
import { Menu } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import BadgeTag from "~/domain/tags/components/badge-tag";
import capitalize from "~/utils/capitalize";
import { Switch } from "~/components/ui/switch";
import React from "react";



export type MenuItemActionSearchParam = "menu-item-create" | "menu-item-edit" | "menu-item-delete" | "menu-items-sortorder" | null

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })

    if (values?.action === "menu-item-move") {
        const items = JSON.parse(formData.get('items') as string);

        type MenuItemWithIndex = MenuItem & { index: number };
        const updateSortOrderIndexPromises = items.map((item: MenuItemWithIndex) => menuItemPrismaEntity.update(item.id, {
            sortOrderIndex: item.index
        }))

        const [err, result] = await tryit(Promise.all(updateSortOrderIndexPromises))

        if (err) {
            return badRequest(err)
        }

        return ok("Ordenamento atualizado");

    }

    if (_action === "menu-item-visibility-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            visible: !item.visible
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.visible === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

        return ok(returnedMessage);
    }

    if (_action === "menu-item-card-price-upsert") {

        const id = values?.id as string
        const menuItemId = values?.menuItemId as string
        const label = values?.label as string
        const amount = values?.amount as string

        const [errItem, itemVariationPrice] = await prismaIt(menuItemPriceVariationsEntity.findByItemIdAndVariation(menuItemId, label));

        const priceVariationRecord = {
            amount: parseFloat(amount),
            label: label,
            discountPercentage: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            showOnCardapio: amount === "0" ? false : true,
            MenuItem: {
                connect: {
                    id: menuItemId
                }
            },
        }

        if (!itemVariationPrice) {
            const [err, item] = await prismaIt(menuItemPriceVariationsEntity.create(priceVariationRecord))

            if (err) {
                return badRequest(err)
            }
        } else {
            const [err, item] = await prismaIt(menuItemPriceVariationsEntity.update(itemVariationPrice.id, {
                ...priceVariationRecord,
                createdAt: itemVariationPrice.createdAt,
            }));

            if (err) {
                return badRequest(err)
            }
        }

        return ok("Precos atualizados");

    }



    return null
}

export default function AdminCardapio() {
    const outletContext: AdminCardapioOutletContext = useOutletContext()
    const items = outletContext?.items || [] as { category: Category["name"], menuItems: MenuItemWithAssociations[] }[]

    const actionData = useActionData<typeof action>()




    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    if (actionData && actionData.status === 200) {


        toast({
            title: "Ok",
            description: actionData.message,
        })
    }

    return (

        <div className="flex flex-col gap-4 ">
            <div className="grid grid-cols-8  gap-4">
                <div className="flex flex-col gap-2 justify-center items-center mb-2 col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Publicados</span>
                    <span className="text-3xl text-muted-foreground">{items.filter(item => item?.visible).length}</span>
                </div>
                <div className="flex flex-col gap-2 justify-center items-center mb-2 col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Invisiveis</span>
                    <span className="text-3xl text-muted-foreground">{items.filter(item => item?.visible === false).length}</span>
                </div>

                <div className="flex flex-col gap-2 justify-center items-center mb-2 col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Sem Imagem</span>
                    <span className="text-3xl text-muted-foreground">{items.filter(item => item?.imageId === null).length}</span>
                </div>
                <div className="flex flex-col gap-2 justify-center items-center mb-2 col-span-2 border rounded-md p-4">
                    <span className="uppercase font-semibold text-xs tracking-wide">Futuro lançamento</span>
                    <span className="text-3xl text-muted-foreground">{items.filter(item => item?.tags?.all?.includes("futuro-lançamento")).length}</span>
                </div>
            </div>
            {/* <MenuItemListStat items={items} /> */}
            {/* <MenuItemList initialItems={items} /> */}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    {items.slice(0, Math.ceil(items.length / 2)).map((item) => (
                        <MenuItemListSliced key={item.category} item={item} />
                    ))}
                </div>
                <div>
                    {items.slice(Math.ceil(items.length / 2)).map((item) => (
                        <MenuItemListSliced key={item.category} item={item} />
                    ))}
                </div>
            </div>


        </div>

    )
}


function MenuItemListSliced({ item }: { item: { category: Category["name"], menuItems: MenuItemWithAssociations[] } }) {
    const [visible, setVisible] = React.useState(false)
    const submitBtnRef = React.useRef<HTMLButtonElement>(null)

    function handleVisibility() {

        setVisible(!visible)

        if (submitBtnRef.current) {
            submitBtnRef.current.click()
        }
    }

    return (
        <div key={item.category} className="flex flex-col mb-6">
            <h3 className="uppercase font-semibold text-3xl tracking-tight">{item.category}</h3>
            <Separator className="my-2" />
            <ul>
                {item.menuItems.map((menuItem) => (
                    <li key={menuItem.id} className="flex flex-col mb-2">
                        <Link to={`${menuItem?.id}/main`} className="flex flex-col p-1 hover:bg-muted">
                            <div className="grid grid-cols-6">
                                <span className="font-semibold uppercase mb-0 tracking-wider col-span-4">{menuItem.name}</span>
                                <Form method="post" className="flex justify-between md:justify-end gap-2 w-full items-center col-span-2">

                                    <span className="font-semibold text-sm">Públicar</span>
                                    <Switch defaultChecked={menuItem?.visible || false} onCheckedChange={handleVisibility} />
                                    <input type="hidden" name="id" value={menuItem?.id} />
                                    <button ref={submitBtnRef} className="hidden" type="submit" value={"menu-item-visibility-change"} name="_action" />

                                </Form>
                            </div>

                            <div className="flex gap-2">
                                {menuItem.tags?.models.map((tag) => (
                                    <BadgeTag key={tag?.id} tag={tag} allowRemove={false}
                                        classNameLabel="text-xs uppercase tracking-wider"
                                        classNameContainer="py-0 px-1.5"
                                    />
                                ))}
                            </div>
                            <span>{capitalize(menuItem.ingredients)}</span>

                        </Link>

                    </li>
                ))}
            </ul>
        </div>
    )
}







