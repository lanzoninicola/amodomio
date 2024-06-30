import { MenuItemPriceVariation } from "@prisma/client"
import { Separator } from "@radix-ui/react-separator"
import { Form, useSubmit } from "@remix-run/react"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"
import { MenuItemFormAction } from "../menu-item-form/menu-item-form"
import { useEffect, useState } from "react"
import { mapPriceVariationsLabel, suggestPriceVariations } from "../../fn.utils"
import { MenuItemPriceVariationLabel } from "../../menu-item-price-variations.prisma.entity.server"

export type MenuItemPriceVariationFormAction = "menu-item-price-variation-update" | "menu-item-price-variation-create"



interface MenuItemPriceVariationFormProps {
    action: MenuItemPriceVariationFormAction,
    price: Omit<MenuItemPriceVariation, "createdAt" | "updatedAt" | "menuItemId">
    basePrice: number
}

export default function MenuItemPriceVariationForm({ action, price, basePrice }: MenuItemPriceVariationFormProps) {

    const [variationPrice, setVariationPrice] = useState(price.amount)
    const [suggestedPrice, setSuggestedPrice] = useState(0)


    useEffect(() => {
        const suggestedPrice = suggestPriceVariations(price.label as MenuItemPriceVariationLabel, basePrice)
        setSuggestedPrice(suggestedPrice)

        if (variationPrice === 0) {
            setVariationPrice(suggestedPrice)
        }

    }, [basePrice])

    return (
        <Form method="post" key={price.id} className="flex items-center gap-x-4
            hover:border-l-2 hover:border-l-muted-foreground hover:px-1
        ">

            <HorizontalLayout
                action={action}
                price={price}
                suggestedPrice={suggestedPrice}
                setVariationPrice={setVariationPrice}
            />



            <Separator orientation="vertical" />
        </Form>
    )
}

interface LayoutProps {
    action: MenuItemPriceVariationFormAction
    price: Omit<MenuItemPriceVariation, "createdAt" | "updatedAt" | "menuItemId">
    suggestedPrice: number
    setVariationPrice: (price: number) => void
}

function VerticalLayout({ action, price, suggestedPrice, setVariationPrice }: LayoutProps) {
    return (
        <div className="flex flex-col gap-1 items-center  p-2 col-span-3" >
            <input type="hidden" name="id" defaultValue={price.id} />

            <Label className="tracking-tight text-xs font-semibold">{`Preço ${mapPriceVariationsLabel(price.label)}`}</Label>

            <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">

                    <Input type="text" name="amount"
                        value={price.amount.toFixed(2)}
                        className={
                            cn(
                                "text-xs md:text-sm text-center w-full py-2",
                                action === "menu-item-price-variation-create" && "border",
                                action === "menu-item-price-variation-update" && "p-0 border-none"
                            )
                        }

                        onChange={(e) => {
                            const value = e.target.value
                            if (isNaN(Number(value))) return

                            setVariationPrice(Number(value))
                        }}
                    />

                    <SaveItemButton actionName={'menu-item-price-variation-update'} labelClassName="text-xs" variant={"outline"} />
                </div>
                <span className="text-xs text-muted-foreground hover:underline hover:cursor-pointer"
                    onClick={() => {
                        setVariationPrice(suggestedPrice)
                    }}
                >{`Sugerido: ${suggestedPrice.toFixed(2) || "0"}`}</span>
            </div>
        </div>


    )
}



function HorizontalLayout({ action, price, suggestedPrice, setVariationPrice }: LayoutProps) {
    return (
        <div className="grid grid-cols-8 items-center w-full" >
            <input type="hidden" name="id" defaultValue={price.id} />

            <Label className="tracking-tight text-xs font-semibold col-span-1">
                {`Tamanho ${mapPriceVariationsLabel(price.label)}`}
            </Label>

            <div className="flex flex-col gap-1 col-span-3">
                <div className="flex gap-8 items-center">


                    <div className="flex flex-col gap-0">
                        <Label className="text-xs text-muted-foreground tracking-tight font-semibold">Preço (R$)</Label>
                        <Input type="text" name="amount"
                            value={price.amount.toFixed(2)}
                            className={
                                cn(
                                    "text-xs md:text-sm text-right w-full py-2 border",
                                )
                            }

                            onChange={(e) => {
                                const value = e.target.value
                                if (isNaN(Number(value))) return

                                setVariationPrice(Number(value))
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-0">
                        <Label className="text-xs text-muted-foreground tracking-tight font-semibold">Desconto (%)</Label>
                        <Input type="text" name="discountPercentage"
                            defaultValue={price.discountPercentage}
                            className={
                                cn(
                                    "text-xs md:text-sm text-right w-full py-2 border",
                                )
                            }
                        />
                    </div>

                    <SaveItemButton actionName={'menu-item-price-variation-update'} className="mt-2" labelClassName="text-xs" variant={"outline"} />
                </div>
                <span className="text-xs text-muted-foreground hover:underline hover:cursor-pointer"
                    onClick={() => {
                        setVariationPrice(suggestedPrice)
                    }}
                >{`Sugerido: ${suggestedPrice.toFixed(2) || "0"}`}</span>
            </div>
        </div>


    )
}




