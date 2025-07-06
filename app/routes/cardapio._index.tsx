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
import CardapioItemPrice from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import { Carousel, CarouselContent, CarouselItem } from "~/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import { SwiperImagesCarousel } from "~/components/swiper-carousel/swiper-images-carousel";
import PostInstagram from "~/components/post-instagram/post-instagram";
import prismaClient from "~/lib/prisma/client.server";
import { Tag } from "@prisma/client";


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
        imageScaleWidth: 375,
    })


    const tags = tagPrismaEntity.findAll({
        public: true
    })

    const postFeatured = await prismaClient.post.findFirst({
        where: {
            featured: true,
        },
        select: {
            id: true,
            title: true, // ou quaisquer outros campos que você queira do post
            _count: {
                select: {
                    PostLike: true,
                    PostShare: true,
                },
            },
        },
    })


    return defer({
        items,
        tags,
        postFeatured

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

    if (values?.action === "post-like-it") {
        const postId = values?.postId as string
        let amount = 0

        amount = isNaN(Number(values?.likesAmount)) ? 1 : Number(values?.likesAmount)

        const [err, likeAmount] = await prismaIt(prismaClient.postLike.create({
            data: {
                createdAt: new Date().toISOString(),
                amount,
                Post: {
                    connect: {
                        id: postId
                    }
                }
            }
        }))

        if (err) {
            return badRequest({
                action: "post-like-it",
                likeAmount
            })
        }

        return ok({
            action: "post-like-it",
            likeAmount
        })

    }

    if (values?.action === "post-share-it") {
        const postId = values?.postId as string

        const [err, shareAmount] = await prismaIt(prismaClient.postShare.create({
            data: {
                createdAt: new Date().toISOString(),
                Post: {
                    connect: {
                        id: postId
                    }
                }
            }
        }))


        if (err) {
            return badRequest({
                action: "post-share-it",
                shareAmount
            })
        }

        return ok({
            action: "post-share-it",
            shareAmount
        })

    }

    return null
}

export default function CardapioWebIndex() {
    const { items, tags, postFeatured } = useLoaderData<typeof loader>()



    const imageUrls = Array.from({ length: 7 }, (_, i) => `/images/criacoes-inverno/criacoes-inverno-0${i + 1}.png`);

    return (


        <section className="flex flex-col mb-24" data-element="cardapio-index">

            <Separator className="my-4" />

            <div className="flex flex-col  md:flex-row md:gap-12">

                {/* Post Lançamento  */}
                <Suspense fallback={<Loading />}>
                    <Await resolve={postFeatured}>

                        {(postFeatured) => {

                            return (
                                <section id="post-lancamento" className="p-4" >
                                    <SectionTitle>Alerta de novidade</SectionTitle>
                                    <div className="grid place-items-center ">
                                        <PostInstagram
                                            postId={postFeatured?.id || ""}
                                            likesAmount={postFeatured?._count.PostLike || 0}
                                            sharesAmount={postFeatured?._count.PostShare || 0}
                                            content={
                                                <SwiperImagesCarousel slides={imageUrls || []} />
                                            }
                                            captionPreview={
                                                <div className="flex flex-col gap-4 mb-4">
                                                    <p className="text-sm font-neue"><span className="text-sm font-semibold">@amodomiopb </span>
                                                        Lançamento de inverno no ar! ❄️ Novas criações com sabores que aquecem, direto das montanhas italianas. 🇮🇹🔥

                                                    </p>
                                                    <p className="font-neue">*** Sabores disponíveis somente no cardápio A Modo Mio ou via WhatsApp (46) 99127 2525</p>
                                                </div>
                                            }
                                            captionFull={
                                                <section className="p-2 space-y-6 font-neue">
                                                    <h2 className="text-lg font-semibold">Lançamento de inverno no ar! ❄️</h2>
                                                    <p>Novas criações com sabores que aquecem, direto das montanhas italianas. 🇮🇹🔥</p>
                                                    <h3 className="block text-md">
                                                        Sabores invernais com inspiração nas Montanhas Italianas
                                                    </h3>

                                                    <article className="space-y-2">
                                                        <h4 className="text-lg font-semibold font-mono">🏔️ TRENTINA</h4>
                                                        <p><span className="font-semibold">Ingredientes:</span> Molho de tomate italiano, muçarela, gorgonzola, bacon defumado e parmesão.</p>
                                                        <p><span className="font-semibold">Perfil:</span> 👉 Intensa, cremosa e crocante.</p>
                                                        <p><span className="font-semibold">Inspiração:</span> Homenagem direta ao Trentino, terra de montanhas, neve, queijos fortes e sabores defumados. Um sabor que transmite o espírito dos refúgios alpinos da região, conforto e tradição.</p>
                                                    </article>

                                                    <article className="space-y-2">
                                                        <h4 className="text-lg font-semibold font-mono">🏔️ ETNA</h4>
                                                        <p><span className="font-semibold fontmo">Ingredientes:</span> Molho de tomate italiano, muçarela, abobrinha assada, provolone defumado, nozes e geleia apimentada.</p>
                                                        <p><span className="font-semibold">Perfil:</span> 👉 Vegetariana, surpreendente e levemente adocicada.</p>
                                                        <p><span className="font-semibold">Inspiração:</span> O vulcão ativo da Sicília inspira uma pizza cheia de energia e calor, com notas defumadas, doces e crocantes. Uma verdadeira explosão de sabores.</p>
                                                    </article>

                                                    <article className="space-y-2">
                                                        <h4 className="text-lg font-semibold font-mono">🏔️ MARMOLADA</h4>
                                                        <p><span className="font-semibold">Ingredientes:</span> Molho de tomate italiano, muçarela, cogumelos salteados, brie, presunto cru e molho pesto artesanal.</p>
                                                        <p><span className="font-semibold">Perfil:</span> 👉 Sofisticada, aromática e cheia de personalidade.</p>
                                                        <p><span className="font-semibold">Inspiração:</span> A Marmolada é a Rainha das Dolomitas. Seus bosques e trilhas inspiram uma pizza rica em sabores da montanha: cogumelos, queijos e ervas.</p>
                                                    </article>

                                                    <article className="space-y-2">
                                                        <h4 className="text-lg font-semibold font-mono">🏔️ GRAN PARADISO</h4>
                                                        <p><span className="font-semibold">Ingredientes:</span> Molho de tomate italiano, muçarela, bacon defumado, brie, nozes e geleia de damasco.</p>
                                                        <p><span className="font-semibold">Perfil:</span> 👉 Doce, salgada e crocante.</p>
                                                        <p><span className="font-semibold">Inspiração:</span> Uma montanha símbolo de equilíbrio e natureza preservada. Esta pizza traduz esse conceito com uma combinação harmoniosa de doce, salgado e crocância.</p>
                                                    </article>

                                                    <div className="bg-green-700 text-white font-neue px-2 py-1 space-y-2 rounded-md">
                                                        <p>Sabores disponíveis somente no cardápio A Modo Mio ou via WhatsApp (46) 99127 2525</p>
                                                    </div>
                                                </section>


                                            }
                                        />
                                    </div>

                                </section>
                            )
                        }}
                    </Await>
                </Suspense>

                <Separator className="my-4 md:hidden" />

                <Separator orientation="vertical" className="hidden md:mx-4" />

                {/* destaques */}

                <Suspense fallback={<Loading />}>
                    <Await resolve={items}>

                        {(items) => {

                            return (
                                <>

                                    <section className="flex flex-col gap-4 mx-2 md:flex-1">

                                        {/** @ts-ignore */}
                                        <CardapioItemListDestaque items={items} title="Sugestões do chef" tagFilter="em-destaque" />
                                        {/** @ts-ignore */}
                                        <CardapioItemListDestaque items={items} title="Mais vendidos" tagFilter="mais-vendido" carouselDelay={2100} />

                                    </section>
                                </>
                            )
                        }}
                    </Await>
                </Suspense>

            </div>

            <Separator className="my-4" />



            {/* Lista items */}

            <Suspense fallback={<Loading />}>
                <Await resolve={Promise.all([tags, items])}>
                    {([loadedTags, loadedItems]) => {
                        const [currentItems, setCurrentItems] = useState(loadedItems);
                        const [currentFilterTag, setCurrentFilterTag] = useState<Tag | null>(null);

                        const onCurrentTagSelected = (tag: Tag | null) => {
                            setCurrentFilterTag(tag);

                            if (tag?.id === "all") {
                                setCurrentItems(loadedItems);
                                return
                            }

                            if (tag) {
                                const filtered = loadedItems.filter(item =>
                                    item.tags?.public.some(t => t === tag.name)
                                );
                                setCurrentItems(filtered);
                            } else {
                                setCurrentItems(loadedItems);
                            }
                        };

                        return (
                            <div className="flex flex-col ">
                                <FiltersTags
                                    tags={loadedTags}
                                    currentTag={currentFilterTag}
                                    onCurrentTagSelected={onCurrentTagSelected}
                                />
                                <CardapioItemList allItems={currentItems} />
                            </div>
                        );
                    }}
                </Await>
            </Suspense>
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
        <div className="flex flex-col gap-4">

            <section>
                <ul className="flex flex-col overflow-y-auto md:overflow-y-auto snap-mandatory mt-4 md:grid md:grid-cols-2 md:gap-x-4">
                    {items.map((item, index) => {
                        const isLastItem = items.length === index + 1;
                        return (
                            <Link to={`/cardapio/${item.slug}`} key={item.id} className="w-full">
                                <CardapioItemFullImage
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
                        <div className="flex items-center gap-2">
                            <h3 className="font-neue text-xl tracking-wider font-semibold uppercase">{item.name}</h3>
                            {italyProduct && <ItalyIngredientsStatement showText={false} />}
                        </div>
                        <div className="flex flex-col gap-2">
                            {bestSeller && <AwardBadge>A mais desejada</AwardBadge>}
                            {bestMonthlySeller && <AwardBadge>Mais vendida do mes</AwardBadge>}
                        </div>
                    </div>


                    <p className="leading-snug text-[15px] my-2">{capitalize(item.ingredients)}</p>
                    <CardapioItemPrice prices={item?.MenuItemSellingPriceVariation} cnLabel="text-black" showValuta={false} />
                    <CardapioItemActionBar item={item} />
                </div>
                {/* <CardapioItemImage imageURL={item.imageTransformedURL}
                    cnClassName="col-span-3 h-[120px] rounded-lg overflow-hidden"
                    placeholderImage={true}
                    cnImage={"bg-left"}
                /> */}
                <CardapioItemImageSingle
                    src={item.imageTransformedURL || ""}
                    placeholder={item.imagePlaceholderURL || ""}
                    placeholderIcon={true}
                    enableOverlay={false}
                    cnContainer="col-span-3 h-[120px] rounded-lg overflow-hidden"
                />

            </div>


            {/* </CardapioItemDialog> */}
        </li>
    )
})

interface CardapioItemFullImageProps {
    item: MenuItemWithAssociations;
}

const CardapioItemFullImage = React.forwardRef(({ item }: CardapioItemFullImageProps, ref: any) => {
    const italyProduct = item.tags?.public.some(t => t.toLocaleLowerCase() === "produtos-italianos")
    const bestMonthlySeller = item.tags?.all.some(t => t.toLocaleLowerCase() === "mais-vendido-mes")
    const bestSeller = item.tags?.all.some(t => t.toLocaleLowerCase() === "mais-vendido")

    const featuredImage = item.MenuItemGalleryImage.filter(img => img.isPrimary)[0];

    return (
        <li className="snap-start border-b py-[0.15rem]" id={item.id} ref={ref}>
            <div className="relative h-[350px]">
                <CardapioItemImageSingle
                    src={featuredImage?.secureUrl || ""}
                    placeholder={item.imagePlaceholderURL || ""}
                    placeholderIcon={false}

                    cnContainer="w-full h-full"
                />
                <div className="absolute inset-0" >
                    <div className="grid grid-cols-8 h-full">
                        <div className={
                            cn(
                                "flex flex-col mb-2 px-4 text-white col-span-7 justify-end",
                            )
                        }>
                            <div className="flex flex-col gap-0">
                                <div className="flex items-center gap-2">
                                    {italyProduct && <ItalyIngredientsStatement showText={false} />}
                                    <h3 className="font-urw text-xl">{item.name}</h3>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {bestSeller && <AwardBadge>A mais desejada</AwardBadge>}
                                    {bestMonthlySeller && <AwardBadge>Mais vendida do mes</AwardBadge>}
                                </div>
                            </div>


                            <div className="flex flex-col gap-0 ">
                                <p className="font-neue leading-tight text-[15px] mt-1 mb-4 tracking-wide">{capitalize(item.ingredients)}</p>
                                <CardapioItemPrice prices={item?.MenuItemSellingPriceVariation} cnLabel="text-white" cnValue="text-white font-semibold" showValuta={false} />
                            </div>

                        </div>
                        <CardapioItemActionBar item={item} />
                    </div>

                </div>
            </div>

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
            <SectionTitle>{title}</SectionTitle>
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
                        items.filter(i => i.tags?.all.some(t => t === tagFilter)).slice(0, 4).map((i: MenuItemWithAssociations) => {

                            const featuredImage = i.MenuItemGalleryImage.filter(img => img.isPrimary)[0];

                            return (
                                <CarouselItem key={i.id} className="basis-1/2 md:basis-1/3" data-element="carousel-item">
                                    <Link to={`/cardapio/${i.slug}`} className="w-full">

                                        <div className="relative grid place-items-center rounded-md bg-slate-50 h-[112px] md:h-[250px]">
                                            <CardapioItemImageSingle
                                                src={featuredImage?.secureUrl || ""}
                                                placeholder={i.imagePlaceholderURL || ""}

                                                // placeholderIcon={true}

                                                // placeholderText="Imagem não disponível"
                                                cnContainer="h-full w-full rounded-md"
                                                cnPlaceholderText="text-[11px]"
                                            />

                                            <div className="absolute bottom-2 w-full">
                                                <p className=" ml-3 font-urw text-sm text-white">{i.name}</p>
                                            </div>

                                        </div>
                                    </Link>
                                </CarouselItem>
                            )

                        })}
                </CarouselContent>
            </Carousel>
        </div>
    )
}


interface SectionTitleProps {
    children: React.ReactNode,
    cnContainer?: string
}

function SectionTitle({ children, cnContainer }: SectionTitleProps) {
    return (
        <h3 className={cn("font-medium text-xl tracking-tight mb-4 font-neue", cnContainer)}>{children}</h3>
    )
}



