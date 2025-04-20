import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, defer, useLoaderData, useSearchParams } from "@remix-run/react";
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
import AwardBadge from "~/components/award-badge/award-badge";
import { Separator } from "~/components/ui/separator";
import CardapioItemDialog from "~/domain/cardapio/components/cardapio-item-dialog/cardapio-item-dialog";
import CardapioItemPrice from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import CardapioItemImage from "~/domain/cardapio/components/cardapio-item-image/cardapio-item-image";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "~/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay"
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";


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

        <section className="flex flex-col mb-24" data-element="cardapio-index">

            <Separator className="my-4" />

            <Suspense fallback={<Loading />}>
                <Await resolve={items}>

                    {(items) => {

                        return (
                            <section className="flex flex-col gap-4 mx-2 md:grid md:grid-cols-2">


                                {/** @ts-ignore */}
                                <CardapioItemListDestaque items={items} title="Sugestões do chef" tagFilter="em-destaque" />
                                {/** @ts-ignore */}
                                <CardapioItemListDestaque items={items} title="mais vendidos" tagFilter="mais-vendido" carouselDelay={2100} />

                            </section>
                        )
                    }}
                </Await>
            </Suspense>

            <Separator className="my-4" />

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
        </section>


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
        <div className="flex flex-col gap-4">

            <section>
                <ul className="flex flex-col overflow-y-auto md:overflow-y-auto snap-mandatory mt-4 md:grid md:grid-cols-2 md:gap-x-4">
                    {items.map((item, index) => {
                        const isLastItem = items.length === index + 1;
                        return (
                            <Link to={`/cardapio/${item.id}`} key={item.id} className="w-full">
                                <CardapioItem
                                    ref={isLastItem ? lastItemRef : null}
                                    key={item.id}
                                    item={item}
                                />
                            </Link>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}

interface CardapioItemProps {
    item: MenuItemWithAssociations;
}

const CardapioItem = React.forwardRef(({ item }: CardapioItemProps, ref: any) => {
    const italyProduct = item.tags?.public.some(t => t.toLocaleLowerCase() === "produtos-italianos")
    const bestMonthlySeller = item.tags?.all.some(t => t.toLocaleLowerCase() === "mais-vendido-mes")
    const bestSeller = item.tags?.all.some(t => t.toLocaleLowerCase() === "mais-vendido")

    return (
        <li className="snap-start border-b py-2" id={item.id} ref={ref}>
            {/* <CardapioItemDialog item={item} triggerComponent={
            <CardapioItemImage item={item} />
        }> */}


            <div className="grid grid-cols-8 min-h-[120px] mx-4 gap-x-4">
                <div className={
                    cn(
                        "flex flex-col mb-2 col-span-5",
                    )
                }>
                    <div className="flex flex-col gap-0 mb-1">
                        <h3 className="font-body-website text-xl tracking-wider font-semibold uppercase">{item.name}</h3>
                        <div className="flex flex-col gap-2">
                            {bestSeller && <AwardBadge>A mais desejada</AwardBadge>}
                            {bestMonthlySeller && <AwardBadge>Mais vendida do mes</AwardBadge>}
                        </div>
                    </div>

                    {italyProduct && <ItalyIngredientsStatement />}
                    <p className="leading-snug text-[15px] my-2">{capitalize(item.ingredients)}</p>
                    <CardapioItemPrice prices={item?.priceVariations} cnLabel="text-black" showValuta={false} />
                    <CardapioItemActionBar item={item} />
                </div>
                <CardapioItemImage imageURL={item.imageTransformedURL}
                    cnClassName="col-span-3 h-[120px] rounded-lg overflow-hidden"
                    placeholderImage={true}
                    cnImage={"bg-left"}
                />

            </div>


            {/* </CardapioItemDialog> */}
        </li>
    )
})





interface CardapioItemListDestaqueProps {
    title: string
    items: MenuItemWithAssociations
    tagFilter?: string
    carouselDelay?: number
}


function CardapioItemListDestaque({ title, items, tagFilter, carouselDelay = 2000 }: CardapioItemListDestaqueProps) {

    return (
        <div className="rounded-md p-2">
            <h3 className="font-semibold text-2xl uppercase mb-4 font-body-website tracking-wider">{title}</h3>
            {/* <Carousel>
                <CarouselContent className="-ml-2 md:-ml-4">
                    <CarouselItem className="pl-2 md:pl-4">...</CarouselItem>
                    <CarouselItem className="pl-2 md:pl-4">...</CarouselItem>
                    <CarouselItem className="pl-2 md:pl-4">...</CarouselItem>
                </CarouselContent>
            </Carousel> */}
            <Carousel
                plugins={[
                    Autoplay({
                        delay: carouselDelay,
                    }),
                ]}
            >
                <CarouselContent className="-ml-2 md:-ml-4">

                    {
                        // @ts-ignore
                        items.filter(i => i.tags?.all.some(t => t === tagFilter)).slice(0, 4).map(i => (

                            <CarouselItem key={i.id} className="basis-1/2 md:basis-1/3" data-element="carousel-item">
                                <Link to={`/cardapio/${i.id}`} className="w-full">

                                    <div className="grid place-items-center rounded-md bg-slate-50 h-[112px]">
                                        <CardapioItemImageSingle
                                            src={i.imageTransformedURL || ""}
                                            placeholder={i.imagePlaceholderURL || ""}

                                            placeholderIcon={true}

                                            // placeholderText="Imagem não disponível"
                                            cnContainer="h-full w-full rounded-md"
                                        />

                                        <div className="absolute bottom-2">
                                            <span className="font-body-website font-semibold tracking-widest uppercase text-white">{i.name}</span>
                                        </div>

                                    </div>
                                </Link>
                            </CarouselItem>

                        ))}
                </CarouselContent>
            </Carousel>
        </div>
    )
}





