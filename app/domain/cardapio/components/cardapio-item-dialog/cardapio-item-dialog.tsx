import { Dialog, DialogContent, DialogTrigger, DialogClose } from "~/components/ui/dialog";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { Button } from "~/components/ui/button";
import CardapioItemImage from "../cardapio-item-image/cardapio-item-image";
import CardapioItemPrice from "../cardapio-item-price/cardapio-item-price";
import ItalyIngredientsStatement from "../italy-ingredient-statement/italy-ingredient-statement";
import isItalyProduct from "~/utils/is-italy-product";
import capitalize from "~/utils/capitalize";
import AwardBadge from "~/components/award-badge/award-badge";
import { Separator } from "~/components/ui/separator";


interface CardapioItemDialogProps {
    children?: React.ReactNode;
    item: MenuItemWithAssociations;
    triggerComponent?: React.ReactNode;
}


export default function CardapioItemDialog({ item, children, triggerComponent }: CardapioItemDialogProps) {
    const italyProduct = item.tags?.public.some(t => t.toLocaleLowerCase() === "produtos-italianos")
    const bestMonthlySeller = item.tags?.all.some(t => t.toLocaleLowerCase() === "mais-vendido-mes")
    const bestSeller = item.tags?.all.some(t => t.toLocaleLowerCase() === "mais-vendido")


    return (
        <Dialog>
            <DialogTrigger asChild className="w-full">
                <button>
                    {triggerComponent}
                </button>
            </DialogTrigger>
            <DialogContent className="p-0 bg-transparent border-none">
                <div className="mx-4 bg-white mb-4">
                    <div className="h-[200px] p-4">
                        <CardapioItemImage
                            imageURL={item.imageTransformedURL}
                            withOverlay={false}
                            placeholderImage={true}
                            cnClassName="h-full w-full rounded-none"
                        />
                    </div>
                    <div className="p-4">
                        <div className="flex flex-col gap-0 mb-2">
                            <h3 className="font-body-website text-2xl tracking-wider font-semibold uppercase">{item.name}</h3>
                            <div className="flex flex-col gap-2">
                                {bestSeller && <AwardBadge>A mais desejada</AwardBadge>}
                                {bestMonthlySeller && <AwardBadge>Mais vendida do mes</AwardBadge>}
                            </div>
                        </div>
                        {italyProduct && <ItalyIngredientsStatement cnText="text-lg leading-tight" />}

                        <Separator className="my-4" />

                        <p className="leading-snug text-[15px] mb-6">{capitalize(item.ingredients)}</p>

                        <CardapioItemPrice prices={item?.priceVariations} cnLabel="text-black items-start" showValuta={false} />
                    </div>
                    {children}
                    <DialogClose asChild>
                        <div className="w-full px-4 py-6">
                            <Button type="button" variant="secondary" className="w-full" >
                                <span className=" tracking-wide font-semibold uppercase">Fechar</span>
                            </Button>
                        </div>

                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    )
}