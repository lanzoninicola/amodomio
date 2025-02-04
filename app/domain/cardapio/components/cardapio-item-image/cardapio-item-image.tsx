import { cn } from "~/lib/utils";

interface CardapioItemImageProps {
    imageURL?: string
    cnClassName?: string
    cnImage?: string
    withOverlay?: boolean
    placeholderImage?: boolean
}

export default function CardapioItemImage({ imageURL, cnClassName, cnImage, withOverlay = false, placeholderImage = false }: CardapioItemImageProps) {

    if (placeholderImage === true && !imageURL) {
        imageURL = "/images/cardapio-web-app/pizza-placeholder-sm.png"
    }

    const Overlay = () => {
        return (
            <div className="absolute inset-0 overflow-hidden rotate-0" style={{
                background: "linear-gradient(180deg, #00000033 60%, #0000009e 75%)"
            }}>
            </div>
        )
    }


    return (
        <div className={
            cn(
                "relative",
                withOverlay && "overflow-hidden",
                cnClassName
            )
        } data-element="cardapio-item-image">
            <div className={
                cn(
                    "bg-center bg-cover bg-no-repeat h-full w-full",
                    cnImage
                )
            }
                style={{
                    backgroundImage: `url(${imageURL})`,
                }}>

            </div>
            {withOverlay && <Overlay />}
        </div>
    )
}


