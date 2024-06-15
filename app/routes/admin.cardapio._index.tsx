import type { LoaderArgs } from "@remix-run/node";
import { redirect, type V2_MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { AlertCircle, Edit, Trash } from "lucide-react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { categoryEntity } from "~/domain/category/category.entity.server";
import type { Category } from "~/domain/category/category.model.server";
import type { MenuItem } from "~/domain/menu-item/menu-item.model.server";
import { menuEntity } from "~/domain/menu-item/menu-item.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items";
import sort from "~/utils/sort";
import { urlAt } from "~/utils/url";
import { Separator } from "~/components/ui/separator";
import { CategoriesTabs } from "~/domain/category/components";
import trim from "~/utils/trim";
import { Badge } from "~/components/ui/badge";
import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import MenuItemListStat from "~/domain/cardapio/components/menu-item-list-stats/menu-item-list-stats";

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "robots",
            content: "noindex",
        },
        {
            name: "title",
            content: "Administração do cardápio",
        }
    ];
};

type MenuWithCreateDate = MenuItem & { createdAt: string }

export async function loader({ request }: LoaderArgs) {
    const categories = await categoryEntity.findAll()

    const url = new URL(request.url)
    const tab = url.searchParams.get('tab')
    const lastUrlSlug = urlAt(request.url, -1)

    if (!tab && lastUrlSlug === "admin") {
        return redirect(`/admin`)
    }

    const items = await menuEntity.findAll() as MenuWithCreateDate[]

    // order by created at
    const sortedItems = sort(items, "createdAt", "desc")

    return ok({
        items: sortedItems,
        categories
    })
}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-create") {
        const menuItem: MenuItem = {}

        const itemCreated = await menuEntity.create(menuItem)

        return redirect(`/admin?_action=menu-item-edit&id=${itemCreated.id}`)
    }

    if (_action === "menu-item-edit") {

        const name = values.name as string
        const ingredients = values.ingredients as string
        const ingredientsIta = values.ingredientsIta as string
        // const description = values.description as string
        const price = values.price as string
        const categoryId = values.categoryId as string

        if (!categoryId) {
            badRequest("Categoria é obrigatória")
        }



        const menuItem: MenuItem = {
            id: values.id as string,
            category: {
                id: categoryId
            },
            visible: values.visible === "on" ? true : false,
            sortOrder: 9999

        }

        if (name !== "") {
            menuItem.name = name
        }

        if (ingredients !== "") {
            menuItem.ingredients = ingredients.split(",").map(i => trim(i))
        }

        if (ingredientsIta !== "") {
            menuItem.ingredientsIta = ingredientsIta.split(",").map(i => trim(i))
        }

        if (price !== "") {
            menuItem.price = price
        }

        // if (description !== "") {
        //     menuItem.description = description
        // }

        await menuEntity.update(values.id as string, menuItem)
        return redirect(`/admin`)
    }

    if (_action === "menu-item-delete") {
        await menuEntity.delete(values.id as string)
        return redirect(`/admin`)
    }

    if (_action === "item-sortorder-up") {
        await menuEntity.sortUp(values.id as string, values.groupId as string)
    }

    if (_action === "item-sortorder-down") {
        await menuEntity.sortDown(values.id as string, values.groupId as string)
    }


    return null
}

export type MenuItemActionSearchParam = "menu-item-create" | "menu-item-edit" | "menu-item-delete" | "menu-items-sortorder" | null

export default function AdminCardapio() {
    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData.payload.items as MenuItem[]
    const categories = loaderData.payload.categories as Category[]

    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action") as MenuItemActionSearchParam

    const itemId = searchParams.get("id")
    const itemToEdit = items.find(item => item.id === itemId) as MenuItem

    const itemsFilteredSorted = sort(items, "sortOrder", "asc")


    return (
        <Container>
            <div className="left-0  w-full p-4 bg-muted z-10" >
                <div className="flex items-center justify-between mb-4">
                    <h1 className="font-bold text-xl">Cardapio</h1>
                    {(action !== "menu-item-edit") &&
                        (
                            <Form method="post">
                                <SubmitButton actionName="menu-item-create" className="w-max" idleText="Criar item" loadingText="Criando..."
                                    disabled={action === "menu-item-create"}
                                />
                            </Form>
                        )
                    }
                </div>

                <div className="flex gap-2">
                    <Link to={`?_action=menu-items-sortorder`} className="mr-4">
                        <span className="text-sm underline">Ordenamento</span>
                    </Link>
                    {action === "menu-items-sortorder" && (
                        <Link to="/admin" className="mr-4">
                            <span className="text-sm underline">Fechar Ordenamento</span>
                        </Link>
                    )}
                </div>
                <MenuItemForm item={itemToEdit} action={action} />
            </div>
            <div className="mt-6 min-w-[350px]">
                <div className="flex flex-col gap-4">
                    <MenuItemListStat items={itemsFilteredSorted} />
                    <MenuItemList items={itemsFilteredSorted} action={action} />
                </div>
            </div>

        </Container>
    )
}










