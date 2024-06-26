import { useActionData, useOutletContext } from "@remix-run/react";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/menu-item/menu-item.prisma.entity.server";
import { AdminCardapioOutletContext } from "./admin.gerenciamento.cardapio";
import { MenuItemPriceVariation, Prisma } from "@prisma/client";
import { LoaderArgs } from "@remix-run/node";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import { toast } from "~/components/ui/use-toast";
import { MenuItemPriceVariationPrismaEntity, menuItemPriceVariationsEntity } from "~/domain/menu-item/menu-item-price-variations.prisma.entity.server";



export type MenuItemActionSearchParam = "menu-item-create" | "menu-item-edit" | "menu-item-delete" | "menu-items-sortorder" | null

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    console.log({ action: _action, values })


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

        console.log({ err })

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

    // if (_action === "item-sortorder-up") {
    //     await menuEntity.sortUp(values.id as string, values.groupId as string)
    // }

    // if (_action === "item-sortorder-down") {
    //     await menuEntity.sortDown(values.id as string, values.groupId as string)
    // }


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


    // const [searchParams, setSearchParams] = useSearchParams()
    // const action = searchParams.get("_action") as MenuItemActionSearchParam

    // const itemId = searchParams.get("id")
    // const itemToEdit = items.find(item => item.id === itemId) as MenuItem

    // const itemsFilteredSorted = sort(items, "sortOrder", "asc")



    return (

        <div className="flex flex-col gap-4 ">
            {/* <MenuItemListStat items={items} /> */}
            <MenuItemList items={items} />
        </div>

    )
}










