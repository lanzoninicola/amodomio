import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, defer, useLoaderData, useSearchParams } from "@remix-run/react";
import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { menuItemLikePrismaEntity } from "~/domain/cardapio/menu-item-like.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { menuItemSharePrismaEntity } from "~/domain/cardapio/menu-item-share.prisma.entity.server";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";
import CardapioItemActionBar from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import Loading from "~/components/loading/loading";
import FiltersTags from "~/domain/cardapio/components/filter-tags/filter-tags";
import { cn } from "~/lib/utils";
import capitalize from "~/utils/capitalize";

export const headers: HeadersFunction = () => ({
    'Cache-Control': 's-maxage=1, stale-while-revalidate=59',
});

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

export async function action({ request }: LoaderFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (values?.action === "menu-item-like-it") {
        const itemId = values?.itemId as string
        let amount = 0

        amount = isNaN(Number(values?.likesAmount)) ? 1 : Number(values?.likesAmount)

        const [err, likeAmount] = await prismaIt(menuItemLikePrismaEntity.create({
            createdAt: new Date().toISOString(),
            amount,
            MenuItem: {
                connect: {
                    id: itemId,
                },
            }
        }));

        if (err) {
            return badRequest({
                action: "menu-item-like-it",
                likeAmount
            })
        }

        return ok({
            action: "menu-item-like-it",
            likeAmount
        })

    }

    if (values?.action === "menu-item-share-it") {
        const itemId = values?.itemId as string

        const [err, likeAmount] = await prismaIt(menuItemSharePrismaEntity.create({
            createdAt: new Date().toISOString(),
            MenuItem: {
                connect: {
                    id: itemId,
                },
            }
        }));

        if (err) {
            return badRequest({
                action: "menu-item-share-it",
                likeAmount
            })
        }

        return ok({
            action: "menu-item-share-it",
            likeAmount
        })

    }

    return null
}

export default function CardapioWebIndex() {
    const { items, tags } = useLoaderData<typeof loader>()

    return (
        <section>

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
    const currentFilterTag = searchParams.get("tag");

    const [items, setItems] = useState<MenuItemWithAssociations[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Clear previous timeout if it exists
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
        }

        // Set loading to true and simulate a 300ms delay
        setIsLoading(true);

        loadingTimeoutRef.current = setTimeout(() => {
            const itemsFiltered = currentFilterTag
                ? allItems.filter(i => i.tags?.public.some(t => t === currentFilterTag))
                : allItems;

            setItems(itemsFiltered.slice(0, 10));
            setHasMore(itemsFiltered.length > 10);
            setIsLoading(false); // Stop loading after data is set
        }, 300);

        // Cleanup timeout on unmount or filter change
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, [currentFilterTag, allItems]);

    const observer = useRef<IntersectionObserver | null>(null);

    const lastItemRef = useCallback(
        (node: HTMLLIElement) => {
            if (observer.current) observer.current.disconnect();

            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setItems((prevItems) => {
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
        },
        [hasMore, allItems, currentFilterTag]
    );

    if (isLoading) {
        return (
            <div className="my-8">
                <Loading />
            </div>
        )
    }

    return (
        <section>
            <ul className="flex flex-col overflow-y-auto md:overflow-y-auto snap-mandatory mt-4 md:grid md:grid-cols-2 md:gap-x-4">
                {items.map((item, index) => {
                    const isLastItem = items.length === index + 1;
                    return (
                        <CardapioItem
                            ref={isLastItem ? lastItemRef : null}
                            key={item.id}
                            item={item}
                        />
                    );
                })}
            </ul>
        </section>
    );
}

interface CardapioItemProps {
    item: MenuItemWithAssociations;
}

const CardapioItem = React.forwardRef(({ item }: CardapioItemProps, ref: any) => {
    const italyProduct = item.tags?.public.some(t => t.toLocaleLowerCase() === "produtos-italianos")

    return (
        <li className="snap-start border-b py-2" id={item.id} ref={ref}>
            {/* <CardapioItemDialog item={item} triggerComponent={
            <CardapioItemImage item={item} />
        }> */}


            <div className="grid grid-cols-8 min-h-[120px] mx-4 gap-x-4">
                <div className={
                    cn(
                        "flex flex-col mb-2",
                        item.imageTransformedURL && " col-span-5",
                        !item.imageTransformedURL && " col-span-8"
                    )
                }>
                    <h3 className="font-body-website text-xl tracking-wider font-semibold uppercase mb-1">{item.name}</h3>
                    {italyProduct && <ItalyIngredientsStatement />}
                    <p className="leading-tighter text-[15px] mb-2">{capitalize(item.ingredients)}</p>
                    <CardapioItemPrice prices={item?.priceVariations} cnLabel="text-black" />
                    <CardapioItemActionBar item={item} />
                </div>
                {
                    item.imageTransformedURL &&
                    (<div className="bg-center bg-cover bg-no-repeat col-span-3 rounded-lg h-[112px]"
                        style={{
                            backgroundImage: `url(${item.imageTransformedURL})`,
                        }}>

                    </div>)
                }

            </div>


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
                            <span className="uppercase text-[12px]  text-muted-foreground">{p?.label}</span>
                            <div className="flex items-center gap-[2px] text-muted-foreground">
                                <span className="text-[14px]">R$</span>
                                <span className="text-[14px]">{p?.amount}</span>
                            </div>
                        </div>
                    )


                })
            }

        </div>
    )
}











