import { Await, Form, Link, defer, useLoaderData, useOutletContext } from "@remix-run/react"
import { Input } from "~/components/ui/input"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Separator } from "~/components/ui/separator"
import { Globe, X } from "lucide-react"
import { Suspense, useState } from "react"
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server"
import Tooltip from "~/components/primitives/tooltip/tooltip"
import { MenuItemSizeVariation } from "@prisma/client"
import { MenuItemPizzaSizeVariationSlug, menuItemCostPrismaEntity } from "~/domain/cardapio/menu-item-cost.entity.server"
import { ok } from "~/utils/http-response.server"
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { GerenciamentoCardapioCostsOutletContext } from "./admin.gerenciamento.cardapio-items-costs"
import Loading from "~/components/loading/loading"

export async function loader({ request, params }: LoaderFunctionArgs) {

    const sizeSlug = params?.size

    if (!sizeSlug
    ) {
        return null
    }

    const pizzaSizeConfig = menuItemCostPrismaEntity.findSizeConfig(sizeSlug as MenuItemPizzaSizeVariationSlug)
    const menuItemsCosts = menuItemCostPrismaEntity.findItemsCostBySize(sizeSlug as MenuItemPizzaSizeVariationSlug)

    return defer({
        pizzaSizeConfig,
        menuItemsCosts
    })
}

export async function action({ request }: ActionFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-size-variation-config-edit") {

        console.log({ values })


        return ok()
    }

    if (_action === "menu-item-edit-cost") {

        console.log({ values })

        return ok()
    }

    return null
}

export default function EditItemsCostsSize() {

    const loaderDeferredData = useLoaderData<typeof loader>()

    const outletContext = useOutletContext<GerenciamentoCardapioCostsOutletContext>()
    const items = outletContext?.items || []


    return (

        <Suspense fallback={<Loading />}>

            <Await resolve={loaderDeferredData?.pizzaSizeConfig}>
                {(pizzaSizeConfig) => {
                    // @ts-ignore
                    return (
                        <section className="flex flex-col">
                            <Form method="post" className="flex flex-col gap-4 mb-12">

                                <input type="hidden" name="id" value={pizzaSizeConfig?.id} readOnly={true} className="hidden" />

                                <div className="grid grid-cols-8 items-center gap-x-6">
                                    <span className="text-xs font-semibold uppercase tracking-wide col-span-2">Custo Massa (R$)</span>
                                    <Input type="string" name="baseCost" className="col-span-3"
                                        defaultValue={String(pizzaSizeConfig?.costBase || 0)}
                                    />

                                </div>

                                <div className="grid grid-cols-8 items-center gap-x-6">
                                    <span className="text-xs font-semibold uppercase tracking-wide col-span-2">Fator de escalonamento de custo</span>
                                    <Input type="string" name="costScalingFactor" className="col-span-3"
                                        defaultValue={String(pizzaSizeConfig?.costScalingFactor || 0)}
                                    />
                                </div>

                                <SubmitButton actionName="menu-item-size-variation-config-edit"
                                    tabIndex={0}
                                />
                            </Form>

                            {/* LISTA */}

                            <Suspense fallback={<Loading />}>

                                <Await resolve={loaderDeferredData?.menuItemsCosts}>
                                    {(menuItemsCosts) => {

                                        return (
                                            <section >
                                                <div className="grid grid-cols-8 gap-2 items-center px-4">
                                                    <span className="text-xs font-semibold uppercase tracking-wide ">Publicado</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide col-span-2 ">Sabor</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide">Custo Insumos</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide">Custo Total</span>
                                                </div>

                                                <Separator className="mt-2" />

                                                <div className="max-h-96 overflow-y-auto p-4">

                                                    <ul className="flex flex-col gap-0">
                                                        {
                                                            items.map((item, index) => {
                                                                return (
                                                                    <li key={index} >

                                                                        <CostMenuItemForm item={item}
                                                                            variationBaseCost={pizzaSizeConfig?.costBase || 0}
                                                                            // @ts-ignore
                                                                            sizeVariation={pizzaSizeConfig} />
                                                                        <Separator className="my-1" />
                                                                    </li>
                                                                )
                                                            })
                                                        }
                                                    </ul>

                                                </div>
                                            </section>
                                        )

                                    }}
                                </Await>
                            </Suspense>


                        </section>
                    )
                }}
            </Await>
        </Suspense>





    )
}


interface CostMenuItemFormProps {
    item: MenuItemWithAssociations
    variationBaseCost: number
    sizeVariation: MenuItemSizeVariation
}


function CostMenuItemForm({ item, variationBaseCost, sizeVariation }: CostMenuItemFormProps) {

    if (!sizeVariation) {
        return null
    }



    const [ingredientPrice, setIngredientPrice] = useState(0)

    return (
        <Form method="post">
            <div className="grid grid-cols-8 items-center">
                <input type="hidden" name="menuItemId" value={item.id} />
                <input type="hidden" name="sizeVariationId" value={sizeVariation.id} />

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
                <span className="font-semibold text-center text-sm">{Number(variationBaseCost + ingredientPrice).toFixed(2)}</span>

                <SubmitButton actionName="menu-item-edit-cost" onlyIcon variant={"outline"} tabIndex={0} iconColor="black" />
            </div>
        </Form>
    )
}