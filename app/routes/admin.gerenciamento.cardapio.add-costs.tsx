import { Form, Link, NavLink, useOutletContext } from "@remix-run/react"
import { GerenciamentoCardapioOutletContext } from "./admin.gerenciamento.cardapio"
import { Input } from "~/components/ui/input"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Separator } from "~/components/ui/separator"
import { Globe, Lock, WholeWordIcon, X } from "lucide-react"
import { useState } from "react"
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server"
import Tooltip from "~/components/primitives/tooltip/tooltip"
import MenuItemSizeVariationsSelector from "~/domain/cardapio/components/menu-item-size-variation-selector/menu-item-size-variations-selector"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { cn } from "~/lib/utils"



export default function GerenciamentoCardapioCosts() {

    const outletContext = useOutletContext<GerenciamentoCardapioOutletContext>()
    const items = outletContext?.items || []
    const sizeVariations = outletContext?.sizeVariations || []

    const [currentSizeVariationId, setCurrentSizeVariationId] = useState(null)
    const [crustPrice, setCrustPrice] = useState(0)

    return (
        <div className="flex flex-col">

            <div className="grid grid-cols-8 items-center mb-6">
                <span className="text-xs font-semibold uppercase tracking-wide col-span-1 ">Tamanho</span>
                <Select name="menuItemSizeVariations" required onValueChange={(e) => setCurrentSizeVariationId(e)}>
                    <SelectTrigger className="col-span-3" onChange={(e) => {
                        console.log(e)
                    }}>
                        <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent >
                        <SelectGroup >
                            {
                                sizeVariations.map(sv => (
                                    <SelectItem key={sv.id} value={sv.id}>{sv.label}</SelectItem>
                                ))
                            }
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            <section className={
                cn(
                    !currentSizeVariationId && "hidden"
                )
            }>

                <div className="grid grid-cols-8 items-center mb-6">
                    <span className="text-xs font-semibold uppercase tracking-wide col-span-1">Custo Massa</span>
                    <Input type="string" name="crustPrice" className="col-span-3"
                        onChange={(e) => setCrustPrice(Number(e.target.value))} />
                </div>

                <div className="grid grid-cols-8 gap-2 items-center">
                    <span className="text-xs font-semibold uppercase tracking-wide text-center">Publicado</span>
                    <span className="text-xs font-semibold uppercase tracking-wide col-span-2 text-center">Sabor</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-center">Custo Insumos</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-center">Custo Total</span>
                </div>

                <Separator className="mt-2" />

                <div className="max-h-96 overflow-y-auto p-4">

                    <ul className="flex flex-col">
                        {
                            items.map((item, index) => {
                                return (
                                    <li key={index} >

                                        <CostMenuItemForm item={item} crustPrice={crustPrice} sizeVariationId={"1"} />
                                        <Separator className="my-2" />
                                    </li>
                                )
                            })
                        }
                    </ul>

                </div>
            </section>

        </div>
    )

}

interface CostMenuItemFormProps {
    item: MenuItemWithAssociations
    crustPrice: number
    sizeVariationId: string
}

function CostMenuItemForm({ item, crustPrice, sizeVariationId }: CostMenuItemFormProps) {


    const [ingredientPrice, setIngredientPrice] = useState(0)

    return (
        <Form method="post">
            <div className="grid grid-cols-8 gap-x-4 items-center">
                <input type="hidden" name="menuItemId" value={item.id} />
                <input type="hidden" name="sizeVariationId" value={sizeVariationId} />
                <input type="hidden" name="crustPrice" value={crustPrice} />

                <span className="text-xs text-muted-foreground">{item.visible ?
                    <Tooltip content="Item publicado" >
                        <Globe className="w-4 h-4" />
                    </Tooltip> :
                    <Tooltip content="Item privado" >
                        <X className="w-4 h-4" />
                    </Tooltip>
                }</span>
                <Link to={`/admin/gerenciamento/cardapio/${item.id}/main`} className="text-sm col-span-2">{item.name}</Link>

                <Input type="string" name="ingredientPrice" onChange={(e) => setIngredientPrice(Number(e.target.value))} />
                <span className="font-semibold text-center text-sm">{Number(crustPrice + ingredientPrice).toFixed(2)}</span>

                <SubmitButton actionName="menu-item-add-costs" onlyIcon variant={"outline"} tabIndex={0} iconColor="black" />
            </div>
        </Form>
    )
}