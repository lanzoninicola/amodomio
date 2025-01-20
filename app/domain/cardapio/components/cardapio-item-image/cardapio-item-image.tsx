import ItalyFlag from "~/components/italy-flag/italy-flag";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { cn } from "~/lib/utils";

interface CardapioItemImageProps {
    item: MenuItemWithAssociations;
    withOverlay?: boolean;
    cnImage?: string;
}

const CardapioItemImage = ({ item, withOverlay = true, cnImage }: CardapioItemImageProps) => {


    const Overlay = () => {
        return (
            <div className="absolute inset-0 overflow-hidden rotate-0" style={{
                background: "linear-gradient(180deg, #00000033 60%, #0000009e 75%)"
            }}>
            </div>
        )
    }



    return (
        <div className="relative ">
            {
                item.imageTransformedURL ?
                    <img
                        src={item.imageTransformedURL}
                        alt={item.name}
                        loading="lazy"
                        className={
                            cn(
                                "w-full max-h-[250px] object-cover object-center",
                                cnImage
                            )
                        }
                    />
                    :
                    <div className={
                        cn(
                            "w-full h-[250px] object-cover object-center",
                            "bg-slate-50",
                            cnImage
                        )
                    }></div>
            }

            {withOverlay && <Overlay />}
        </div>
    )
}

export default CardapioItemImage