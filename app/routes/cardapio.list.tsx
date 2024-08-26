import { Await, Link, defer, useLoaderData, useLocation, useSearchParams } from "@remix-run/react";
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { cn } from "~/lib/utils";
import CardapioItemActionBar from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";
import { LayoutTemplate, LayoutList } from "lucide-react";
import Loading from "~/components/loading/loading";
import { LoaderFunctionArgs } from "@remix-run/node";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import { Badge } from "~/components/ui/badge";
import BadgeTag from "~/domain/tags/components/badge-tag";
import FiltersTags from "~/domain/cardapio/components/filter-tags/filter-tags";
import CardapioTabs from "~/domain/cardapio/components/cardapio-tabs/cardapio-tabs";

export async function loader({ request }: LoaderFunctionArgs) {
    const env = process.env?.NODE_ENV
    // const tagParam = getSearchParam({ request, paramName: 'tag' })

    //@ts-ignore
    const items = menuItemPrismaEntity.findAll({
        where: {
            visible: true,
            // tags: {
            //     some: {
            //         Tag: {
            //             name: tagParam || undefined
            //         }
            //     }
            // }
        },
        option: {
            sorted: true,
            direction: "asc"
        },
        // mock: env === "development"
    }, {
        imageTransform: true,
        imageScaleWidth: 375
    })




    const tags = tagPrismaEntity.findAll({
        public: true
    })

    return defer({
        items,
        tags
    })


}

export default function CardapioList() {
    const { items, tags } = useLoaderData<typeof loader>()

    return (
        <section>
            <CardapioTabs />
            <div className="flex flex-col">
                {/* <Loading /> */}
                <Suspense fallback={<Loading />}>

                    <Await resolve={tags}>
                        {(tags) => {
                            // @ts-ignore
                            return <FiltersTags tags={tags ?? []} />
                        }}
                    </Await>
                </Suspense>
                <Suspense fallback={<Loading />}>
                    <Await resolve={items}>

                        {(items) => {
                            // @ts-ignore
                            return <CardapioItemList allItems={items ?? []} />
                        }}
                    </Await>

                </Suspense>
            </div>
        </section >


    );
}

const CardapioItemList = ({ allItems }: { allItems: MenuItemWithAssociations[] }) => {
    const [searchParams] = useSearchParams();
    let currentFilterTag = searchParams.get("tag");


    const [items, setItems] = useState<MenuItemWithAssociations[]>([]);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        const itemsFiltered = currentFilterTag
            ? allItems.filter(i => i.tags?.public.some(t => t === currentFilterTag))
            : allItems;
        setItems(itemsFiltered.slice(0, 10));
    }, [currentFilterTag, allItems]);

    const observer = useRef<IntersectionObserver | null>(null);

    const lastItemRef = useCallback((node: HTMLLIElement) => {
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setItems(prevItems => {
                    const itemsFiltered = currentFilterTag
                        ? allItems.filter(i => i.tags?.public.some(t => t === currentFilterTag))
                        : allItems;
                    const newItems = itemsFiltered.slice(prevItems.length, prevItems.length + 10);
                    setHasMore(newItems.length > 0);
                    return [...prevItems, ...newItems];
                });
            }
        });
        if (node) observer.current.observe(node);
    }, [hasMore, allItems, currentFilterTag]);



    return (
        <section>
            <ul className="flex flex-col overflow-y-auto md:overflow-y-z auto snap-mandatory mt-4">
                {items.map((item, index) => {
                    if (items.length === index + 1) {
                        return <CardapioItem ref={lastItemRef} key={item.id} item={item} />
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
                    <CardapioItemPrice prices={item?.priceVariations} cnLabel="text-black" />
                </div>
            </div>
            <CardapioItemActionBar item={item} />

            {/* </CardapioItemDialog> */}
        </li>
    )
})

interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["priceVariations"]
    cnLabel?: string
}

function CardapioItemPrice({ prices, cnLabel }: CardapioItemPriceProps) {

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
                                cnLabel
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

