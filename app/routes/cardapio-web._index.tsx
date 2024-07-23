import { MenuItemPriceVariation } from "@prisma/client";
import { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Share2, Heart, MenuSquare } from "lucide-react";
import { useState } from "react";
import TypewriterComponent from "typewriter-effect";
import ExternalLink from "~/components/primitives/external-link/external-link";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import { menuItemTagPrismaEntity } from "~/domain/cardapio/menu-item-tags.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import toLowerCase from "~/utils/to-lower-case";

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "title",
            content: "Cardápio Pizzaria A Modo Mio - Pato Branco",
        }
    ];
};


export async function loader({ request }: LoaderArgs) {
    const [errItems, items] = await prismaIt(menuItemPrismaEntity.findAll({
        where: {
            visible: true
        },
        option: {
            sorted: true,
            direction: "asc"
        }
    }))

    if (errItems) {
        return badRequest(errItems)
    }

    const [_, tags] = await prismaIt(menuItemTagPrismaEntity.findAllDistinct())

    return ok({ items, tags })

}

// TODO: page if a generic error occured

export default function CardapioWebIndex() {

    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []

    return (
        <div className="flex flex-col mt-[60px]">
            {
                items.map((item) => (
                    <CardapioItem key={item.id} item={item} />
                ))
            }

        </div>
    )
}


function CardapioItem({ item }: { item: MenuItemWithAssociations }) {



    return (
        <>
            <div className="flex flex-col gap-2">
                <div className="flex flex-col px-4">
                    <div className="flex gap-2 items-center">
                        <img src="images/cardapio-web-app/item-placeholder.png" alt={`Imagem do sabor ${item.name}`}
                            className="w-[16px] h-[16px] rounded-full"
                        />

                        <h3 className="font-body-website font-semibold uppercase leading-tight">{item.name}</h3>

                    </div>
                    <p className="text-sm">{item.ingredients}</p>
                </div>
                <div className="relative mb-2">
                    <CardapioItemImage item={item} />
                    <div className="absolute bottom-0 inset-x-0 py-4 px-2">
                        <CardapioItemPrice prices={item?.priceVariations} />
                    </div>
                </div>
                <CardapioItemActionBar item={item} />

            </div>
            <Separator className="my-4" />

        </>

    )
}

interface CardapioItemImageProps {
    item: MenuItemWithAssociations
}

function CardapioItemImage({ item }: CardapioItemImageProps) {

    // const imageUrl = item?.imageBase64 || `images/cardapio-web-app/${toLowerCase(item.name)}.jpg`
    // const imageUrl = `images/cardapio-web-app/margherita.jpg`

    function getImageFileName(str: string) {
        if (str === undefined) return str;

        if (str.length === 0) return str;

        return str.toLocaleLowerCase().replace(/ /g, '_');
    }


    const Overlay = () => {
        return (
            <div className="absolute inset-0" style={{
                transform: "rotate(0deg)",
                overflow: "hidden",
                background: "linear-gradient(180deg, #00000033 60%, #0000009e 75%)"
            }}>
            </div>
        )
    }

    return (
        <div className="relative">
            <div
                className="h-[300px] bg-cover bg-center mb-2"
                style={{
                    backgroundImage: `url('images/cardapio-web-app/${getImageFileName(item.name)}.jpg')`,
                }}>
            </div>
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
            </div>
            <span className="text-sm font-semibold font-body-website tracking-tight px-4">400 Like</span>
        </div>

    )
}

