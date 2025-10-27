import { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, defer, useLoaderData, useSearchParams } from "@remix-run/react";
import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { menuItemLikePrismaEntity } from "~/domain/cardapio/menu-item-like.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { menuItemSharePrismaEntity } from "~/domain/cardapio/menu-item-share.prisma.entity.server";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";
import { CardapioItemActionBarHorizontal, CardapioItemActionBarVertical, LikeIt, ShareIt } from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import Loading from "~/components/loading/loading";
import { FiltersTags, FilterTagSelect } from "~/domain/cardapio/components/filter-tags/filter-tags";
import { cn } from "~/lib/utils";
import capitalize from "~/utils/capitalize";
import AwardBadge from "~/components/award-badge/award-badge";
import { Separator } from "~/components/ui/separator";
import { CardapioItemPrice, CardapioItemPriceSelect } from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "~/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import { SwiperImagesCarousel } from "~/components/swiper-carousel/swiper-images-carousel";
import PostInstagram from "~/components/post-instagram/post-instagram";
import prismaClient from "~/lib/prisma/client.server";
import { Tag } from "@prisma/client";
import { useSoundEffects } from "~/components/sound-effects/use-sound-effects";


export const headers: HeadersFunction = () => ({
    'Cache-Control': 's-maxage=1, stale-while-revalidate=59',
});

export async function loader({ request }: LoaderFunctionArgs) {
    //@ts-ignore
    const items = menuItemPrismaEntity.findAllGroupedByGroup({
        where: {
            visible: true,
        },
        option: {
            sorted: true,
            direction: "asc"
        },
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

            <Separator className="my-6" />

            <div className="flex flex-col  md:flex-row md:gap-12">

                {/* Post Lançamento  */}
                {/* <Suspense fallback={<Loading />}>
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
                </Suspense> */}

                {/* <Separator className="my-4 md:hidden" /> */}

                <Separator orientation="vertical" className="hidden md:mx-4" />

                {/* destaques */}

                <Suspense fallback={<Loading />}>
                    <Await resolve={items}>

                        {(items) => {

                            return (
                                <>
                                    <section id="destaque" className="flex flex-col gap-4 mx-2 md:flex-1 mt-20 md:mt-24">
                                        {/** @ts-ignore */}
                                        <CardapioItemListDestaque items={items} title="Sugestões do chef" tagFilter="em-destaque" />
                                        {/** @ts-ignore */}
                                        {/* <CardapioItemListDestaque items={items} title="Mais vendidos" tagFilter="mais-vendido" carouselDelay={2100} /> */}

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

                        function isGrouped(arr: any[]): arr is GroupedItems[] {
                            return Array.isArray(arr) && arr.length > 0 && "menuItems" in (arr[0] as any)
                        }

                        const onCurrentTagSelected = (tag: Tag | null) => {
                            setCurrentFilterTag(tag);

                            // reset
                            if (!tag || tag.id === "all") {
                                setCurrentItems(loadedItems);
                                return;
                            }

                            const tagName = tag.name;
                            const hasTag = (i: any) =>
                                Boolean(i?.tags?.public?.includes?.(tagName) || i?.tags?.all?.includes?.(tagName));

                            if (isGrouped(loadedItems)) {
                                // mantém a estrutura por grupo e remove grupos vazios
                                const filteredGroups = (loadedItems as GroupedItems[])
                                    .map(g => ({ ...g, menuItems: g.menuItems.filter(hasTag) }))
                                    .filter(g => g.menuItems.length > 0);

                                setCurrentItems(filteredGroups);
                            } else {
                                const filtered = (loadedItems as MenuItem[]).filter(hasTag);
                                setCurrentItems(filtered);
                            }
                        };

                        return (
                            <div className="flex flex-col mx-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="font-neue text-sm md:text-lg font-semibold tracking-wider">Todos os produtos</h2>
                                    {/* <FiltersTags
                                        tags={loadedTags}
                                        currentTag={currentFilterTag}
                                        onCurrentTagSelected={onCurrentTagSelected}
                                    /> */}
                                    <FilterTagSelect
                                        tags={loadedTags}
                                        currentTag={currentFilterTag}
                                        onCurrentTagSelected={onCurrentTagSelected}
                                        label="Categorias"
                                    />
                                </div>
                                {/* --- substituir APENAS esta linha ---
<CardapioItemsGrid items={currentItems} />
--- pelo bloco abaixo --- */}

                                {/* Render por grupo (com título) */}
                                {Array.isArray(currentItems) && currentItems.length > 0 && "menuItems" in (currentItems[0] as any)
                                    ? (currentItems as Array<{
                                        groupId: string
                                        group: string
                                        sortOrderIndex?: number
                                        menuItems: any[]
                                    }>)
                                        .sort((a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0)) // garante a ordem do grupo
                                        .map((g) => (
                                            <section key={g.groupId} className="mb-6">
                                                <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-2 border-b">
                                                    {g.group}
                                                </h3>
                                                <CardapioItemsGrid items={g.menuItems} />

                                            </section>
                                        ))
                                    : (
                                        // fallback caso currentItems seja um array plano de itens (sem agrupamento)
                                        <CardapioItemsGrid items={currentItems as any[]} />
                                    )
                                }

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

                            <CardapioItemFullImage
                                ref={isLastItem ? lastItemRef : null}
                                key={item.id}
                                item={item}
                            />

                        );
                    })}
                </ul>
            </section>
        </div>
    );
}

// =====================
// GRID DE ITENS RESPONSIVO (estilo e-commerce)
// =====================
function CardapioItemsGrid({ items }: { items: MenuItemWithAssociations[] }) {
    if (!items?.length) return null

    return (
        <ul
            className="
          mt-4 grid grid-cols-2 gap-3
          sm:grid-cols-3
          lg:grid-cols-4
          xl:grid-cols-5
        "
        >
            {items.map((item) => (
                <CardapioGridItem key={item.id} item={item} />
            ))}
        </ul>
    )
}

function CardapioGridItem({ item }: { item: MenuItemWithAssociations }) {

    const [toggleIngredientsList, setToggleIngredientsList] = useState(false)

    const featuredImage =
        item.MenuItemGalleryImage?.find((img) => img.isPrimary) ||
        item.MenuItemGalleryImage?.[0]

    return (
        <li className="flex flex-col gap-0  ">
            <Link
                to={`/cardapio/${item.slug}`}
                className="group block overflow-hidden rounded-tl-md rounded-tr-md relative"
            >
                {/* imagem */}
                <div className="relative ">
                    <CardapioItemImageSingle
                        src={featuredImage?.secureUrl || ""}
                        placeholder={item.imagePlaceholderURL || ""}
                        placeholderIcon={false}
                        cnPlaceholderText="text-black font-urw text-sm tracking-tight"
                        cnPlaceholderContainer="from-zinc-200 via-zinc-100 to-white "
                        cnContainer="h-[150px] w-full "
                        enableOverlay={false}
                    />
                    {item.meta.isBestSeller &&
                        (
                            <div className="absolute left-1 top-2 rounded-sm bg-black px-2 py-[2px] text-[10px] font-medium text-white backdrop-blur font-neue tracking-wide">
                                <span>Mais vendido</span>
                            </div>
                        )
                    }

                    {item.tags.all.find(t => t === "produtos-italianos") &&
                        (
                            <div className="absolute left-1 top-2 rounded-sm bg-black px-2 py-[2px] text-[10px] font-medium text-white backdrop-blur font-neue tracking-wide">
                                <span>Com produtos italianos</span>
                            </div>
                        )
                    }
                </div>

            </Link>
            <div className="flex justify-between rounded-bl-md rounded-br-md p-2 shadow-sm" >
                <ShareIt item={item} />
                <LikeIt item={item} />
            </div>

            {/* nome e preço */}
            <div className="mt-2 px-1 flex flex-col">
                <span className="font-neue line-clamp-1 font-medium text-xs tracking-wide sm:text-base">
                    {item.name}
                </span>
                <div className="flex flex-col gap-1 mb-2 ">
                    <span className={cn(
                        "font-neue text-xs tracking-wide leading-[110%] sm:text-base line-clamp-2 ",
                        toggleIngredientsList && "line-clamp-none"
                    )}
                        onClick={() => setToggleIngredientsList(!toggleIngredientsList)}
                    >
                        {item.ingredients}

                    </span>
                    <span className={cn(
                        "font-neue text-xs tracking-wide leading-[110%] sm:text-base mb-2 line-clamp-2 underline ",
                        toggleIngredientsList === true && "hidden"
                    )}
                        onClick={() => setToggleIngredientsList(!toggleIngredientsList)}
                    >
                        Ver mais

                    </span>
                </div>

                <CardapioItemPriceSelect
                    prices={item.MenuItemSellingPriceVariation}
                // cnLabel="text-muted-foreground text-xs"
                // cnValue="text-sm font-semibold"
                />
            </div>
        </li>
    )
}




interface CardapioItemFullImageProps {
    item: MenuItemWithAssociations;
}

const CardapioItemFullImage = React.forwardRef(({ item }: CardapioItemFullImageProps, ref: any) => {
    const { playNavigation } = useSoundEffects()
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
                        <Link to={`/cardapio/${item.slug}`}
                            className="flex flex-col mb-2 px-4 text-white  justify-end items-end w-full col-span-7"
                            onClick={() => {
                                playNavigation()
                            }}
                        >
                            <div className="flex flex-col gap-0">
                                <div className="flex items-center gap-2">
                                    {italyProduct && <ItalyIngredientsStatement showText={false} />}
                                    <h3 className="font-urw text-xl">{item.name}</h3>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {bestSeller && <AwardBadge>A mais desejada</AwardBadge>}
                                    {bestMonthlySeller && <AwardBadge>Mais vendida do mes</AwardBadge>}
                                </div>


                                <div className="flex flex-col gap-0 ">
                                    <p className="font-neue leading-tight text-[15px] mt-1 mb-4 tracking-wide">{capitalize(item.ingredients)}</p>
                                    <CardapioItemPrice prices={item?.MenuItemSellingPriceVariation} cnLabel="text-white" cnValue="text-white font-semibold" showValuta={false} />
                                </div>

                            </div>
                        </Link>
                        <CardapioItemActionBarVertical item={item} />
                    </div>


                </div>
            </div>

        </li>

    )
})




type MenuItem = {
    id: string
    name: string
    slug: string
    imagePlaceholderURL?: string
    MenuItemGalleryImage?: { isPrimary?: boolean; secureUrl?: string }[]
    tags?: { all?: string[] }
    // ...outros campos usados pelo grid
}

type GroupedItems = {
    groupId: string
    group: string
    sortOrderIndex?: number
    menuItems: MenuItem[]
}

type CardapioItemListDestaqueProps = {
    title?: string
    items: MenuItem[] | GroupedItems[]
    tagFilter?: string
    carouselDelay?: number
}

function isGrouped(items: MenuItem[] | GroupedItems[]): items is GroupedItems[] {
    return Array.isArray(items) && items.length > 0 && "menuItems" in (items[0] as any)
}

function CardapioItemListDestaque({
    title,
    items,
    tagFilter,
    carouselDelay = 2000,
}: CardapioItemListDestaqueProps) {
    const { playNavigation } = useSoundEffects()
    const [api, setApi] = React.useState<CarouselApi | null>(null)
    const [selectedIndex, setSelectedIndex] = React.useState(0)

    // badge do selo (ex.: “Mais vendido”)
    const badge =
        tagFilter?.toLowerCase() === "mais-vendido"
            ? "Mais vendido"
            : tagFilter?.toLowerCase() === "em-destaque"
                ? "Sugestão do chef"
                : undefined

    // -------------------------------
    // MODO 1: LISTA PLANA (comportamento anterior)
    // -------------------------------
    if (!isGrouped(items)) {
        const slides = React.useMemo(() => {
            return (items || [])
                .filter(i => (tagFilter ? i.tags?.all?.some(t => t === tagFilter) : true))
                .slice(0, 4)
        }, [items, tagFilter])

        React.useEffect(() => {
            if (!api) return
            const onSelect = () => setSelectedIndex(api.selectedScrollSnap())
            api.on("select", onSelect)
            setSelectedIndex(api.selectedScrollSnap())
            return () => api.off("select", onSelect)
        }, [api])

        if (!slides.length) return null

        return (
            <div className="p-2">
                {title ? (
                    <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-2">
                        {title}
                    </h3>
                ) : null}

                <Carousel
                    setApi={setApi}
                    opts={{ loop: true, align: "start" }}
                    plugins={[
                        Autoplay({
                            delay: carouselDelay,
                            stopOnInteraction: false,
                            stopOnMouseEnter: true,
                        }),
                    ]}
                    className="relative"
                >
                    <CarouselContent>
                        {slides.map((i) => {
                            const featuredImage =
                                i.MenuItemGalleryImage?.find(img => img.isPrimary) ||
                                i.MenuItemGalleryImage?.[0]

                            return (
                                <CarouselItem key={i.id}>
                                    <Link
                                        to={`/cardapio/${i.slug}`}
                                        className="block w-full"
                                        onClick={() => playNavigation()}
                                    >
                                        <div className="relative h-[320px] md:h-[380px] overflow-hidden rounded-md">
                                            <CardapioItemImageSingle
                                                src={featuredImage?.secureUrl || ""}
                                                placeholder={i.imagePlaceholderURL || ""}
                                                placeholderIcon={false}
                                                cnPlaceholderContainer="from-zinc-200 via-zinc-100 to-white "
                                                cnContainer="h-full w-full"
                                                enableOverlay={false}
                                            />
                                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                                            {badge && (
                                                <div className="absolute left-3 top-3 rounded-md bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur font-neue">
                                                    {badge}
                                                </div>
                                            )}
                                            <div className="absolute bottom-3 left-3 right-3">
                                                <h4 className="font-neue text-white text-2xl leading-tight drop-shadow">
                                                    {i.name}
                                                </h4>
                                            </div>
                                        </div>
                                    </Link>
                                </CarouselItem>
                            )
                        })}
                    </CarouselContent>

                    {/* Dots */}
                    <div className="absolute inset-x-0 -bottom-3 flex items-center justify-center gap-2 md:-bottom-4">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                aria-label={`Ir para slide ${idx + 1}`}
                                onClick={() => api?.scrollTo(idx)}
                                className={[
                                    "h-2 w-2 rounded-full transition-all",
                                    selectedIndex === idx ? "w-6 bg-black/80" : "bg-black/30",
                                ].join(" ")}
                            />
                        ))}
                    </div>
                </Carousel>
            </div>
        )
    }

    // -------------------------------
    // MODO 2: AGRUPADO — um carrossel por grupo
    // -------------------------------
    const groups = React.useMemo(
        () =>
            (items as GroupedItems[])
                .map(g => ({
                    ...g,
                    slides: (g.menuItems || [])
                        .filter(i => (tagFilter ? i.tags?.all?.some(t => t === tagFilter) : true))
                        .slice(0, 4),
                }))
                .filter(g => g.slides.length > 0)
                .sort((a, b) => (a.sortOrderIndex ?? 0) - (b.sortOrderIndex ?? 0)),
        [items, tagFilter]
    )

    if (!groups.length) return null

    return (
        <div className="p-2">
            {title ? (
                <h3 className="font-neue text-base md:text-xl font-semibold tracking-wide mb-2">
                    {title}
                </h3>
            ) : null}

            <div className="flex flex-col gap-6">
                {groups.map((group) => (
                    <section key={group.groupId}>

                        {/* Para cada grupo, instanciamos um carrossel independente */}
                        <Carousel
                            opts={{ loop: true, align: "start" }}
                            plugins={[
                                Autoplay({
                                    delay: carouselDelay,
                                    stopOnInteraction: false,
                                    stopOnMouseEnter: true,
                                }),
                            ]}
                            className="relative"
                        >
                            <CarouselContent>
                                {group.slides.map((i) => {
                                    const featuredImage =
                                        i.MenuItemGalleryImage?.find(img => img.isPrimary) ||
                                        i.MenuItemGalleryImage?.[0]

                                    return (
                                        <CarouselItem key={i.id}>
                                            <Link
                                                to={`/cardapio/${i.slug}`}
                                                className="block w-full"
                                                onClick={() => playNavigation()}
                                            >
                                                <div className="relative h-[320px] md:h-[380px] overflow-hidden rounded-md">
                                                    <CardapioItemImageSingle
                                                        src={featuredImage?.secureUrl || ""}
                                                        placeholder={i.imagePlaceholderURL || ""}
                                                        placeholderIcon={false}
                                                        cnContainer="h-full w-full"
                                                        enableOverlay={false}
                                                        cnPlaceholderContainer="from-white via-zinc-100 to-zinc-200 "
                                                        cnPlaceholderText="text-black font-urw text-xl tracking-tighter"
                                                    />
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                                                    {badge && (
                                                        <div className="absolute left-3 top-3 rounded-md bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur font-neue">
                                                            {badge}
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-3 left-3 right-3">
                                                        <h5 className="font-neue text-white text-2xl leading-tight drop-shadow">
                                                            {i.name}
                                                        </h5>
                                                    </div>
                                                </div>
                                            </Link>
                                        </CarouselItem>
                                    )
                                })}
                            </CarouselContent>
                        </Carousel>
                    </section>
                ))}
            </div>
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



