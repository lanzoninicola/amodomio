import { Separator } from "@radix-ui/react-separator"
import { cn } from "~/lib/utils"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"

interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["priceVariations"]
    cnLabel?: string
}

export default function CardapioItemPrice({ prices, cnLabel }: CardapioItemPriceProps) {

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

                        <div key={p.id} className={
                            cn(
                                "flex flex-col items-center text-white",
                                cnLabel
                            )

                        }>
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