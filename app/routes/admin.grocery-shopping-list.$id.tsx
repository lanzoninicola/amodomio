import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Form, Link, Outlet, useActionData, useLoaderData, useLocation } from "@remix-run/react";
import { ChevronRight, Globe, PlusSquareIcon, SaveIcon } from "lucide-react";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import items from "~/domain/cardapio/db-mock/items";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import GroceryItem from "~/domain/grocery-list/components/grocery-item";
import { groceryListEntity } from "~/domain/grocery-list/grocery-list.entity.server";
import { GroceryList, GroceryListItem } from "~/domain/grocery-list/grocery-list.model.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import getSearchParam from "~/utils/get-search-param";
import { ok, serverError } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import tryit from "~/utils/try-it";
import { lastUrlSegment } from "~/utils/url";


export async function loader({ request, params }: LoaderFunctionArgs) {

    const listId = params?.id

    if (!listId) {
        return redirect("/admin/grocery-shopping-list")
    }

    const purchasable = getSearchParam({ request, paramName: 'purchasable' })

    const [err, groceryListWithItems] = await prismaIt(prismaClient.groceryList.findFirst({
        where: {
            id: listId
        },
        include: {
            GroceryListItem: true
        }
    }))


    if (err) {
        return serverError(err)
    }

    if (purchasable === "true") {
        return ok({
            groceryListWithItems: {
                ...groceryListWithItems,
                items: groceryListWithItems?.GroceryListItem.filter(i => i.quantity > 0)
            }
        })
    }

    return ok({ groceryListWithItems })

}


export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "start-purchase") {

        const [err, groceryListWithItems] = await tryit(groceryListEntity.startPurchase(values.listId as string))

        if (err) {
            return serverError(err)
        }

        return redirect(`/purchasing?id=${values.listId}`)
    }

    if (_action === "item-update") {
        const listId = values.listId as string
        const item = values.item as unknown as GroceryListItem

        const [err, groceryListWithItems] = await tryit(groceryListEntity.updateItem(listId, item.id!, item))

        if (err) {
            return serverError(err)
        }

        return ok("Produto adicionado na lista")
    }

    if (_action === "item-delete") {
        const listId = values.listId as string
        const itemId = values.itemId as unknown as GroceryListItem["id"] as string

        console.log({ listId, itemId })

        const [err, groceryListWithItems] = await tryit(groceryListEntity.removeItem(listId, itemId))

        if (err) {
            return serverError(err)
        }

        return ok("Produto removido da lista")
    }

    return null
}


export default function SingleGroceryList() {
    const loaderData = useLoaderData<typeof loader>()
    const groceryListWithItems = loaderData?.payload.groceryListWithItems as GroceryList

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status >= 400) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    if (status == 200) {
        toast({
            title: "Ok",
            description: message,
        })
    }

    const location = useLocation()

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col mt-2">
                <Form method="post">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold tracking-tight mb-2">{groceryListWithItems.name}</h3>
                        <div className="grid grid-cols-2">
                            <MenuItemNavLink to={`/admin/grocery-shopping-list/${groceryListWithItems.id}`} isActive={location.search === ""}>Todos</MenuItemNavLink>
                            <MenuItemNavLink to={`/admin/grocery-shopping-list/${groceryListWithItems.id}?purchasable=true`} isActive={location.search !== ""}>A Comprar</MenuItemNavLink>

                        </div>
                        <ul>
                            {
                                groceryListWithItems?.items && groceryListWithItems.items.map((item) => (
                                    <li key={item}>
                                        <span>item</span>
                                    </li>
                                ))
                            }
                        </ul>

                    </div>
                </Form>
            </div>
        </div>
    )
}

type GroceryItemsListProps = {
    listId: GroceryList["id"];
    items: GroceryListItem[]
}

export function GroceryItemsList({ listId, items }: GroceryItemsListProps) {

    const [itemsPurchasable, setItemsPurchasable] = useState(items || [])

    const increaseQuantity = (item: GroceryListItem) => {

        const nextItemsPurchasable = [
            ...itemsPurchasable.filter(i => i.id !== item.id),
            { ...item, quantity: item.quantity + 1 }
        ]

        setItemsPurchasable(nextItemsPurchasable)
    }


    const decreaseQuantity = (item: GroceryListItem) => {

        const nextItemsPurchasable = [
            ...itemsPurchasable.filter(i => i.id !== item.id),
            { ...item, quantity: item.quantity - 1 }
        ]

        setItemsPurchasable(nextItemsPurchasable)
    }

    const removeItem = (item: GroceryListItem) => {
        setItemsPurchasable(itemsPurchasable.filter(i => i.id !== item.id))
    }

    console.log({ itemsPurchasable })


    return (
        <ul className="flex flex-col gap-4">
            {itemsPurchasable?.map((i, idx) => {
                return (
                    <li key={i.id}>
                        <GroceryItem listId={listId} item={i}
                            increaseItemQuantity={increaseQuantity}
                            decreaseItemQuantity={decreaseQuantity}
                            removeItem={removeItem} />
                    </li>
                )
            })}
        </ul>
    )
}

interface ActionBarProps {
    float?: boolean
}

export function ActionBar({ float = false }: ActionBarProps) {

    return (
        <div className="flex gap-2">
            <Button variant={"outline"} className={
                cn(
                    float === false && "w-full md:w-max font-semibold border-slate-500 text-slate-500"
                )
            }
                type="submit"
                name="_action"
                value="start-purchase"
            >

                <div className="flex gap-2 items-center">
                    <span>Iniciar Compra</span>
                    <ChevronRight size={16} />
                </div>
            </Button>
            {/* <Button className="w-full md:w-max font-semibold bg-brand-green shadow-sm"
                                type="submit"
                                name="_action"
                                value="list-save"
                            >
                                <div className="flex gap-2 items-center">
                                    <span>Salvar</span>
                                    <SaveIcon size={16} />
                                </div>
                            </Button> */}
        </div>
    )
}