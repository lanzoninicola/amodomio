import { Dialog, DialogContent, DialogTrigger, DialogClose } from "~/components/ui/dialog";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { Button } from "~/components/ui/button";
import CardapioItemImage from "../cardapio-item-image/cardapio-item-image";
import CardapioItemPrice from "../cardapio-item-price/cardapio-item-price";
import ItalyIngredientsStatement from "../italy-ingredient-statement/italy-ingredient-statement";
import isItalyProduct from "~/utils/is-italy-product";


interface CardapioItemDialogProps {
    children?: React.ReactNode;
    item: MenuItemWithAssociations;
    triggerComponent?: React.ReactNode;
}


export default function CardapioItemDialog({ item, children, triggerComponent }: CardapioItemDialogProps) {
    return (
        <Dialog >
            <DialogTrigger asChild className="w-full">
                <button>
                    {triggerComponent}
                </button>
            </DialogTrigger>
            <DialogContent className="p-0">
                <CardapioItemImage item={item} withOverlay={false} />
                <div className="p-4">
                    <div className="flex flex-col mb-2">
                        <h3 className="font-body-website text-sm font-semibold uppercase mb-2">{item.name}</h3>
                        {
                            isItalyProduct(item) && <ItalyIngredientsStatement />
                        }
                        <p className="font-body-website leading-tight">{item.ingredients}</p>
                    </div>

                    <CardapioItemPrice prices={item?.priceVariations} cnLabel="text-black items-start" />
                </div>
                {children}
                <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        <span className="font-body-website tracking-wide text-xs font-semibold uppercase">Fechar</span>
                    </Button>
                </DialogClose>
            </DialogContent>
        </Dialog>
    )
}