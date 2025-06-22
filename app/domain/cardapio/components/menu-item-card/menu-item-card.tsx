import { Form, Link } from "@remix-run/react"
import { AlertCircle, ChevronRight, Loader } from "lucide-react"
import { OveredPoint } from "../menu-item-list/menu-item-list"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { mapPriceVariationsLabel } from "../../fn.utils"
import { Switch } from "~/components/ui/switch"
import React, { useState } from "react"
import { Button } from "~/components/ui/button"
import { toast } from "~/components/ui/use-toast"
import { MenuItemPriceVariation } from "@prisma/client"
import MenuItemPriceVariationUtility from "../../menu-item-price-variations-utility"
import randomReactKey from "~/utils/random-react-key"
import { cn } from "~/lib/utils"
import useFormSubmissionnState from "~/hooks/useFormSubmissionState"
import MenuItemSwitchVisibility from "../menu-item-switch-visibility/menu-item-switch-visibility"
import MenuItemSwitchActivation from "../menu-item-switch-activation.tsx/menu-item-switch-activation"
import MenuItemSwitchUpcomingSubmit from "../menu-item-switch-upcoming/menu-item-switch-upcoming-submit"


interface MenuItemCardProps {
    item: MenuItemWithAssociations
    dragAndDrop?: {
        itemDragging: MenuItemWithAssociations | null
        itemOvered: MenuItemWithAssociations | null
        overedPoint: OveredPoint
    }
}

export default function MenuItemCard({ item, dragAndDrop }: MenuItemCardProps) {

    // const missingInfo = !item?.name || !item?.ingredients

    // const [searchParams, setSearchParams] = useSearchParams()
    // const action = searchParams.get("_action")

    const featuredImage = item?.MenuItemGalleryImage?.find(img => img.isPrimary)

    function copyItemId() {
        navigator.clipboard.writeText(item.id)

        toast({
            title: "ID copiado",
        })
    }

    function copyIngredients() {
        navigator.clipboard.writeText(item.ingredients)

        toast({
            title: "Ingredientes copiados",
        })
    }


    return (

        <div className="p-4 rounded-md border border-gray-200 bg-white w-full">
            <div className="flex flex-col gap-2">
                <section className="flex flex-col gap-2 md:grid md:grid-cols-12 md:items-center w-full">

                    <div className="hidden md:block w-16 h-16 bg-muted rounded-lg bg-center bg-no-repeat bg-cover col-span-1">
                        {featuredImage?.thumbnailUrl ?
                            <img src={featuredImage?.thumbnailUrl} alt={`Imagem so sabor ${item?.name}`} className="w-full h-full object-cover rounded-lg" />
                            :
                            <div className="w-full h-full bg-muted rounded-lg" />
                        }
                    </div>
                    <div className="flex items-center col-span-5 gap-2">
                        <div className="flex flex-col gap-0">
                            <h4 className="text-lg font-bold tracking-tight leading-9 md:leading-7">
                                {item.name}
                            </h4>
                            {/* <span className="text-[10px] text-muted-foreground cursor-pointer" onClick={copyItemId}>{item.id}</span> */}
                            <span className="text-[12px] md:text-[10px] leading-tight text-muted-foreground cursor-pointer max-w-[350px]" onClick={copyIngredients}>{item.ingredients}</span>
                        </div>
                    </div>

                    <div className="flex gap-4 col-span-5">
                        <MenuItemSwitchUpcomingSubmit menuItem={item} cnLabel="leading-[1.2]" />
                        <MenuItemSwitchActivation menuItem={item} cnContainer="md:justify-start" />
                        <MenuItemSwitchVisibility menuItem={item} />
                    </div>

                    <div className="col-span-1 flex justify-end">
                        <Link to={`/admin/gerenciamento/cardapio/${item?.id}/main`} className="hover:bg-muted rounded-full p-1">
                            <ChevronRight />
                        </Link>
                    </div>

                </section>

                {item.visible === true && !item.mogoId && <MissingInfoAlert message="Item publicado mas sem MOGO ID" />}
            </div>
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
                                className={
                                    cn(
                                        "text-[9px] h-[20px] rounded-md font-semibold uppercase tracking-wide",
                                        pv.showOnCardapio && "bg-green-500 text-black"
                                    )
                                }
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
    message: string
}

function MissingInfoAlert({ message }: MissingInfoAlertProps) {
    return (
        <div className=" bg-orange-100 rounded-md py-2 px-4 mt-4 w-max">
            <div className="flex gap-2 items-center">
                <AlertCircle color="orange" size={16} />
                <span className="text-xs font-semibold text-orange-500">{message}</span>
            </div>
        </div>
    )
}