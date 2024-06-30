import { Link, useOutletContext } from "@remix-run/react"
import { AlertCircle, ChevronRight } from "lucide-react"
import { AdminCardapioOutletContext } from "~/routes/admin.gerenciamento.cardapio"
import { OveredPoint } from "../menu-item-list/menu-item-list"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { mapPriceVariationsLabel } from "../../fn.utils"
import { Switch } from "~/components/ui/switch"


interface MenuItemCardProps {
    item: MenuItemWithAssociations
    dragAndDrop?: {
        itemDragging: MenuItemWithAssociations | null
        itemOvered: MenuItemWithAssociations | null
        overedPoint: OveredPoint
    }
}

export default function MenuItemCard({ item, dragAndDrop }: MenuItemCardProps) {
    const outletContext: AdminCardapioOutletContext = useOutletContext()
    // const missingInfo = !item?.name || !item?.ingredients

    // const [searchParams, setSearchParams] = useSearchParams()
    // const action = searchParams.get("_action")



    return (

        <div className="p-4 rounded-md border border-gray-200 bg-white w-full">
            <section className="grid grid-cols-12 items-center w-full">
                <div className="flex items-center col-span-4 gap-2">
                    <h4 className="text-lg font-bold tracking-tight">
                        {item.name}
                    </h4>
                </div>
                <div className="grid grid-cols-4 col-span-4">
                    {item && item.priceVariations.map(pv => {
                        return (
                            <div key={pv.id} className="flex flex-col justify-center">
                                <span className="text-xs text-muted-foreground">{mapPriceVariationsLabel(pv.label)}</span>
                                <span className="text-sm font-semibold">{pv.amount.toFixed(2)}</span>
                            </div>
                        )

                    })}
                </div>

                <div className="flex justify-between md:justify-end gap-4 w-full items-center mt-2 col-span-3">
                    <span className="font-semibold text-sm">Públicar no cardápio</span>
                    <Switch id="visible" name="visible" defaultChecked={item?.visible || false} />
                </div>

                <div className="col-span-1 flex justify-end">
                    <Link to={`${item?.id}/main`}>
                        <ChevronRight />
                    </Link>
                </div>

            </section>
        </div>

    )
}


interface MissingInfoAlertProps {
    item: MenuItemWithAssociations
}

function MissingInfoAlert({ item }: MissingInfoAlertProps) {
    return (
        <div className=" bg-orange-100 rounded-md py-2 px-4 mt-4">
            <div className="flex gap-2 items-center">
                <AlertCircle color="orange" size={16} />
                <div className="flex flex-col gap-1">
                    {(item?.name === undefined || item.name === "") && <span className="text-xs font-semibold text-orange-500">Nome não cadastrado</span>}
                    {/* {(item?.prices === undefined || item.prices.length === 0) && <span className="text-xs font-semibold text-orange-500">Preço não cadastrado</span>} */}
                    {(item?.ingredients === undefined || item.ingredients.length === 0) && <span className="text-xs font-semibold text-orange-500">Ingredientes não cadastrados</span>}
                </div>

            </div>
        </div>
    )
}