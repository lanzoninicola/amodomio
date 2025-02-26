import { LoaderFunctionArgs, } from "@remix-run/node";
import { Await, useLoaderData, defer } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { Input } from "~/components/ui/input";
import { MenuItemWithSellPriceVariations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import ExportCsvButton from "~/domain/export-csv/components/export-csv-button/export-csv-button";
import prismaClient from "~/lib/prisma/client.server";



export async function loader({ request }: LoaderFunctionArgs) {

    const menuItemsWithSellPriceVariations = menuItemPrismaEntity.findAllPriceVariations()

    const sizes = prismaClient.menuItemSize.findMany()



    const data = Promise.all([menuItemsWithSellPriceVariations, sizes]);

    return defer({
        data
    })
}

export default function AdminGerenciamentoCardapioSellPriceManagement() {
    const { data } = useLoaderData<typeof loader>()

    return (
        <div className="flex flex-col gap-4">

            <ExportCsvButton context="menu-items-price-variations">
                Exportar atual preços de venda
            </ExportCsvButton>

            <Suspense fallback={<Loading />}>
                <Await resolve={data}>
                    {/* @ts-ignore */}
                    {([menuItemsWithSellPriceVariations, sizes]) => {


                        return (
                            <div>
                                <ul className="grid grid-cols-6 gap-x-4 mb-4">
                                    <li>
                                        <span className="font-semibold text-sm">Sabor</span>
                                    </li>

                                    {
                                        sizes.map(s => {

                                            return (
                                                <li key={s.id} >
                                                    <span className="font-semibold text-sm">{s.name}</span>
                                                </li>
                                            )
                                        })
                                    }
                                </ul>
                                <div className="h-[500px] overflow-y-scroll">
                                    <ul>
                                        {
                                            menuItemsWithSellPriceVariations.map((menuItem: MenuItemWithSellPriceVariations) => {

                                                return (
                                                    <li key={menuItem.id} className="grid grid-cols-6 gap-x-4 items-center mb-1">
                                                        <div className="flex flex-col gap-0">
                                                            <span className="text-sm">{menuItem.name}</span>
                                                            {/* <span className="text-[10px] text-muted-foreground">{menuItem.ingredients}</span> */}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[0].id)?.latestAmount} />
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[0].id)?.discountPercentage} />
                                                        </div>

                                                        <div className="flex  gap-1">
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[1].id)?.latestAmount} />
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[1].id)?.discountPercentage} />
                                                        </div>

                                                        <div className="flex  gap-1">
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[2].id)?.latestAmount} />
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[2].id)?.discountPercentage} />
                                                        </div>


                                                        <div className="flex  gap-1">
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[3].id)?.latestAmount} />
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[3].id)?.discountPercentage} />
                                                        </div>

                                                        <div className="flex  gap-1">
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[4].id)?.latestAmount} />
                                                            <Input defaultValue={menuItem.priceVariations.find(cv => cv.sizeId === sizes[4].id)?.discountPercentage} />
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


        </div>
    )
}