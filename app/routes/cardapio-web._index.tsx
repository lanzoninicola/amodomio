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

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "title",
            content: "Cardápio Pizzaria A Modo Mio - Pato Branco",
        }
    ];
};


export async function loader({ request }: LoaderArgs) {
    const [errItems, items] = await prismaIt(menuItemPrismaEntity.findAll({}))

    if (errItems) {
        return badRequest(errItems)
    }

    const [_, tags] = await prismaIt(menuItemTagPrismaEntity.findAllDistinct())

    return ok({ items, tags })

}


export default function CardapioWebIndex() {

    const loaderData = useLoaderData<typeof loader>()
    const items = loaderData?.payload.items as MenuItemWithAssociations[] || []

    return (
        <div className="flex flex-col gap-4 mt-[60px]">
            {
                items.map((item) => (
                    <CardapioItem key={item.id} item={item} />
                ))
            }

        </div>
    )
}


function CardapioItem({ item }: { item: MenuItemWithAssociations }) {

    console.log({ item })



    return (
        <div className="flex flex-col gap-2 mb-6">
            <div className="flex gap-2 items-center px-4">
                <img src="images/cardapio-web-app/item-placeholder.png" alt={`Imagem do sabor ${item.name}`}
                    className="w-[16px] h-[16px] rounded-full"
                />
                <h3 className="font-body-website font-semibold">{item.name}</h3>
            </div>
            <div
                className="h-[200px] bg-cover bg-center mb-2"
                style={{
                    backgroundImage: `url(${item.imageBase64 || "images/cardapio-web-app/item-placeholder.png"})`
                }}></div>
            <CardapioItemActionBar item={item} />
            <span className="font-semibold font-body-website tracking-tight px-4">400 Like</span>
        </div>
    )
}



interface CardapioItemActionBarProps {
    item: MenuItemWithAssociations
}

function CardapioItemActionBar({ item }: CardapioItemActionBarProps) {

    const [likeIt, setLikeIt] = useState(false)

    return (
        <div className="grid grid-cols-8 font-body-website px-4 mb-2">

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
    )
}

