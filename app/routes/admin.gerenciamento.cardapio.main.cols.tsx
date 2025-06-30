
import { MenuItem, Category } from "@prisma/client"
import { LoaderFunctionArgs } from "@remix-run/node"
import { Await, Link, defer, useActionData, useLoaderData } from "@remix-run/react"
import React, { Suspense, useState } from "react"
import { toast } from "~/components/ui/use-toast"
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server"
import BadgeTag from "~/domain/tags/components/badge-tag"
import { prismaIt } from "~/lib/prisma/prisma-it.server"
import capitalize from "~/utils/capitalize"
import { badRequest, ok } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"
import { Separator } from "~/components/ui/separator"
import Loading from "~/components/loading/loading"
import { cn } from "~/lib/utils"
import { Input } from "~/components/ui/input"
import MenuItemSwitchVisibilitySubmit from "~/domain/cardapio/components/menu-item-switch-visibility/menu-item-switch-visibility-submit"
import { menuItemPriceVariationsEntity } from "~/domain/cardapio/menu-item-price-variations.prisma.entity.server"
import { Menu } from "lucide-react"
import MenuItemSwitchActivationSubmit from "~/domain/cardapio/components/menu-item-switch-activation.tsx/menu-item-switch-activation-submit"
import OptionTab from "~/components/layout/option-tab/option-tab"


export type MenuItemActionSearchParam = "menu-item-create" | "menu-item-edit" | "menu-item-delete" | "menu-items-sortorder" | null

export async function loader({ request }: LoaderFunctionArgs) {



    // https://github.com/remix-run/remix/discussions/6149

    // const categories = categoryPrismaEntity.findAll()
    const listGroupedByCategory = menuItemPrismaEntity.findAllGroupedByCategory({
        option: {
            sorted: true,
            direction: "asc"
        }
    }, {
        imageTransform: true,
        imageScaleWidth: 64,
    })
    // const tags = menuItemTagPrismaEntity.findAll()
    // const sizeVariations = prismaClient.menuItemSize.findMany()

    // const data = Promise.all([categories, listGroupedByCategory, tags, sizeVariations]);
    const data = Promise.all([listGroupedByCategory]);

    return defer({ data });
}


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

    if (_action === "menu-item-activation-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            active: !item.active
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.active === true ? `Sabor "${item.name}" ativado` : `Sabor "${item.name}" inativado`;

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

export default function AdminGerenciamentoCardapioMainColsLayout() {
    const {
        data,
    } = useLoaderData<typeof loader>();

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

        <Suspense fallback={
            <div className="flex justify-center items-center h-[150px]">
                <Loading color="black" />
            </div>
        }>
            <Await resolve={data}>
                {([listGroupedByCategory]) => {

                    const [itemsGroupedFound, setItemsGroupedFound] = useState(listGroupedByCategory || [])


                    const [optVisibleItems, setOptVisibleItems] = useState<boolean | null>(true)
                    const [optActiveItems, setOptActiveItems] = useState<boolean | null>(null)

                    const handleOptionVisibileItems = (state: boolean) => {
                        setOptVisibleItems(state)
                        setOptActiveItems(null)
                        setItemsGroupedFound(itemsGroupedFound.filter(item => item.menuItems.some(menuItem => menuItem.visible === state && menuItem.active === true)))
                    }
                    const handleOptionActiveItems = (state: boolean) => {
                        setOptActiveItems(state)
                        setOptVisibleItems(null)
                        setItemsGroupedFound(itemsGroupedFound.filter(item => item.menuItems.some(menuItem => menuItem.active === state)))
                    }

                    return (
                        <>
                            <div className="flex flex-col">
                                {/* @ts-ignore */}
                                <SearchItem allItemsGrouped={listGroupedByCategory} itemsGroupedFound={itemsGroupedFound} setItemsGroupedFound={setItemsGroupedFound} />

                                {/* <Separator className="my-4" />

                                <div className="flex gap-4 items-center justify-center">
                                    <OptionTab label="Venda ativa" onClickFn={() => handleOptionVisibileItems(true)} state={true} highlightCondition={optVisibleItems === true && optActiveItems === null} />
                                    <span>-</span>
                                    <OptionTab label="Venda pausada" onClickFn={() => handleOptionVisibileItems(false)} state={false} highlightCondition={optVisibleItems === false && optActiveItems === null} />
                                    <span>-</span>
                                    <OptionTab label="Inativos" onClickFn={() => handleOptionActiveItems(false)} state={false} highlightCondition={optActiveItems === false && optVisibleItems === null} />

                                </div> */}

                                <Separator className="my-4" />

                                {/* Desktop com multi-colunas */}
                                <div className="hidden md:columns-2 md:gap-6 md:block" >
                                    {
                                        itemsGroupedFound.map((categoryItems) => (


                                            <div className="break-inside-avoid mb-6">
                                                {/* @ts-ignore */}
                                                <MenuItemListSliced categoryItems={categoryItems} />
                                            </div>

                                        ))
                                    }
                                </div>
                            </div>


                            {/* Mobile */}
                            <div className="flex flex-col md:hidden">
                                {itemsGroupedFound.map((categoryItems) => (


                                    <div key={categoryItems.category} className="flex flex-col gap-4">
                                        {/* <SearchItem menuItems={item.menuItems} /> */}
                                        {/* @ts-ignore */}
                                        <MenuItemListSliced categoryItems={categoryItems} />
                                    </div>
                                ))}
                            </div>
                        </>
                    )
                }}

            </Await >
        </Suspense>
    )



}

interface SearchItemProps {
    allItemsGrouped: { category: Category["name"], menuItems: MenuItemWithAssociations[] }[],
    itemsGroupedFound: { category: Category["name"], menuItems: MenuItemWithAssociations[] }[],
    setItemsGroupedFound: React.Dispatch<React.SetStateAction<{ category: Category["name"], menuItems: MenuItemWithAssociations[] }[]>>
}

function SearchItem({ allItemsGrouped, itemsGroupedFound, setItemsGroupedFound }: SearchItemProps) {
    const [search, setSearch] = useState("")

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setSearch(value);

        if (!value || value === "") {
            return setItemsGroupedFound(allItemsGrouped);
        }


        const searchedGroupedItems = allItemsGrouped
            .map((group: { category: Category["name"], menuItems: MenuItemWithAssociations[] }) => {
                const filteredItems = group.menuItems.filter(item => {
                    const tags = item?.tags?.public || [];

                    return (
                        item.name?.toLowerCase().includes(value.toLowerCase()) ||
                        item.ingredients?.toLowerCase().includes(value.toLowerCase()) ||
                        item.description?.toLowerCase().includes(value.toLowerCase()) ||
                        tags.some(t => t?.toLowerCase().includes(value.toLowerCase()))
                    );
                });

                return {
                    ...group,
                    menuItems: filteredItems
                };
            })
            .filter(group => group.menuItems.length > 0); // Remove categorias vazias


        setItemsGroupedFound(searchedGroupedItems);
    };

    const getTotalItems = (groups: typeof allItemsGrouped) =>
        groups.reduce((total, group) => total + group.menuItems.length, 0);


    return (
        <div className="flex flex-col gap-2">
            <Input name="search" className="w-full py-4 text-lg" placeholder="Pesquisar no cardapio..."
                onChange={(e) => handleSearch(e)}
                value={search} />
            {
                search && search !== "" && (
                    <div className="text-[14px] text-muted-foreground">
                        {getTotalItems(itemsGroupedFound)} itens encontrados
                    </div>
                )
            }

        </div>
    )
}

interface MenuItemListSlicedProps {
    categoryItems: { category: Category["name"], menuItems: MenuItemWithAssociations[] }
    loggedUser: string
}

function MenuItemListSliced({ categoryItems, loggedUser }: MenuItemListSlicedProps) {

    const [visible, setVisible] = React.useState(false)
    const [active, setActive] = React.useState(false)

    return (


        <div className="flex flex-col mb-6" data-element="menu-item-list-sliced">
            <h3 className="uppercase font-semibold text-3xl tracking-tight">{categoryItems.category}</h3>
            <Separator className="my-2" />
            <ul>
                {categoryItems.menuItems.map((menuItem) => (
                    <li key={menuItem.id} className={
                        cn(
                            "flex flex-col mb-2",
                            menuItem.visible === false && "opacity-40",
                            menuItem.active === false && "opacity-40",
                        )
                    }>

                        <div className="grid grid-cols-8 items-start p-1  hover:bg-muted">
                            <Link to={`/admin/gerenciamento/cardapio/${menuItem?.id}/main`} className="flex flex-col col-span-4">
                                <div className="flex flex-col ">
                                    <span className="font-semibold uppercase mb-0 tracking-wider col-span-4">{menuItem.name}</span>
                                    <div className="flex gap-2 mb-2">
                                        {menuItem.tags?.models.map((tag) => (
                                            <BadgeTag key={tag?.id} tag={tag} tagColor={false} allowRemove={false}
                                                classNameLabel="text-[9px] uppercase tracking-wider leading-none"
                                                classNameContainer="px-1 bg-muted"
                                            />
                                        ))}
                                    </div>
                                    <span className="text-sm">{capitalize(menuItem.ingredients)}</span>
                                </div>
                            </Link>

                            <div className="flex gap-4 col-span-4">
                                <MenuItemSwitchVisibilitySubmit menuItem={menuItem} visible={visible} setVisible={setVisible} />
                                <MenuItemSwitchActivationSubmit menuItem={menuItem} active={active} setActive={setActive} />
                            </div>


                        </div>



                    </li>
                ))}
            </ul>
        </div>

    )
}