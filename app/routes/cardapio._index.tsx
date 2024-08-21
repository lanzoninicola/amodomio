import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, defer, useLoaderData, useLocation, useSearchParams } from "@remix-run/react";
import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { menuItemLikePrismaEntity } from "~/domain/cardapio/menu-item-like.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { menuItemSharePrismaEntity } from "~/domain/cardapio/menu-item-share.prisma.entity.server";
import CardapioItemDialog from "~/domain/cardapio/components/cardapio-item-dialog/cardapio-item-dialog";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";
import CardapioItemActionBar from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import CardapioItemImage from "~/domain/cardapio/components/cardapio-item-image/cardapio-item-image";
import CardapioItemPrice from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import { jsonParse } from "~/utils/json-helper";
import { Tag } from "@prisma/client";
import Badge from "~/components/primitives/badge/badge";
import BadgeTag from "~/domain/tags/components/badge-tag";
import { cn } from "~/lib/utils";
import { Filter } from "lucide-react";
import { LayoutTemplate } from "lucide-react";
import { LayoutList } from "lucide-react";
import Loading from "~/components/loading/loading";
import FiltersTags from "~/domain/cardapio/components/filter-tags/filter-tags";

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
    const location = useLocation()
    const { items, tags } = useLoaderData<typeof loader>()

    return (
        <section>
            <div className="flex gap-4 justify-center mb-2">
                <Link to={"/cardapio"} className={
                    cn(
                        "p-2",
                        location.pathname === "/cardapio" && "border-b-brand-blue border-b-2",

                    )
                } >
                    <LayoutTemplate />
                </Link>
                <Link to={"/cardapio/list"} className={
                    cn(
                        "p-2",
                        location.pathname === "/cardapio/list" && "border-b-brand-blue border-b-2",

                    )
                } >
                    <LayoutList />
                </Link>
            </div>
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
        setHasMore(itemsFiltered.length > 10);
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

    // if (items.length === 0) {
    //     return (
    //         <div className="flex h-full w-full items-center justify-center p-8">
    //             <div className="flex flex-col gap-6 justify-center items-center">
    //                 <img src="/images/empty-cardapio.webp" className="mx-auto w-[136px]" alt="Nenhum item encontrado" />
    //                 <h1 className="font-body-website text-sm md:text-lg font-semibold text-muted-foreground">Nenhum item encontrado</h1>
    //             </div>
    //         </div>
    //     );
    // }

    return (
        <div className="flex flex-col mt-4">
            <ul className="flex flex-col overflow-y-auto md:overflow-y-z auto snap-mandatory">
                {items.map((item, index) => {
                    if (items.length === index + 1) {
                        return <CardapioItem ref={lastItemRef} key={item.id} item={item} />;
                    } else {
                        return <CardapioItem key={item.id} item={item} />;
                    }
                })}
            </ul>
        </div>

    );
}


interface CardapioItemProps {
    item: MenuItemWithAssociations;
}

const CardapioItem = React.forwardRef(({ item }: CardapioItemProps, ref: any) => {

    const italyProduct = item.tags?.public.some(t => t.toLocaleLowerCase() === "produtos-italianos")



    return (

        <li className="flex flex-col snap-start" id={item.id} ref={ref}>
            <div className="relative mb-2">
                <CardapioItemDialog item={item} triggerComponent={
                    <CardapioItemImage item={item} />
                } />
                <div className="absolute bottom-0 inset-x-0 py-4 px-2">
                    <CardapioItemPrice prices={item?.priceVariations} />
                </div>
            </div>
            <div className="flex flex-col px-4 mb-2">
                <h3 className="font-body-website text-sm font-semibold uppercase mb-2 text-left">{item.name}</h3>
                {
                    italyProduct && <ItalyIngredientsStatement />
                }
                <p className="font-body-website leading-tight text-left">{item.ingredients}</p>
            </div>
            <CardapioItemActionBar item={item} />
            <Separator className="my-4" />
        </li>
    )


});











