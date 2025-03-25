import { Await, useLoaderData, useOutletContext } from "@remix-run/react"
import { MenuItemWithCostVariations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { defer } from "react-router";
import prismaClient from "~/lib/prisma/client.server";
import { Input } from "~/components/ui/input";
import { Suspense } from "react";


export const loader = async () => {

    const menuItemsWithCostVariations = await menuItemPrismaEntity.findAllCostVariations()
    const sizes = prismaClient.menuItemSize.findMany()



    const data = Promise.all([menuItemsWithCostVariations, sizes]);

    return defer({ data });
}

export default function AdminGerenciamentoCardapioCostManagement() {
    const { data } = useLoaderData<typeof loader>()



    return (

        <Suspense fallback={<span>Carregando...</span>}>
            <Await resolve={data}>
                {/* @ts-ignore */}
                {([menuItemsWithCostVariations, sizes]) => {

                    return (
                        <div>
                            <ul className="grid grid-cols-5 gap-x-4 mb-4">
                                <li>
                                    <span>Sabor</span>
                                </li>

                                {
                                    sizes.map(s => {

                                        return (
                                            <li key={s.id} >
                                                <span>{s.name}</span>
                                            </li>
                                        )
                                    })
                                }
                            </ul>
                            <div className="h-[500px] overflow-y-scroll">
                                <ul>
                                    {
                                        menuItemsWithCostVariations.map((menuItem: MenuItemWithCostVariations) => {

                                            return (
                                                <li key={menuItem.id} className="grid grid-cols-5 gap-x-4 items-start">
                                                    <div className="flex flex-col gap-0">
                                                        <span>{menuItem.name}</span>
                                                        <span className="text-xs text-muted-foreground">{menuItem.ingredients}</span>
                                                    </div>
                                                    {/* {
                                                    menuItem.costVariations.map(cv => {
                                                        return (
                                                            <div className="flex">
                                                                <Input defaultValue={cv.costBase} />
                                                                <Input defaultValue={cv.recipeCostAmount} />
                                                            </div>
                                                        )
                                                    })

                                                } */}

                                                    <div className="flex gap-1">
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[0].id)?.costBase} />
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[0].id)?.recipeCostAmount} />
                                                    </div>

                                                    <div className="flex  gap-1">
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[1].id)?.costBase} />
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[1].id)?.recipeCostAmount} />
                                                    </div>

                                                    <div className="flex  gap-1">
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[2].id)?.costBase} />
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[2].id)?.recipeCostAmount} />
                                                    </div>


                                                    <div className="flex  gap-1">
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[3].id)?.costBase} />
                                                        <Input defaultValue={menuItem.costVariations.find(cv => cv.sizeId === sizes[3].id)?.recipeCostAmount} />
                                                    </div>


                                                </li>
                                            )
                                        })
                                    }
                                </ul>
                            </div>
                        </div>
                    )

                }}
            </Await>
        </Suspense>



    )
}