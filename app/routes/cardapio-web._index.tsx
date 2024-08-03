import { V2_MetaFunction } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { Share2, Heart, LayoutList } from "lucide-react";
import React, { useState, useRef, useCallback } from "react";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { cn } from "~/lib/utils";
import { CardapioOutletContext, loader } from "./cardapio-web";
import { LayoutTemplate } from "lucide-react";

export default function CardapioWebIndex() {
    const { items: allItems } = useOutletContext<CardapioOutletContext>();
    const [items, setItems] = useState(allItems.slice(0, 10));
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef<IntersectionObserver | null>(null);

    const lastItemRef = useCallback((node: HTMLLIElement) => {
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setItems(prevItems => {
                    const newItems = allItems.slice(prevItems.length, prevItems.length + 10);
                    setHasMore(newItems.length > 0);
                    return [...prevItems, ...newItems];
                });
            }
        });
        if (node) observer.current.observe(node);
    }, [hasMore, allItems]);

    return (
        <section >
            {/* <div className="flex gap-8 items-center w-full justify-center py-4">
                <LayoutTemplate />
                <LayoutList />

            </div> */}
            <ul className="flex flex-col overflow-y-scroll md:overflow-y-z  auto snap-mandatory">
                {items.map((item, index) => {
                    if (items.length === index + 1) {
                        return <CardapioItem ref={lastItemRef} key={item.id} item={item} />;
                    } else {
                        return <CardapioItem key={item.id} item={item} />;
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
        <div className="flex flex-col px-4 mb-4">
            <h3 className="font-body-website text-sm font-semibold uppercase mb-2">{item.name}</h3>
            <p className="font-body-website leading-tight">{item.ingredients}</p>
        </div>
        <CardapioItemActionBar item={item} />
        <Separator className="my-4" />
    </li>
));

interface CardapioItemImageProps {
    item: MenuItemWithAssociations;
}

const CardapioItemImage = ({ item }: CardapioItemImageProps) => {

    const Overlay = () => {
        return (
            <div className="absolute inset-0 overflow-hidden rotate-0" style={{
                background: "linear-gradient(180deg, #00000033 60%, #0000009e 75%)"
            }}>
            </div>
        )
    }

    return (
        <div className="relative">
            <img
                src={item.imageBase64 || "/images/cardapio-web-app/placeholder.png"}
                alt={item.name}
                loading="lazy"
                className="w-full max-h-[250px] object-cover object-center"
            />
            <Overlay />
        </div>
    )
}

interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["priceVariations"]
}

function CardapioItemPrice({ prices }: CardapioItemPriceProps) {

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

                        <div key={p.id} className="flex flex-col items-center text-white ">
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
    const [likeIt, setLikeIt] = useState(false);

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-8 font-body-website px-4 mb-1">
                <div className="flex flex-col gap-1 cursor-pointer" onClick={() => setLikeIt(true)}>
                    <Heart
                        className={cn(
                            likeIt ? "fill-red-500" : "fill-none",
                            likeIt ? "stroke-red-500" : "stroke-black"
                        )}
                    />
                </div>
                <WhatsappExternalLink
                    phoneNumber=""
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Essa é a melhor pizzaria da cidade. Experimente..."}
                    className="flex flex-col gap-1 cursor-pointer"
                >
                    <Share2 />
                </WhatsappExternalLink>
                <WhatsappExternalLink
                    phoneNumber="46991272525"
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Olá, gostaria fazer um pedido"}
                    className="flex flex-col gap-1 items-end col-span-6 "
                >
                    <WhatsAppIcon color="black" />
                </WhatsappExternalLink>
            </div>
            <span className="text-sm font-semibold font-body-website tracking-tight px-4">400 Like</span>
        </div>
    );
}
