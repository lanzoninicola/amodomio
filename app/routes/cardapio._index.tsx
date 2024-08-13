import { ActionArgs, HeadersFunction } from "@remix-run/node";
import { useActionData, useFetcher, useOutletContext, useSearchParams } from "@remix-run/react";
import { Share2, Heart, Settings } from "lucide-react";
import React, { useState, useRef, useCallback, useEffect } from "react";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { cn } from "~/lib/utils";
import { CardapioOutletContext } from "./cardapio";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { menuItemLikePrismaEntity } from "~/domain/cardapio/menu-item-like.prisma.entity.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { menuItemSharePrismaEntity } from "~/domain/cardapio/menu-item-share.prisma.entity.server";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import ItalyFlag from "~/components/italy-flag/italy-flag";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";

export const headers: HeadersFunction = () => ({
    'Cache-Control': 's-maxage=1, stale-while-revalidate=59',
});

export async function action({ request }: ActionArgs) {
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
    const [searchParams] = useSearchParams();
    let currentFilterTag = searchParams.get("tag");

    const { items: allItems } = useOutletContext<CardapioOutletContext>();

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

    if (items.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <div className="flex flex-col gap-6 justify-center items-center">
                    <img src="/images/empty-cardapio.webp" className="mx-auto w-[136px]" alt="Nenhum item encontrado" />
                    <h1 className="font-body-website text-sm md:text-lg font-semibold text-muted-foreground">Nenhum item encontrado</h1>
                </div>
            </div>
        );
    }

    return (
        <section>
            <ul className="flex flex-col overflow-y-auto md:overflow-y-z auto snap-mandatory">
                {items.map((item, index) => {
                    if (items.length === index + 1) {
                        return <CardapioItemWithDialog ref={lastItemRef} key={item.id} item={item} />;
                    } else {
                        return <CardapioItemWithDialog key={item.id} item={item} />;
                    }
                })}
            </ul>
        </section>
    );
}


interface CardapioItemProps {
    item: MenuItemWithAssociations;
}

const CardapioItem = React.forwardRef(({ item }: CardapioItemProps, ref: any) => (
    <li className="flex flex-col snap-start" id={item.id} ref={ref}>
        <div className="relative mb-2">
            <CardapioItemImage item={item} />
            <div className="absolute bottom-0 inset-x-0 py-4 px-2">
                <CardapioItemPrice prices={item?.priceVariations} />
            </div>
        </div>
        <div className="flex flex-col px-4 mb-2">
            <h3 className="font-body-website text-sm font-semibold uppercase mb-2 text-left">{item.name}</h3>
            <p className="font-body-website leading-tight text-left">{item.ingredients}</p>
        </div>
        <CardapioItemActionBar item={item} />
        <Separator className="my-4" />
    </li>
));

const CardapioItemWithDialog = React.forwardRef(({ item }: CardapioItemProps, ref: any) => (
    <Dialog>
        <DialogTrigger asChild>
            <button>
                <CardapioItem item={item} ref={ref} />
            </button>
        </DialogTrigger>
        <DialogContent>
            <CardapioItemImage item={item} withOverlay={false} />

            <div className="flex flex-col px-4 mb-2">
                <h3 className="font-body-website text-sm font-semibold uppercase mb-2">{item.name}</h3>
                <p className="font-body-website leading-tight">{item.ingredients}</p>
            </div>

            <CardapioItemPrice prices={item?.priceVariations} cnTextColor="text-black" />
        </DialogContent>
    </Dialog>
))




interface CardapioItemImageProps {
    item: MenuItemWithAssociations;
    withOverlay?: boolean;
}

const CardapioItemImage = ({ item, withOverlay = true }: CardapioItemImageProps) => {

    const italyProduct = item.tags?.public.some(t => t.toLocaleLowerCase() === "produtos-italianos")

    const Overlay = () => {
        return (
            <div className="absolute inset-0 overflow-hidden rotate-0" style={{
                background: "linear-gradient(180deg, #00000033 60%, #0000009e 75%)"
            }}>
            </div>
        )
    }

    const ItalyFlagOverlay = () => {
        return (
            <div className="absolute top-2 right-4 overflow-hidden rotate-0" >
                <ItalyFlag width={24} />
            </div>

        )
    }

    return (
        <div className="relative">
            <img
                src={item.imageTransformedURL || "/images/cardapio-web-app/placeholder.png"}
                alt={item.name}
                loading="lazy"
                className="w-full max-h-[250px] object-cover object-center"
            />
            {withOverlay && <Overlay />}
            {italyProduct && <ItalyFlagOverlay />}
        </div>
    )
}

interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["priceVariations"]
    cnTextColor?: string
}

function CardapioItemPrice({ prices, cnTextColor }: CardapioItemPriceProps) {

    const visiblePrices = prices.filter(p => p.showOnCardapio === true) || []
    const colsNumber = prices.length

    return (
        <div className={
            cn(
                "grid gap-x-2",
                isNaN(colsNumber) ? "grid-cols-3" : `grid-cols-${colsNumber}`
            )
        }>
            {
                visiblePrices.map(p => {

                    return (

                        <div key={p.id} className={
                            cn(
                                "flex flex-col items-center text-white",
                                cnTextColor
                            )

                        }>
                            <span className="font-body-website uppercase text-[14px]">{p?.label}</span>
                            <Separator orientation="horizontal" className="my-1" />
                            <div className="flex items-start gap-[2px] font-body-website font-semibold">
                                <span className="text-[13px]">R$</span>
                                <span className="text-[15px]">{p?.amount}</span>
                            </div>
                        </div>
                    )


                })
            }

        </div>
    )
}

function CardapioItemActionBar({ item }: { item: MenuItemWithAssociations }) {
    const [likeIt, setLikeIt] = useState(false)
    const [likesAmount, setLikesAmount] = useState(item.likes?.amount || 0)

    const fetcher = useFetcher();

    const likingIt = () => {

        setLikeIt(true)
        setLikesAmount(likesAmount + 1)

        fetcher.submit(
            {
                action: "menu-item-like-it",
                itemId: item.id,
                likesAmount: String(1),
            },
            { method: 'post' }
        );
    };

    const shareIt = () => {
        if (!navigator?.share) {
            console.log("Navegador não suporta o compartilhamento")
            return
        }

        const text = `Essa pizza ${item.name} é a melhor pizza da cidade. Experimente...`
        navigator.share({
            title: item.name,
            text,
            url: `${GLOBAL_LINKS.cardapioPublic}/#${item.id}`
        }).then(() => {

            fetcher.submit(
                {
                    action: "menu-item-share-it",
                    itemId: item.id,
                },
                { method: 'post' }
            );

        }).catch((error) => {
        })
    }




    return (
        <div className="flex flex-col gap-0">
            <div className="grid grid-cols-2 font-body-website px-4 mb-1">
                <div className="flex items-center">
                    <div className="flex flex-col gap-1 cursor-pointer p-2 active:bg-brand-blue/50" onClick={likingIt}>
                        <Heart
                            className={cn(
                                likeIt ? "fill-red-500" : "fill-none",
                                likeIt ? "stroke-red-500" : "stroke-black",
                                item.likes?.amount && item.likes?.amount > 0 ? "stroke-red-500" : "stroke-black"
                            )}
                        />
                    </div>
                    <div className="flex flex-col gap-1 cursor-pointer p-2 active:bg-brand-blue/50 " onClick={shareIt}>
                        <Share2 />
                    </div>
                </div>

                <WhatsappExternalLink
                    phoneNumber="46991272525"
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Olá, gostaria fazer um pedido"}
                    className="flex flex-col gap-1 items-end cursor-pointer p-2 active:bg-brand-blue/50"
                >
                    <WhatsAppIcon color="black" />
                </WhatsappExternalLink>
            </div>
            {likesAmount === 0 && (
                <div className="flex items-center gap-1">
                    <span className="text-sm font-body-website tracking-tight pl-4">Seja o primeiro! Curte com </span>
                    <Heart size={14} />
                </div>
            )}

            <span className="text-xs font-semibold font-body-website tracking-tight px-4 text-red-500">
                {likesAmount > 0 && `${likesAmount} curtidas`}

            </span>
        </div>
    );
}
