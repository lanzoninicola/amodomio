import { V2_MetaFunction } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { Share2, Heart } from "lucide-react";
import { useState } from "react";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { cn } from "~/lib/utils";
import { CardapioOutletContext, loader } from "./cardapio-web";





// TODO: page if a generic error occured

export default function CardapioWebIndex() {

    const { items } = useOutletContext<CardapioOutletContext>()

    return (
        <ul className="flex flex-col mt-[60px] overflow-y-scroll snap-mandatory">
            {
                items.map((item) => (
                    <CardapioItem key={item.id} item={item} />
                ))
            }

        </ul>
    )
}


function CardapioItem({ item }: { item: MenuItemWithAssociations }) {



    return (
        <>
            <li className="flex flex-col snap-start" id={item.id}>

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
            </li>
            <Separator className="my-4" />

        </>

    )
}

interface CardapioItemImageProps {
    item: MenuItemWithAssociations
}

function CardapioItemImage({ item }: CardapioItemImageProps) {

    const imageUrl = item?.imageBase64 || `images/cardapio-web-app/placeholder.png`

    const Overlay = () => {
        return (
            <div className="absolute inset-0 overflow-hidden rotate-0" style={{
                background: "linear-gradient(180deg, #00000033 60%, #0000009e 75%)"
            }}>
            </div>
        )
    }

    const SmokeOverlay = () => {
        return (
            <div
                className="absolute inset-0 z-20 overflow-hidden rotate-0"
                style={{ backgroundImage: `url(images/cardapio-web-app/smoke.gif)` }}>
            </div>
        )
    }

    return (
        <div className="relative">
            <div
                className="h-[300px] bg-center bg-no-repeat bg-cover mb-2"
                style={{ backgroundImage: `url(${imageUrl || ""})` }}>
            </div>
            <Overlay />
            {/* <SmokeOverlay /> */}
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



interface CardapioItemActionBarProps {
    item: MenuItemWithAssociations
}

function CardapioItemActionBar({ item }: CardapioItemActionBarProps) {

    const [likeIt, setLikeIt] = useState(false)

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-8 font-body-website px-4 mb-1">

                <div className="flex flex-col gap-1 cursor-pointer" onClick={() => {
                    setLikeIt(true)
                }}>
                    <Heart className={
                        cn(
                            likeIt ? "fill-red-500" : "fill-none",
                            likeIt ? "stroke-red-500" : "stroke-black"
                        )
                    } />
                    {/* <span className={
                    cn(
                        "text-[12px] tracking-normal font-semibold",
                        likeIt ? "text-red-500" : "text-black"
                    )
                }>Curtir</span> */}
                </div>

                <WhatsappExternalLink phoneNumber=""
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Essa é a melhor pizzaria da cidade. Experimente..."}
                    className="flex flex-col gap-1 cursor-pointer"
                >
                    <Share2 />
                    {/* <span className="text-[12px] tracking-normal font-semibold">Compartilhe</span> */}
                </WhatsappExternalLink>
                <WhatsappExternalLink phoneNumber="46991272525"
                    ariaLabel="Envia uma mensagem com WhatsApp"
                    message={"Olá, gostaria fazer um pedido"}
                    className="flex flex-col gap-1 items-end col-span-6 "
                >
                    <WhatsAppIcon color="black" />
                    {/* <span className="text-[10px] tracking-wide  font-body-website">Atendimento</span> */}
                </WhatsappExternalLink>
            </div>
            <span className="text-sm font-semibold font-body-website tracking-tight px-4">400 Like</span>
        </div>

    )
}

