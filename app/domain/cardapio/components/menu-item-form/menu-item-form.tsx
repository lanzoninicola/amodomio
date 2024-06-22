import { Category, MenuItem, MenuItemPrice, } from "@prisma/client"
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
import MenuItemPrices from "../menu-item-prices/menu-item-prices"



interface MenuItemFormProps {
    item?: MenuItem
    action: "menu-item-create" | "menu-item-update"
    className?: string
}

export default function MenuItemForm({ item, action, className }: MenuItemFormProps) {
    const loaderData = useLoaderData<typeof loader>()
    const categories = loaderData.payload.categories as Category[]

    const category = categories.find(category => category.id === item?.categoryId)

    return (

        <Form method="post" className={cn(className)} >

            <input type="hidden" name="id" value={item?.id} />

            <section className="md:grid md:grid-cols-8 gap-4 mb-4 items-start">
                <div className="flex flex-col gap-2 col-span-4">
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


            {action === "menu-item-update" &&
                (
                    <>
                        <Separator className="my-4" />
                        <MenuItemPrices prices={item?.prices || []} action={action} />
                    </>
                )
            }


            <Separator className="my-4" />
            <div className="flex gap-4 justify-end">
                {action === "menu-item-update" && (
                    <DeleteItemButton actionName="menu-item-delete" label="Deletar" />
                )}
                <SubmitButton actionName={action} labelClassName="text-xs" variant={"outline"} />
            </div>



        </Form>

    )
}