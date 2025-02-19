
import { MenuItem, Category } from "@prisma/client"
import { LoaderFunctionArgs } from "@remix-run/node"
import { Form, Link, useActionData, useOutletContext } from "@remix-run/react"
import { ok } from "assert"

import React from "react"
import { toast } from "~/components/ui/use-toast"
import items from "~/domain/cardapio/db-mock/items"
import { menuItemPriceVariationsEntity } from "~/domain/cardapio/menu-item-price-variations.prisma.entity.server"
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server"
import BadgeTag from "~/domain/tags/components/badge-tag"
import { prismaIt } from "~/lib/prisma/prisma-it.server"
import capitalize from "~/utils/capitalize"
import { badRequest } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"
import { AdminCardapioOutletContext } from "./admin.gerenciamento.cardapio"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"


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

export default function AdminGerenciamentoCardapioMain() {
    const outletContext: AdminCardapioOutletContext = useOutletContext();
    const listGroupedByCategory = outletContext?.listGroupedByCategory || [];
    const actionData = useActionData<typeof action>();

    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
        });
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "Ok",
            description: actionData.message,
        });
    }


    return (
        <>
            {/* Desktop com multi-colunas */}
            <div className="hidden md:columns-2 md:gap-6 md:block">
                {listGroupedByCategory.map((item) => (
                    <div key={item.category} className="break-inside-avoid mb-6">
                        <MenuItemListSliced item={item} />
                    </div>
                ))}
            </div>

            {/* Mobile */}
            <div className="flex flex-col md:hidden">
                {listGroupedByCategory.map((item) => (
                    <MenuItemListSliced key={item.category} item={item} />
                ))}
            </div>
        </>
    );
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
        <div key={item.category} className="flex flex-col mb-6" data-element="menu-item-list-sliced">
            <h3 className="uppercase font-semibold text-3xl tracking-tight">{item.category}</h3>
            <Separator className="my-2" />
            <ul>
                {item.menuItems.map((menuItem) => (
                    <li key={menuItem.id} className="flex flex-col mb-2">

                        <div className="grid grid-cols-6 items-start p-1  hover:bg-muted">
                            <Link to={`/admin/gerenciamento/cardapio/${menuItem?.id}/main`} className="flex flex-col col-span-4">
                                <div className="flex flex-col ">
                                    <span className="font-semibold uppercase mb-0 tracking-wider col-span-4">{menuItem.name}</span>
                                    <div className="flex gap-2 mb-2">
                                        {menuItem.tags?.models.map((tag) => (
                                            <BadgeTag key={tag?.id} tag={tag} allowRemove={false}
                                                classNameLabel="text-[11px] uppercase tracking-wider leading-none"
                                                classNameContainer="py-0 px-1"
                                            />
                                        ))}
                                    </div>
                                    <span className="text-sm">{capitalize(menuItem.ingredients)}</span>
                                </div>
                            </Link>

                            <Form method="post" className="flex justify-between md:justify-end gap-2 w-full items-center  col-span-2">

                                <span className="font-semibold text-sm">Públicar</span>
                                <Switch defaultChecked={menuItem?.visible || false} onCheckedChange={handleVisibility} />
                                <input type="hidden" name="id" value={menuItem?.id} />
                                <button ref={submitBtnRef} className="hidden" type="submit" value={"menu-item-visibility-change"} name="_action" />

                            </Form>


                        </div>



                    </li>
                ))}
            </ul>
        </div>
    )
}