import { MenuItemPriceVariation } from "@prisma/client"
import { Separator } from "@radix-ui/react-separator"
import { Form } from "@remix-run/react"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"
import { MenuItemFormAction } from "../menu-item-form/menu-item-form"
import { useEffect, useState } from "react"
import { MenuItemPriceVariationLabel } from "~/domain/menu-item/menu-item-price-variations.prisma.entity.server"


interface MenuItemPriceVariationFormProps {
    action: MenuItemFormAction
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
        <Form method="post" key={price.id} className="flex gap-x-4 hover:bg-muted hover:rounded-lg">
            <div className="flex flex-col gap-1 items-center  p-2 col-span-3" >
                <input type="hidden" name="id" defaultValue={price.id} />

                <Label className="tracking-tight text-xs font-semibold">{`Preço ${mapPriceVariationsLabel(price.label)}`}</Label>

                <div className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center">

                        <Input type="text" name="amount"
                            value={variationPrice.toFixed(2)}
                            className={
                                cn(
                                    "text-xs md:text-sm text-center w-full py-2",
                                    action === "menu-item-create" && "border",
                                    action === "menu-item-update" && "p-0 border-none"
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
                            console.log("suggestion clicked", suggestedPrice, variationPrice)
                        }}
                    >{`Sugerido: ${suggestedPrice.toFixed(2) || "0"}`}</span>
                </div>
            </div>



            <Separator orientation="vertical" />
        </Form>
    )
}



export function mapPriceVariationsLabel(label: string): string {
    if (label === "media") {
        return "Média";
    }

    if (label === "familia") {
        return "Família";
    }

    if (label === "fatia") {
        return "Fatía";
    }

    if (label === "individual") {
        return "Individual";
    }

    return "Não definido";
}



function suggestPriceVariations(variation: MenuItemPriceVariationLabel, priceRef: number): number {

    const priceRanges: Record<string, number[]> = {
        '69.9': [69.90, 149.90],
        '79.9': [79.90, 159.90,],
        '89.9': [89.90, 179.90,],
        '99.9': [99.90, 189.90,],
        '119.9': [119.90, 219.90,],
    }

    const range = priceRanges[String(priceRef)]

    console.log('suggestPriceVariations', priceRef)

    const media = range ? range[0] : 0
    const familia = range ? range[1] : 0
    const individual = priceRef > 0 ? priceRef / 1.75 : 0
    const fatia = priceRef > 0 ? familia / 8 : 0

    const suggestPrice = {
        'media': media,
        'familia': familia,
        'individual': individual,
        'fatia': fatia
    }

    return suggestPrice[variation] ? suggestPrice[variation] : 0

}