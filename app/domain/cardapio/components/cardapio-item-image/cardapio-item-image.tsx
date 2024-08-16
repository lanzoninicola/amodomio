import ItalyFlag from "~/components/italy-flag/italy-flag";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";

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
        <div className="relative ">
            <img
                src={item.imageTransformedURL || "/images/cardapio-web-app/placeholder.png"}
                alt={item.name}
                loading="lazy"
                className="w-full max-h-[250px] object-cover object-center rounded-t-lg"
            />
            {withOverlay && <Overlay />}
            {italyProduct && <ItalyFlagOverlay />}
        </div>
    )
}

export default CardapioItemImage