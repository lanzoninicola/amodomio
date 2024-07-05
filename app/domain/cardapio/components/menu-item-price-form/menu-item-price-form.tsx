import { MenuItemPrice } from "@prisma/client"
import { Form } from "@remix-run/react"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { MenuItemPriceHTMLSelectLabel } from "~/domain/menu-item/menu-item-price.prisma.entity.server"
import { cn } from "~/lib/utils"

interface MenuItemPriceFormProps {
    price: MenuItemPrice
    action: "menu-item-create" | "menu-item-update"
}

function MenuItemPriceForm({ price, action }: MenuItemPriceFormProps) {
    return (
        <Form method="post">
            <div className="flex flex-col gap-2" >
                <SelectMenuItemPrice label={price.label as MenuItemPriceHTMLSelectLabel} />
                <Input type="text" name="price"
                    defaultValue={price.amount || "0"}
                    className={
                        cn(
                            "text-xs md:text-sm col-span-4",
                            action === "menu-item-create" && "border",
                            action === "menu-item-update" && "p-0 border-none focus:px-2"
                        )
                    } />
            </div>
        </Form>
    )
}

interface SelectMenuItemPriceProps {
    label: MenuItemPriceHTMLSelectLabel
}

function SelectMenuItemPrice({ label }: SelectMenuItemPriceProps) {


    return (
        <Select name="categoryId" defaultValue={label} >
            <SelectTrigger className="text-xs col-span-2 uppercase tracking-wide" >
                <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent id="categoryId" >
                <SelectGroup >
                    {/* {prices.map(p => {
                        return (
                            <SelectItem key={p.label} value={p.label} className="text-lg">{p.label}</SelectItem>
                        )
                    })} */}
                    <SelectItem key={'1'} value={'media'} className="text-lg">media</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}