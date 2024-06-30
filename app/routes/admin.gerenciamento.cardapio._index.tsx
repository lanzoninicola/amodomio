import { useActionData, useOutletContext } from "@remix-run/react";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import { AdminCardapioOutletContext } from "./admin.gerenciamento.cardapio";
import { MenuItem, MenuItemPriceVariation, Prisma } from "@prisma/client";
import { LoaderArgs } from "@remix-run/node";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import { toast } from "~/components/ui/use-toast";

import tryit from "~/utils/try-it";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { menuItemPriceVariationsEntity } from "~/domain/cardapio/menu-item-price-variations.prisma.entity.server";



export type MenuItemActionSearchParam = "menu-item-create" | "menu-item-edit" | "menu-item-delete" | "menu-items-sortorder" | null

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })


    if (_action === "menu-item-update") {

        const category = jsonParse(values.category as string)

        const menuItem: Prisma.MenuItemCreateInput = {
            name: values.name as string,
            ingredients: values.ingredients as string,
            description: values?.description as string || "",
            visible: values?.visible === "on" ? true : false,
            imageBase64: values.imageBase64 as string || "",
            basePriceAmount: values?.basePriceAmount ? parseFloat(values.basePriceAmount as string) : 0,
            mogoId: values?.mogoId as string || "",
            createdAt: new Date().toISOString(),
            Category: {
                connect: {
                    id: category.id
                }
            },
        }

        const [err, result] = await prismaIt(menuItemPrismaEntity.update(values.id as string, menuItem))

        if (err) {
            return badRequest(err)
        }

        return ok("Elemento atualizado com successo")
    }

    if (_action === "menu-item-delete") {
        const id = values?.id as string

        const [err, result] = await prismaIt(menuItemPrismaEntity.delete(id))

        if (err) {
            return badRequest(err)
        }

        return ok("Elemento deletado com successo")
    }

    if (_action === "menu-item-price-variation-update") {
        console.log({ values })

        const amount = isNaN(Number(values?.amount)) ? 0 : Number(values?.amount)
        const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)

        const nextPrice: Partial<MenuItemPriceVariation> = {
            id: values.id as string,
            amount,
            discountPercentage,
        }

        const [err, result] = await prismaIt(menuItemPriceVariationsEntity.update(values.id as string, nextPrice))

        if (err) {
            return badRequest(err)
        }

        return ok("Elemento atualizado com successo")
    }

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



    return null
}

export default function AdminCardapio() {
    const outletContext: AdminCardapioOutletContext = useOutletContext()
    const items = outletContext.items as MenuItemWithAssociations[]

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
            {/* <MenuItemListStat items={items} /> */}
            <MenuItemList initialItems={items} />
        </div>

    )
}










