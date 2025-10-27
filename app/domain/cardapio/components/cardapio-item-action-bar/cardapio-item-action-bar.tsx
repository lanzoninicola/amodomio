import { useState } from "react";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { useFetcher } from "@remix-run/react";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import { Heart, Share2 } from "lucide-react";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { cn } from "~/lib/utils";
import { useSoundEffects } from "~/components/sound-effects/use-sound-effects";
import { Button } from "~/components/ui/button";

interface CardapioItemActionBarProps { item: MenuItemWithAssociations, cnContainer?: string }

export function CardapioItemActionBarVertical({ item, cnContainer }: CardapioItemActionBarProps) {

    const [likeIt, setLikeIt] = useState(false)
    const [likesAmount, setLikesAmount] = useState(item.likes?.amount || 0)
    const [sharesAmount, setSharesAmount] = useState(item.shares?.amount || 0)
    const { playTap } = useSoundEffects();

    const fetcher = useFetcher();

    const likingIt = () => {
        playTap()

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
        playTap()

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
        <div className={cn("flex flex-col gap-0 my-2 justify-end", cnContainer)} data-element="action-bar">
            <div className="flex flex-col gap-4 justify-center font-neue">
                <WhatsappExternalLink
                    phoneNumber="46991272525"
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Olá, gostaria fazer um pedido"}
                    className="flex flex-col gap-1 items-center cursor-pointer p-1 active:bg-black/50"
                >
                    <WhatsAppIcon color="white" />
                </WhatsappExternalLink>
                <div className="flex flex-col gap-2 items-center">

                    <div className="flex flex-col gap-1 cursor-pointer p-1 active:bg-black/50 " onClick={shareIt}>
                        <Share2 color="white" />
                        <span className="text-md text-center font-neue tracking-widest font-semibold uppercase text-white">
                            {sharesAmount > 0 && `${sharesAmount}`}
                        </span>
                    </div>
                    <div className="flex flex-col items-center gap-1 cursor-pointer p-1 active:bg-black/50" onClick={likingIt}>
                        <Heart
                            className={cn(
                                "stroke-white",
                                likeIt ? "fill-red-500" : "fill-none",
                                likeIt ? "stroke-red-500" : "stroke-white",
                                item.likes?.amount && item.likes?.amount > 0 ? "stroke-red-500" : "stroke-white"
                            )}
                        />
                        <span className="text-md text-center font-neue tracking-widest font-semibold uppercase text-red-500">
                            {likesAmount > 0 && `${likesAmount}`}

                        </span>
                    </div>
                </div>


            </div>
            {/* {likesAmount === 0 && (
                <div className="flex items-center gap-1">
                    <span className="text-sm font-neue tracking-widest font-semibold uppercase">Seja o primeiro! Curte com </span>
                    <Heart size={14} />
                </div>
            )} */}

            {/* <span className="text-sm font-neue tracking-widest font-semibold uppercase pl-1 text-red-500">
                {likesAmount > 0 && `${likesAmount} curtidas`}

            </span> */}
        </div>
    );
}


export function CardapioItemActionBarHorizontal({ item, cnContainer }: CardapioItemActionBarProps) {
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
        <div className="flex flex-col gap-0 my-2">
            <div className="grid grid-cols-2 font-neue">
                <div className="flex items-center">
                    <div className="flex flex-col gap-1 cursor-pointer p-2 active:bg-black/50" onClick={likingIt}>
                        <Heart
                            className={cn(
                                likeIt ? "fill-red-500" : "fill-none",
                                likeIt ? "stroke-red-500" : "stroke-black",
                                item.likes?.amount && item.likes?.amount > 0 ? "stroke-red-500" : "stroke-black"
                            )}
                        />
                    </div>
                    <div className="flex flex-col gap-1 cursor-pointer p-2 active:bg-black/50 " onClick={shareIt}>
                        <Share2 />
                    </div>
                </div>

                <WhatsappExternalLink
                    phoneNumber="46991272525"
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Olá, gostaria fazer um pedido"}
                    className="flex flex-col gap-1 items-end cursor-pointer p-2 active:bg-black/50"
                >
                    <WhatsAppIcon color="black" />
                </WhatsappExternalLink>
            </div>
            {likesAmount === 0 && (
                <div className="flex items-center gap-1">
                    <span className="text-sm font-neue tracking-widest font-semibold uppercase">Seja o primeiro! Curte com </span>
                    <Heart size={14} />
                </div>
            )}

            <span className="text-sm font-neue tracking-widest font-semibold uppercase pl-1 text-red-500">
                {likesAmount > 0 && `${likesAmount} curtidas`}

            </span>
        </div>
    );
}

export function ShareIt({ item, size, children, cnContainer }: { item: MenuItemWithAssociations, size?: number, children?: React.ReactNode, cnContainer?: string }) {

    const fetcher = useFetcher();

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
        <Button
            variant="ghost"
            className={
                cn(
                    "flex gap-2 ",
                    cnContainer
                )
            } onClick={shareIt}>
            <Share2 size={size ?? 16} />
            {children}
        </Button>
    )
}

export function LikeIt({ item, size, cnLabel, children, cnContainer }: { item: MenuItemWithAssociations, size?: number, cnLabel?: string, children?: React.ReactNode, cnContainer?: string }) {
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
    return (
        <Button
            variant={"ghost"}
            className={cn("flex items-center cursor-pointer", cnContainer)} onClick={likingIt}>
            {children}
            <Heart
                size={size ?? 16}
                className={cn(
                    likeIt ? "fill-red-500" : "fill-none",
                    likeIt ? "stroke-red-500" : "stroke-black",
                    item.likes?.amount && item.likes?.amount > 0 ? "stroke-red-500" : "stroke-black"
                )}
            />
            <span className={
                cn(
                    "text-xs font-neue font-medium tracking-widest uppercase pl-1 text-red-500",
                    cnLabel
                )
            }>
                {likesAmount > 0 && `${likesAmount}`}

            </span>
        </Button>
    )
}

export function WhatsAppIt() {
    return (
        <WhatsappExternalLink
            phoneNumber="46991272525"
            ariaLabel="Envia uma mensagem com WhatsApp"
            message={"Olá, gostaria fazer um pedido"}
            className="flex flex-col gap-1 items-end cursor-pointer p-2 active:bg-black/50"
        >
            <WhatsAppIcon color="black" />
        </WhatsappExternalLink>
    )
}