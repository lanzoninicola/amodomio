import { Category, MenuItemPriceVariation } from "@prisma/client"
import { useLoaderData, Form, useOutletContext } from "@remix-run/react"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import formatStringList from "~/utils/format-string-list"
import { cn } from "~/lib/utils"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DeleteItemButton } from "~/components/primitives/table-list"
import { MenuItemWithAssociations } from "~/domain/menu-item/menu-item.prisma.entity.server"
import { Label } from "~/components/ui/label"
import { useState } from "react"
import { MenuItemPriceVariationLabel, PartialMenuItemPriceVariation } from "~/domain/menu-item/menu-item-price-variations.prisma.entity.server"
import MenuItemPriceVariationForm from "../menu-item-price-variation-form/menu-item-price-variation-form"
import { AdminCardapioOutletContext, loader } from "~/routes/admin.gerenciamento.cardapio"
import Fieldset from "~/components/ui/fieldset"


export type MenuItemFormAction = "menu-item-create" | "menu-item-update"

interface MenuItemFormProps {
    item?: MenuItemWithAssociations
    action: MenuItemFormAction
    className?: string
}

export default function MenuItemForm({ item, action, className }: MenuItemFormProps) {
    const outletContext: AdminCardapioOutletContext = useOutletContext()
    const categories = outletContext.categories as Category[]

    const category = categories.find(category => category.id === item?.categoryId)

    const [currentBasePrice, setCurrentBasePrice] = useState(item?.basePriceAmount || 0)

    const priceVariations = item?.priceVariations ? item?.priceVariations : defaultItemsPriceVariations()

    return (

        <div className="flex flex-col">

            <Form method="post" className={cn(className, "mb-6")} >

                <input type="hidden" name="id" value={item?.id} />

                <section className="md:grid md:grid-cols-8 items-start">
                    <div className="flex flex-col col-span-4">
                        <input type="hidden" name="id" value={item?.id || ""} />
                        <Fieldset>
                            <Input type="text" name="name" defaultValue={item?.name}
                                placeholder="Nome da pizza"
                                className={
                                    cn(
                                        "text-lg font-bold tracking-tight ",
                                        action === "menu-item-create" && "border",
                                        action === "menu-item-update" && "border-none focus:px-2 p-0"
                                    )
                                } />
                        </Fieldset>
                        <Fieldset>
                            <Input type="text" name="ingredients"
                                placeholder="Ingredientes"
                                defaultValue={formatStringList(item?.ingredients, { firstLetterCapitalized: true }) || "Molho de tomate, muçarela, "}
                                className={cn(
                                    "text-xs md:text-sm col-span-4",
                                    action === "menu-item-create" && "border",
                                    action === "menu-item-update" && "border-none focus:px-2 p-0"
                                )} />
                        </Fieldset>

                        <Fieldset className="grid grid-cols-4 items-center" >
                            <Label className="font-semibold text-sm col-span-1">Preço Base</Label>
                            <Input type="text" name="basePriceAmount"
                                onChange={(e) => {
                                    const value = e.target.value
                                    if (isNaN(Number(value))) return

                                    setCurrentBasePrice(Number(value))
                                }}
                                defaultValue={item?.basePriceAmount || "0"}
                                className={
                                    cn(
                                        "text-xs md:text-sm col-span-1",
                                        action === "menu-item-create" && "border",
                                        action === "menu-item-update" && "p-0 border-none focus:px-2"
                                    )
                                } />
                        </Fieldset>

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

                <section className="flex flex-col">

                    <Fieldset className="grid grid-cols-4 items-center">
                        <Label htmlFor="isVegetarian" className="font-semibold text-sm col-span-1">Vegetariano</Label>
                        <Switch id="isVegetarian" name="isVegetarian" defaultChecked={item?.isVegetarian || false} />
                    </Fieldset>

                    <Fieldset className="grid grid-cols-4 items-center">
                        <Label htmlFor="featured" className="font-semibold text-sm col-span-1">Em destaque</Label>
                        <Switch id="featured" name="featured" defaultChecked={item?.featured || false} />
                    </Fieldset>

                    <Fieldset className="grid grid-cols-4 items-center">
                        <Label htmlFor="mogoId" className="font-semibold text-sm col-span-1">Mogo ID</Label>
                        <Input type="text" id="mogoId" name="mogoId"
                            placeholder="ID produto mogo"
                            defaultValue={item?.mogoId}
                            className={cn(
                                "text-xs md:text-sm col-span-3",
                                action === "menu-item-create" && "border",
                                action === "menu-item-update" && "border-none focus:px-2 p-0"
                            )} />
                    </Fieldset>

                </section>


                <Separator className="my-4" />

                <div className="flex gap-4 justify-end">
                    {action === "menu-item-update" && (
                        <DeleteItemButton actionName="menu-item-delete" label="Deletar" />
                    )}
                    <SubmitButton actionName={action} labelClassName="text-xs" variant={"outline"} />
                </div>



            </Form>


            {/* PREÇOS */}
            <div className="flex flex-col">
                <span className="font-semibold uppercase tracking-wider text-xs">Preços</span>
                <Separator className="my-2" />
                <div className="grid grid-cols-4 gap-x-4">
                    {priceVariations.map(pv => <MenuItemPriceVariationForm
                        key={pv.id} price={pv} action={action}
                        basePrice={currentBasePrice} />
                    )}
                </div>
            </div>
        </div>

    )
}



function defaultItemsPriceVariations(): PartialMenuItemPriceVariation[] {
    return [
        {
            id: '1',
            label: "media",
            amount: 0,
            discountPercentage: 0,
        },
        {
            id: '2',
            label: "familia",
            amount: 0,
            discountPercentage: 0,
        },
        {
            id: '3',
            label: "individual",
            amount: 0,
            discountPercentage: 0,
        },
        {
            id: '4',
            label: "fatia",
            amount: 0,
            discountPercentage: 0,
        },
    ];
}
