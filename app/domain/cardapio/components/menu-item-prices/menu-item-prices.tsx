import { MenuItemPrice } from "@prisma/client"
import { Separator } from "@radix-ui/react-separator"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"


interface MenuItemPricesFormProps {
    prices: MenuItemPrice[]
    action: "menu-item-create" | "menu-item-update"
}

export default function MenuItemPrices({ prices, action }: MenuItemPricesFormProps) {

    console.log({ prices })


    return (
        <div className="md:grid md:grid-cols-4 w-full md:col-span-4 col-span-4">
            {
                prices && prices.map(p => {
                    return (
                        <div key={p.label} className="flex gap-x-4">
                            <div className="flex flex-col gap-1 items-center" >
                                <Label className="uppercase tracking-wider text-xs font-semibold">{mapPriceLabel(p.label)}</Label>
                                <Input type="text" name={p.label}
                                    defaultValue={p.amount || "0"}
                                    className={
                                        cn(
                                            "text-xs md:text-sm col-span-4 text-center",
                                            action === "menu-item-create" && "border",
                                            action === "menu-item-update" && "p-0 border-none focus:px-2"
                                        )
                                    } />
                            </div>
                            <Separator orientation="vertical" />
                        </div>
                    )
                })
            }

        </div>
    )
}

function mapPriceLabel(label: string): string {
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