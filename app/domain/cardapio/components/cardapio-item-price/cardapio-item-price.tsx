import { Separator } from "@radix-ui/react-separator"
import { cn } from "~/lib/utils"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"

interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["MenuItemSellingPriceVariation"]
    showValuta?: boolean
    cnLabel?: string
    cnValue?: string
}

export default function CardapioItemPrice({ prices, cnLabel, cnValue, showValuta = true }: CardapioItemPriceProps) {

    const lastIndex = prices.length - 1
    const colsNumber = prices.length

    return (
        <div className={
            cn(
                "grid gap-x-6",
                isNaN(colsNumber) ? "grid-cols-3" : `grid-cols-${colsNumber}`
            )
        }>
            {
                prices.filter(p => p.showOnCardapio === true)
                    .sort((a, b) => a.MenuItemSize.sortOrderIndex - b.MenuItemSize.sortOrderIndex)
                    .map((p, idx) => {

                        return (

                            <div key={p.id} className={
                                cn(
                                    "flex flex-col items-center gap-1",
                                    lastIndex === idx && "order-last"

                                )

                            }>
                                <span className={
                                    cn(
                                        "uppercase text-[12px] text-muted-foreground leading-[1.1]",
                                        cnLabel
                                    )
                                }>{p?.MenuItemSize?.shortDescription}</span>
                                <div className={
                                    cn(
                                        "flex items-end gap-[2px] text-muted-foreground",
                                        cnValue
                                    )
                                }>
                                    {showValuta && <span className="text-[12px]">R$</span>}
                                    <span className="text-[13px]">{p?.priceAmount}</span>
                                </div>
                            </div>
                        )


                    })
            }

        </div>
    )
}