import type { LoaderArgs } from "@remix-run/node";
import { redirect, type V2_MetaFunction } from "@remix-run/node";
import { Link, useActionData, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import type { Category } from "~/domain/category/category.model.server";
import { menuEntity } from "~/domain/menu-item/menu-item.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import trim from "~/utils/trim";
import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/menu-item/menu-item.prisma.entity.server";
import tryit from "~/utils/try-it";
import { MenuItem, Prisma } from "@prisma/client";
import { jsonParse } from "~/utils/json-helper";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        {
            name: "title",
            content: "Cardápio - Gerençiamento",
        }
    ];
};


export async function loader({ request }: LoaderArgs) {
    const categories = await categoryPrismaEntity.findAll()

    const items = await menuItemPrismaEntity.findAll()

    return ok({ categories, items })

}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    console.log({ action: _action, values })

    if (_action === "menu-item-create") {

        const category = jsonParse(values.category as string)

        if (!category?.id) {
            return badRequest("Categoria não seleçionada")
        }

        const menuItem: Prisma.MenuItemCreateInput = {
            name: values.name as string,
            ingredients: values.ingredients as string,
            description: values?.description as string || "",
            visible: values?.visible === "on" ? true : false,
            imageBase64: values.imageBase64 as string || "",
            basePriceAmount: values?.basePriceAmount ? parseFloat(values.basePriceAmount as string) : 0,
            Category: {
                connect: {
                    id: category.id
                }
            },
            createdAt: new Date().toISOString()
        }

        const [err, result] = await tryit(menuItemPrismaEntity.create(menuItem))

        console.log({ err })

        if (err) {
            return badRequest(err)
        }



        return ok("Elemento criado com successo")

    }

    if (_action === "menu-item-edit") {

        const category = jsonParse(values.category as string)

        const menuItem = {
            name: values.name as string,
            ingredients: values.ingredients as string,
            description: values?.description as string || "",
            visible: values.visible === "on" ? true : false,
            imageBase64: values.imageBase64 as string || "",
            Category: {
                connect: {
                    id: category.id
                }
            }
        }

        await menuEntity.update(values.id as string, menuItem)

        return ok("Elemento atualizado com successo")
    }

    if (_action === "menu-item-delete") {
        await menuEntity.delete(values.id as string)
        return redirect(`/admin`)
    }

    // if (_action === "item-sortorder-up") {
    //     await menuEntity.sortUp(values.id as string, values.groupId as string)
    // }

    // if (_action === "item-sortorder-down") {
    //     await menuEntity.sortDown(values.id as string, values.groupId as string)
    // }


    return null
}

export type MenuItemActionSearchParam = "menu-item-create" | "menu-item-edit" | "menu-item-delete" | "menu-items-sortorder" | null

export default function AdminCardapio() {
    const loaderData = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const items = loaderData.payload.items as MenuItemWithAssociations[]
    const categories = loaderData.payload.categories as Category[]

    // const [searchParams, setSearchParams] = useSearchParams()
    // const action = searchParams.get("_action") as MenuItemActionSearchParam

    // const itemId = searchParams.get("id")
    // const itemToEdit = items.find(item => item.id === itemId) as MenuItem

    // const itemsFilteredSorted = sort(items, "sortOrder", "asc")

    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    return (
        <Container className="mb-24">
            <div className="left-0 w-full p-4 bg-muted z-10" >
                <div className="flex items-center justify-between mb-4">
                    <h1 className="font-bold text-xl">Cardapio</h1>
                </div>

                <div className="flex gap-2">
                    <Link to={`?_action=menu-items-sortorder`} className="mr-4">
                        <span className="text-sm underline">Ordenamento</span>
                    </Link>

                </div>
            </div>
            <MenuItemForm action="menu-item-create" className="my-8 border rounded-xl p-4" />
            <Separator className="my-6" />
            <div className="flex flex-col gap-4">
                {/* <MenuItemListStat items={items} /> */}
                <MenuItemList items={items} />
            </div>

        </Container>
    )
}










