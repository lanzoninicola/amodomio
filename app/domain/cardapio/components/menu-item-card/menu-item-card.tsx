import { Form, Link, useOutletContext } from "@remix-run/react"
import { AlertCircle, ChevronRight, Loader } from "lucide-react"
import { AdminCardapioOutletContext } from "~/routes/admin.gerenciamento.cardapio"
import { OveredPoint } from "../menu-item-list/menu-item-list"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { mapPriceVariationsLabel } from "../../fn.utils"
import { Switch } from "~/components/ui/switch"
import React, { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { toast } from "~/components/ui/use-toast"
import { MenuItemPriceVariationPrismaEntity } from "../../menu-item-price-variations.prisma.entity.server"
import { MenuItemPriceVariation } from "@prisma/client"
import MenuItemPriceVariationUtility from "../../menu-item-price-variations-utility"
import randomReactKey from "~/utils/random-react-key"
import { cn } from "~/lib/utils"
import useFormSubmissionnState from "~/hooks/useFormSubmissionState"


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

    const [visible, setVisible] = useState(false)
    const submitBtnRef = React.useRef<HTMLButtonElement>(null)

    function handleVisibility() {

        setVisible(!visible)

        if (submitBtnRef.current) {
            submitBtnRef.current.click()
        }
    }

    function copyItemId() {
        navigator.clipboard.writeText(item.id)

        toast({
            title: "ID copiado",
        })
    }


    return (

        <div className="p-4 rounded-md border border-gray-200 bg-white w-full">
            <section className="grid grid-cols-12 items-center w-full">
                <div className="flex items-center col-span-4 gap-2">
                    <div className="flex flex-col gap-0">
                        <h4 className="text-lg font-bold tracking-tight">
                            {item.name}
                        </h4>
                        <span className="text-[10px] text-muted-foreground cursor-pointer" onClick={copyItemId}>{item.id}</span>
                    </div>
                </div>
                <div className="grid grid-cols-5 col-span-4 gap-x-2">
                    <div className="flex flex-col justify-start items-center  gap-1 mr-2">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Base</span>
                        <input type="text" name="price" defaultValue={item.basePriceAmount.toFixed(2)}
                            className="border-none outline-none w-full text-[0.75rem] text-center bg-muted rounded-sm" />
                    </div>
                    <PriceVariationsInCard item={item} />
                </div>

                <div className="mt-2 col-span-3">
                    <Form method="post" className="flex justify-between md:justify-end gap-4 w-full items-center ">

                        <span className="font-semibold text-sm">Públicar no cardápio</span>
                        <Switch defaultChecked={item?.visible || false} onCheckedChange={handleVisibility} />
                        <input type="hidden" name="id" value={item?.id} />
                        <button ref={submitBtnRef} className="hidden" type="submit" value={"menu-item-visibility-change"} name="_action" />

                    </Form>
                </div>

                <div className="col-span-1 flex justify-end">
                    <Link to={`${item?.id}/main`} className="hover:bg-muted rounded-full p-1">
                        <ChevronRight />
                    </Link>
                </div>

            </section>
        </div>

    )
}

function PriceVariationsInCard({ item }: { item: MenuItemWithAssociations }) {

    let priceVariations = MenuItemPriceVariationUtility.getInitialPriceVariations().map((pv: MenuItemPriceVariation) => {
        return {
            ...pv,
            menuItemId: item.id,
            basePrice: item.basePriceAmount,
            amount: item.priceVariations.find(p => p.label === pv.label)?.amount || 0,
            discountPercentage: item.priceVariations.find(p => p.label === pv.label)?.discountPercentage || 0,
            showOnCardapio: item.priceVariations.find(p => p.label === pv.label)?.showOnCardapio || false
        }
    })

    const formSubmission = useFormSubmissionnState()



    return (
        <>
            {priceVariations.map(pv => {
                return (
                    <Form method="post" key={randomReactKey()} className="flex flex-col justify-center">
                        <div key={pv.id} className={
                            cn(
                                "flex flex-col justify-center items-center  gap-1",
                                pv.showOnCardapio && "bg-green-200"
                            )
                        }>
                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{mapPriceVariationsLabel(pv.label)}</span>
                            <input type="text" name="amount" defaultValue={pv.amount.toFixed(2)}
                                className="border-none outline-none w-full text-[0.75rem] text-center bg-muted rounded-sm" />
                            <input type="hidden" name="id" value={pv.id} />
                            <input type="hidden" name="menuItemId" value={item.id} />
                            <input type="hidden" name="label" value={pv.label} />
                            <Button size={"sm"} type="submit" name="_action"
                                value="menu-item-card-price-upsert"
                                className="text-[9px] h-[20px] rounded-md font-semibold uppercase tracking-wide"
                            >
                                {
                                    formSubmission === "loading" ? <Loader className="animate-spin" size={12} /> : "Salvar"
                                }
                            </Button>
                        </div>
                    </Form>
                )

            })}
        </>
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