import { useState } from "react";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { useFetcher } from "@remix-run/react";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import { Heart, Share2 } from "lucide-react";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { cn } from "~/lib/utils";

export default function CardapioItemActionBar({ item }: { item: MenuItemWithAssociations }) {
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