import { Category, MenuItemPriceVariation } from "@prisma/client"
import { useLoaderData, Form } from "@remix-run/react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import { loader } from "~/routes/admin.gerenciamento.cardapio._index"
import formatStringList from "~/utils/format-string-list"
import { cn } from "~/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DeleteItemButton } from "~/components/primitives/table-list"
import { MenuItemWithAssociations } from "~/domain/menu-item/menu-item.prisma.entity.server"
import { Label } from "~/components/ui/label"
import MenuItemPriceVariationsForm from "../menu-item-price-variations-form/menu-item-price-variations-form"
import { useState } from "react"
import { MenuItemPriceVariationLabel } from "~/domain/menu-item/menu-item-price-variations.prisma.entity.server"



interface MenuItemFormProps {
    item?: MenuItemWithAssociations
    action: "menu-item-create" | "menu-item-update"
    className?: string
}

export default function MenuItemForm({ item, action, className }: MenuItemFormProps) {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]

    const category = categories.find(category => category.id === item?.categoryId)

    const [suggestedPriceVariations, setSuggestedPriceVariations] = useState<MenuItemPriceVariationSuggestion | null>(null)


    function onChangeBasePrice(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value

        if (isNaN(Number(value))) return

        const priceVariationsCalculate = suggestPriceVariations(Number(value))

        setSuggestedPriceVariations(priceVariationsCalculate)
    }

    return (

        <div className="flex flex-col">

            <Form method="post" className={cn(className)} >

                <input type="hidden" name="id" value={item?.id} />

                <section className="md:grid md:grid-cols-8 gap-4 mb-4 items-start">
                    <div className="flex flex-col gap-2 col-span-4">
                        <input type="hidden" name="id" value={item?.id || ""} />
                        <Input type="text" name="name" defaultValue={item?.name}
                            placeholder="Nome da pizza"
                            className={
                                cn(
                                    "text-lg font-bold tracking-tight ",
                                    action === "menu-item-create" && "border",
                                    action === "menu-item-update" && "border-none focus:px-2 p-0"
                                )
                            } />
                        <Input type="text" name="ingredients"
                            placeholder="Ingredientes"
                            defaultValue={formatStringList(item?.ingredients, { firstLetterCapitalized: true }) || "Molho de tomate, muçarela, "}
                            className={cn(
                                "text-xs md:text-sm col-span-4",
                                action === "menu-item-create" && "border",
                                action === "menu-item-update" && "border-none focus:px-2 p-0"
                            )} />
                        <div className="grid grid-cols-4 items-center" >
                            <Label className="uppercase tracking-wider text-xs font-semibold col-span-1">Preço Base</Label>
                            <Input type="text" name="basePriceAmount"
                                onChange={onChangeBasePrice}
                                defaultValue={item?.basePriceAmount || "0"}
                                className={
                                    cn(
                                        "text-xs md:text-sm col-span-1",
                                        action === "menu-item-create" && "border",
                                        action === "menu-item-update" && "p-0 border-none focus:px-2"
                                    )
                                } />
                        </div>
                    </div>

                    <Select name="category" defaultValue={JSON.stringify(category)} >
                        <SelectTrigger className="text-xs col-span-2 uppercase tracking-wide" >
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent id="category" >
                            <SelectGroup >
                                {categories && categories.map(category => {
                                    return (
                                        <SelectItem key={category.id} value={JSON.stringify(category)} className="text-lg">{category.name}</SelectItem>
                                    )
                                })}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {/* VISIBILIDADE CRDÁPIO */}
                    <div className="flex justify-between md:justify-end gap-4 w-full items-center mt-2 col-span-2">
                        <span className="font-semibold text-sm">Públicar no cardápio</span>
                        <Switch id="visible" name="visible" defaultChecked={item?.visible || false} />
                    </div>
                </section>




                <Separator className="my-4" />

                <div className="flex gap-4 justify-end">
                    {action === "menu-item-update" && (
                        <DeleteItemButton actionName="menu-item-delete" label="Deletar" />
                    )}
                    <SubmitButton actionName={action} labelClassName="text-xs" variant={"outline"} />
                </div>



            </Form>



            <Separator className="my-4" />

            <MenuItemPriceVariationsForm prices={item?.priceVariations || []} action={action} suggestedPrice={suggestedPriceVariations} />
        </div>

    )
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