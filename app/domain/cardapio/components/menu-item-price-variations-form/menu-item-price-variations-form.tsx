import { MenuItem, MenuItemPriceVariation } from "@prisma/client"
import { Separator } from "@radix-ui/react-separator"
import { Form } from "@remix-run/react"
import { Save } from "lucide-react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { MenuItemWithAssociations } from "~/domain/menu-item/menu-item.prisma.entity.server"
import { cn } from "~/lib/utils"


interface MenuItemPriceVariationsFormProps {
    basePrice: MenuItem["basePriceAmount"]
    prices: MenuItemPriceVariation[]
    action: "menu-item-create" | "menu-item-update"
}

export default function MenuItemPriceVariationsForm({ prices, action, basePrice }: MenuItemPriceVariationsFormProps) {

    let pricesToRender: MenuItemPriceVariation[] = []

    if (prices.length > 0) {
        pricesToRender.push(...prices)
    } else {
        pricesToRender = [...getInitialPriceVariations()]
    }


    const suggestedPrice = suggestPriceVariations(basePrice)

    return (
        <div className="md:grid md:grid-cols-4 w-full md:col-span-4 col-span-4">
            {
                pricesToRender.map(p => {


                    return (
                        <Form method="post" key={p.id} className="flex gap-x-4 hover:outline hover:rounded-lg hover:outline-muted">
                            <div className="flex flex-col gap-1 items-center  p-2 col-span-3" >
                                <input type="hidden" name="id" defaultValue={p.id} />

                                <Label className="uppercase tracking-wider text-xs font-semibold">{`PREÇO ${mapPriceVariationsLabel(p.label)}`}</Label>

                                <div className="flex flex-col gap-1">
                                    <div className="flex gap-2 items-center">

                                        <Input type="text" name={p.label}
                                            defaultValue={p.amount || "0"}
                                            className={
                                                cn(
                                                    "text-xs md:text-sm text-center w-full py-2",
                                                    action === "menu-item-create" && "border",
                                                    action === "menu-item-update" && "p-0 border-none"
                                                )
                                            } />

                                        <SaveItemButton actionName={'menu-item-price-variation-update'} labelClassName="text-xs" variant={"outline"} />
                                    </div>
                                    <span className="text-xs">{`Sugerido: ${suggestedPrice && suggestedPrice[p.label].toFixed(2) || 0}`}</span>
                                </div>
                            </div>



                            <Separator orientation="vertical" />
                        </Form>
                    )
                })
            }

        </div>
    )
}

function getInitialPriceVariations(): MenuItemPriceVariation[] {
    return [
        {
            label: "media",
            amount: 0,
            menuItemId: "",
            id: "1",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            label: "familia",
            amount: 0,
            menuItemId: "",
            id: "2",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            label: "individual",
            amount: 0,
            menuItemId: "",
            id: "3",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            label: "fatia",
            amount: 0,
            menuItemId: "",
            id: "4",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];
}



function mapPriceVariationsLabel(label: string): string {
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

    return "";
}

export type MenuItemPriceVariationSuggestion = Record<string, number>

function suggestPriceVariations(priceRef: number): MenuItemPriceVariationSuggestion {
    const priceRanges: Record<string, number[]> = {
        '69.9': [69.90, 149.90],
        '79.9': [79.90, 159.90,],
        '89.9': [89.90, 179.90,],
        '99.9': [99.90, 189.90,],
        '119.9': [119.90, 219.90,],
    }

    const range = priceRanges[String(priceRef)]

    const media = range ? range[0] : 0
    const familia = range ? range[1] : 0
    const individual = priceRef > 0 ? priceRef / 1.75 : 0
    const fatia = priceRef > 0 ? familia / 8 : 0

    return {
        'media': media,
        'familia': familia,
        'individual': individual,
        'fatia': fatia
    }

}