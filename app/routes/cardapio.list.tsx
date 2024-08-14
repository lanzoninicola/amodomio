import { useOutletContext, useSearchParams } from "@remix-run/react";
import { CardapioOutletContext } from "./cardapio-web";
import CardapioItemDialog from "~/domain/cardapio/components/cardapio-item-dialog/cardapio-item-dialog";
import React, { useEffect, useState } from "react";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { cn } from "~/lib/utils";
import CardapioItemActionBar from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";



export default function CardapioList() {
    const [searchParams] = useSearchParams();
    let currentFilterTag = searchParams.get("tag");

    const { items: allItems } = useOutletContext<CardapioOutletContext>();

    const [items, setItems] = useState<MenuItemWithAssociations[]>([]);

    useEffect(() => {
        const itemsFiltered = currentFilterTag
            ? allItems.filter(i => i.tags?.public.some(t => t === currentFilterTag))
            : allItems;
        setItems(itemsFiltered.slice(0, 10));
    }, [currentFilterTag, allItems]);

    return (
        <section>
            <ul className="flex flex-col overflow-y-auto md:overflow-y-z auto snap-mandatory">
                {items.map((item, index) => {
                    if (items.length === index + 1) {
                        return <CardapioItem key={item.id} item={item} />
                    } else {
                        return <CardapioItem key={item.id} item={item} />
                    }
                })}
            </ul>
        </section>
    )
}

interface CardapioItemProps {
    item: MenuItemWithAssociations;
}

const CardapioItem = React.forwardRef(({ item }: CardapioItemProps, ref: any) => {
    const italyProduct = item.tags?.public.some(t => t.toLocaleLowerCase() === "produtos-italianos")

    return (
        <li className="snap-start border-b pb-2" id={item.id} ref={ref}>
            {/* <CardapioItemDialog item={item} triggerComponent={
            <CardapioItemImage item={item} />
        }> */}


            <div className="grid grid-cols-8 min-h-[120px]">

                <div className="bg-center bg-cover bg-no-repeat col-span-2"
                    style={{
                        backgroundImage: `url(${item.imageTransformedURL || "/images/cardapio-web-app/placeholder.png"})`,
                    }}></div>

                <div className="flex flex-col px-2 pt-2 mb-2 col-span-6">
                    <h3 className="font-body-website text-sm font-semibold uppercase">{item.name}</h3>
                    {italyProduct && <ItalyIngredientsStatement />}
                    <p className="font-body-website leading-tight text-sm mb-2">{item.ingredients}</p>
                    <CardapioItemPrice prices={item?.priceVariations} cnTextColor="text-black" />
                </div>
            </div>
            <CardapioItemActionBar item={item} />

            {/* </CardapioItemDialog> */}
        </li>
    )
})

interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["priceVariations"]
    cnTextColor?: string
}

function CardapioItemPrice({ prices, cnTextColor }: CardapioItemPriceProps) {

    const visiblePrices = prices.filter(p => p.showOnCardapio === true) || []
    const lastIndex = visiblePrices.length - 1
    const colsNumber = visiblePrices.length

    return (
        <div className={
            cn(
                "grid gap-x-2",
                isNaN(colsNumber) ? "grid-cols-3" : `grid-cols-${colsNumber}`
            )
        }>
            {
                visiblePrices.map((p, idx) => {

                    return (

                        <div key={p.id} className={
                            cn(
                                "flex items-center gap-2",
                                lastIndex === idx && "order-last",
                                cnTextColor
                            )

                        }>
                            <span className="font-body-website uppercase text-[12px]  text-muted-foreground">{p?.label}</span>
                            <div className="flex items-start gap-[2px] font-body-website font-semibold  text-muted-foreground">
                                <span className="text-[12px]">R$</span>
                                <span className="text-[15px]">{p?.amount}</span>
                            </div>
                        </div>
                    )


                })
            }

        </div>
    )
}