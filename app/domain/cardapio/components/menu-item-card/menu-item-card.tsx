import { Category } from "@prisma/client"
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import { useState } from "react"
import SortingOrderItems from "~/components/primitives/sorting-order-items/sorting-order-items"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { DeleteItemButton } from "~/components/primitives/table-list"
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { Switch } from "~/components/ui/switch"
import { mapPriceLabel } from "~/domain/menu-item/menu-item.entity.server"
import { MenuItem, MenuItemPrice } from "~/domain/menu-item/menu-item.model.server"
import { loader } from "~/routes/admin.cardapio._index"
import formatStringList from "~/utils/format-string-list"

interface MenuItemCardProps {
    item: MenuItem
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]


    const [showDetails, setShowDetails] = useState(true)

    const pizzaTitle = item?.name || "Nenhum nome cadastrado"

    const pizzaCategory = categories.find(category => category.id === item.category?.id)

    const missingInfo = !item?.name || !item?.prices || !item?.ingredients


    const [searchParams, setSearchParams] = useSearchParams()
    const action = searchParams.get("_action")

    return (

        <div className={`border-2 border-muted rounded-lg p-4 flex flex-col gap-2`}>
            <SortingOrderItems enabled={action === "menu-items-sortorder"} itemId={item.id} groupId={pizzaCategory?.id}>
                <Form method="post" >

                    <input type="hidden" name="id" value={item?.id} />

                    <section className="md:grid md:grid-cols-8">
                        <Input type="text" name="name" defaultValue={pizzaTitle} className="text-lg font-bold tracking-tight  p-0 border-none focus:px-2 col-span-4" />

                        <Select name="categoryId" defaultValue={item?.category?.id ?? undefined} >
                            <SelectTrigger className="text-xs col-span-2 uppercase tracking-wide" >
                                <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent id="categoryId" >
                                <SelectGroup >
                                    {categories && categories.map(category => {
                                        return (
                                            <SelectItem key={category.id} value={category.id ?? ""} className="text-lg">{category.name}</SelectItem>
                                        )
                                    })}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        {/* VISIBILIDADE CRDÁPIO */}
                        <div className="flex justify-between md:justify-end gap-4 w-full items-center col-span-2">
                            <span className="font-semibold text-sm md:hidden">Pública no cardápio</span>
                            <span className="hidden md:block font-semibold md:text-xs">Cardápio</span>
                            <Switch id="visible" name="visible" defaultChecked={item.visible} disabled />
                        </div>
                    </section>

                    <section className="md:grid grid-cols-8">
                        <Input type="text" name="ingredients"
                            defaultValue={formatStringList(item?.ingredients, { firstLetterCapitalized: true })}
                            className="text-xs md:text-sm p-0 border-none focus:px-2 col-span-4" />

                        {/* PRECOS */}
                        <MenuItemCardPrices prices={item.prices || []} />

                    </section>

                    <Separator className="my-4" />
                    <div className="flex gap-4 justify-end">
                        <DeleteItemButton actionName="menu-item-delete" label="Deletar" />
                        <SubmitButton actionName="menu-item-save" labelClassName="text-xs" variant={"outline"} />
                    </div>



                </Form>


                {missingInfo && item.visible === true && (
                    <div className=" bg-orange-100 rounded-md py-2 px-4 mt-4">
                        <div className="flex gap-2 items-center">
                            <AlertCircle color="orange" size={16} />
                            <div className="flex flex-col gap-1">
                                {(item?.name === undefined || item.name === "") && <span className="text-xs font-semibold text-orange-500">Nome não cadastrado</span>}
                                {(item?.prices === undefined || item.prices.length === 0) && <span className="text-xs font-semibold text-orange-500">Preço não cadastrado</span>}
                                {(item?.ingredients === undefined || item.ingredients.length === 0) && <span className="text-xs font-semibold text-orange-500">Ingredientes não cadastrados</span>}
                            </div>

                        </div>
                    </div>
                )}
            </SortingOrderItems>
        </div>

    )
}


function MenuItemCardPrices({ prices }: { prices: MenuItemPrice[] }) {


    return (
        <div className="md:grid md:grid-cols-4 w-full md:col-span-4 col-span-4">
            {
                prices && prices.map(p => {
                    return (

                        <div className="flex flex-col gap-2">
                            <Label className="text-xs tracking-wide m-0 p-0 uppercase">{mapPriceLabel(p.label)}</Label>
                            <Input type="text" name="price"
                                defaultValue={p.amount || "0"}
                                className="text-xs md:text-sm p-0 border-none focus:px-2 col-span-4" />
                        </div>
                    )
                })
            }
        </div>
    )
}

