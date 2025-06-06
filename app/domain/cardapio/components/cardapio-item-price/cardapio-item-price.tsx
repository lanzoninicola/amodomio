import { Separator } from "@radix-ui/react-separator"
import { cn } from "~/lib/utils"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"

interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["priceVariations"]
    showValuta?: boolean
    cnLabel?: string
    cnValue?: string
}

export default function CardapioItemPrice({ prices = [], cnLabel, cnValue, showValuta = true }: CardapioItemPriceProps) {

    const visiblePrices = prices.filter(p => p.showOnCardapio === true) || []
    const lastIndex = visiblePrices.length - 1
    const colsNumber = visiblePrices.length

    return (
        <div className={
            cn(
                "grid gap-x-2",
                isNaN(colsNumber) ? "grid-cols-3" : `grid-cols-${colsNumber}`
            )
        }>
            {
                visiblePrices.map((p, idx) => {

                    return (

                        <div key={p.id} className={
                            cn(
                                "flex items-center gap-2",
                                lastIndex === idx && "order-last"

                            )

                        }>
                            <span className={
                                cn(
                                    "uppercase text-[12px] text-muted-foreground",
                                    cnLabel
                                )
                            }>{p?.label}</span>
                            <div className={
                                cn(
                                    "flex items-center gap-[2px] text-muted-foreground",
                                    cnValue
                                )
                            }>
                                {showValuta && <span className="text-[12px]">R$</span>}
                                <span className="text-[13px]">{p?.amount}</span>
                            </div>
                        </div>
                    )


                })
            }

        </div>
    )
}