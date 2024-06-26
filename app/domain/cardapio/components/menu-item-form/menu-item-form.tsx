import { Category } from "@prisma/client"
import { Form, useOutletContext } from "@remix-run/react"
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
import { PartialMenuItemPriceVariation } from "~/domain/menu-item/menu-item-price-variations.prisma.entity.server"
import MenuItemPriceVariationForm, { mapPriceVariationsLabel } from "../menu-item-price-variation-form/menu-item-price-variation-form"
import { AdminCardapioOutletContext } from "~/routes/admin.gerenciamento.cardapio"
import Fieldset from "~/components/ui/fieldset"
import { Textarea } from "~/components/ui/textarea"
import { ChevronDown, GripVertical } from "lucide-react"
import { ChevronRight } from "lucide-react"


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

    const [showDetails, setShowDetails] = useState(false)

    return (

        <div className="flex flex-col">

            <Form method="post" className={cn(className)} >

                <input type="hidden" name="id" value={item?.id} />

                <section className="grid grid-cols-12 items-center">
                    <div className="flex items-center col-span-4 gap-2">
                        {showDetails === false && <GripVertical color="grey" className="cursor-move" />}
                        <Input type="text" name="name" defaultValue={item?.name}
                            placeholder="Nome da pizza"
                            disabled={showDetails === false}
                            className={
                                cn(
                                    "text-lg font-bold tracking-tight ",
                                    action === "menu-item-create" && "border",
                                    action === "menu-item-update" && "border-none focus:px-2 p-0",
                                    showDetails === false && "disabled:opacity-100 disabled:cursor-auto"
                                )
                            } />
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
                        <div className="rounded-full w-fit p-1 hover:cursor-pointer hover:bg-muted "
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails === true ? <ChevronDown /> : <ChevronRight />}
                        </div>
                    </div>

                </section>

                {showDetails &&

                    (
                        <>
                            <Separator className="my-6" />

                            <section className="grid grid-cols-8 justify-between gap-x-2">
                                <div className="flex flex-col col-span-4">
                                    <input type="hidden" name="id" value={item?.id || ""} />

                                    <Fieldset>
                                        <Textarea name="ingredients"
                                            placeholder="Ingredientes"
                                            defaultValue={formatStringList(item?.ingredients, { firstLetterCapitalized: true }) || "Molho de tomate, muçarela, "}
                                            className={cn(
                                                "text-xs md:text-sm col-span-4",
                                                action === "menu-item-create" && "border",
                                                // action === "menu-item-update" && "border-none focus:px-2 p-0"
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

                            </section>

                            <Separator className="mb-4" />

                            <section className="flex flex-col">

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
                        </>
                    )
                }



            </Form>


            {
                showDetails && (

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
                )
            }

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
