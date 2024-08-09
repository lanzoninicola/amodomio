import { MenuItemPriceVariation } from "@prisma/client"
import { Form } from "@remix-run/react"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"
import { useEffect, useState } from "react"
import { mapPriceVariationsLabel, suggestPriceVariations } from "../../fn.utils"
import { MenuItemPriceVariationLabel } from "../../menu-item-price-variations.prisma.entity.server"
import { Switch } from "~/components/ui/switch"
import { formatDate } from "date-fns"
import { jsonStringify } from "~/utils/json-helper"
import { Separator } from "~/components/ui/separator"

export type MenuItemPriceVariationFormAction = "menu-item-price-variation-update" | "menu-item-price-variation-create"



interface MenuItemPriceVariationFormProps {
    action: MenuItemPriceVariationFormAction,
    price: Omit<MenuItemPriceVariation, "createdAt" | "menuItemId">
    basePrice: number
    loggedUser?: string
}

export default function MenuItemPriceVariationForm({ action, price, basePrice, loggedUser }: MenuItemPriceVariationFormProps) {
    const [variationPriceAmount, setVariationPrice] = useState(price.amount)
    const [suggestedPrice, setSuggestedPrice] = useState(0)


    useEffect(() => {
        const suggestedPrice = suggestPriceVariations(price.label as MenuItemPriceVariationLabel, basePrice)
        setSuggestedPrice(suggestedPrice)

        if (variationPriceAmount === 0) {
            setVariationPrice(suggestedPrice)
        }

    }, [basePrice])

    return (
        <Form method="post">

            <div className="grid grid-cols-8 items-center w-full p-2 hover:bg-muted" >
                <input type="hidden" name="id" defaultValue={price.id} />
                <input type="hidden" name="latestAmount" defaultValue={price.amount} />
                <input type="hidden" name="updatedBy" defaultValue={jsonStringify(loggedUser)} />


                <div className="flex flex-col gap-1 col-span-2">
                    <Label className="tracking-tight text-xs font-semibold ">
                        {`Tamanho ${mapPriceVariationsLabel(price.label)}`}
                    </Label>

                </div>

                <div className="flex flex-col gap-1 col-span-6">
                    <div className="grid grid-cols-6 gap-x-4">

                        <div className="flex flex-col gap-0">
                            <Label className="text-xs text-muted-foreground tracking-tight font-semibold">Preço (R$)</Label>
                            <Input type="text" name="amount"
                                value={variationPriceAmount.toFixed(2)}
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

                        <div className="flex flex-col gap-0 col-span-1 items-center">
                            <Label htmlFor="showOnCardapio" className="text-xs text-muted-foreground tracking-tight font-semibold">Publicar</Label>
                            <Switch id="showOnCardapio" name="showOnCardapio" defaultChecked={price?.showOnCardapio || false} />
                        </div>

                        <div className="flex flex-col gap-0 col-span-2">
                            <Label className="text-xs text-muted-foreground tracking-tight font-semibold">Atualizações</Label>

                            <div className="flex flex-col gap-0">
                                <span className="text-xs text-muted-foreground"
                                >{`Data: ${formatDate(price.updatedAt, "dd/MM/yyyy HH:mm")}`}</span>
                                <span className="text-xs text-muted-foreground"
                                >{`Por: ${price.updatedBy || ""}`}</span>
                                <span className="text-xs text-muted-foreground"
                                >{`Ultimo preço: ${price.latestAmount || ""}`}</span>
                            </div>
                        </div>

                        <SaveItemButton actionName={'menu-item-price-variation-update'}
                            className="mt-2" labelClassName="text-xs" variant={"outline"}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground hover:underline hover:cursor-pointer"
                        onClick={() => {
                            setVariationPrice(suggestedPrice)
                        }}
                    >{`Sugerido: ${suggestedPrice.toFixed(2) || "0"}`}</span>
                </div>
            </div>

            <Separator />

        </Form >
    )
}
