import { Await, Form, Link, defer, useActionData, useLoaderData, useOutletContext } from "@remix-run/react"
import { Input } from "~/components/ui/input"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Separator } from "~/components/ui/separator"
import { Globe, X } from "lucide-react"
import { Suspense, useState } from "react"
import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server"
import Tooltip from "~/components/primitives/tooltip/tooltip"
import { MenuItemSize } from "@prisma/client"
import { MenuItemPizzaSizeVariationSlug, menuItemCostPrismaEntity } from "~/domain/cardapio/menu-item-cost.entity.server"
import { ok, serverError } from "~/utils/http-response.server"
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"

import Loading from "~/components/loading/loading"
import tryit from "~/utils/try-it"
import { toast } from "~/components/ui/use-toast"
import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"
import { isValid } from "date-fns"
import FinanceInput from "~/components/finance-input/finance-input"
import { GerenciamentoCardapioCostsOutletContext } from "./admin.gerenciamento.cardapio-finance.cost-management"

export async function loader({ request, params }: LoaderFunctionArgs) {

    const sizeSlug = params?.size

    if (!sizeSlug
    ) {
        return null
    }

    const pizzaSizeConfig = menuItemCostPrismaEntity.findSizeConfigBySlug(sizeSlug as MenuItemPizzaSizeVariationSlug)
    const menuItemsCosts = menuItemCostPrismaEntity.findItemsCostBySize(sizeSlug as MenuItemPizzaSizeVariationSlug)

    return defer({
        pizzaSizeConfig,
        menuItemsCosts,
    })
}

export async function action({ request }: ActionFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-size-variation-config-edit") {

        const costBase = Number(values.costBase)
        const costScalingFactor = Number(values.costScalingFactor)

        if (isNaN(costBase)) {
            return serverError(`Valor de custo base: ${values.costBase} inválido, use o formato 0.00 com ponto`)
        }

        if (isNaN(costScalingFactor)) {
            return serverError(`Valor de fator de escalonamento: ${values.costScalingFactor} inválido, use o formato 0.00 com ponto`)
        }

        const [err, data] = await tryit(menuItemCostPrismaEntity.updateSizeConfig(values.id as string, {
            costBase,
            costScalingFactor,
        }))

        if (err) {
            return serverError(err)
        }

        return ok({
            status: 200,
            message: "Configuração atualizada com sucesso"
        })
    }

    if (_action === "menu-item-edit-cost") {

        if (isNaN(Number(values.recipeCostAmount))) {
            return serverError(`Valor de custo: ${values.recipeCostAmount} inválido, use o formato 0.00 com ponto`)
        }

        const [err, data] = await tryit(menuItemCostPrismaEntity.upsertMenuItemCost(
            values.sizeId as string,
            values.menuItemId as string,
            {
                recipeCostAmount: Number(values.recipeCostAmount),
                updatedAt: new Date(),
                updatedBy: "admin",
                createdAt: new Date(),
                MenuItem: {
                    connect: {
                        id: values.menuItemId as string
                    }
                },
                MenuItemSize: {
                    connect: {
                        id: values.sizeId as string
                    }
                }
            }
        ))

        if (err) {
            return serverError(err)
        }

        return ok({
            status: 200,
            message: "Custo atualizado com sucesso"
        })
    }

    return null
}

export default function EditItemsCostsSize() {

    const loaderDeferredData = useLoaderData<typeof loader>()

    const outletContext = useOutletContext<GerenciamentoCardapioCostsOutletContext>()
    const items = outletContext?.items || []

    const actionData = useActionData<typeof action>()

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "OK",
            description: actionData.message
        })
    }


    return (

        <Suspense fallback={<Loading />}>

            <Await resolve={loaderDeferredData?.pizzaSizeConfig}>
                {(pizzaSizeConfig) => {
                    // @ts-ignore
                    return (
                        <section className="flex flex-col">
                            <Form method="post" className="flex flex-col gap-4 mb-12 border rounded-md p-4">

                                <input type="hidden" name="id" defaultValue={pizzaSizeConfig?.id} readOnly={true} />

                                <div className="grid grid-cols-8 items-center gap-x-6">
                                    <span className="text-xs font-semibold uppercase tracking-wide col-span-2">Custo Base do tamanho (R$)</span>
                                    <Input type="string" name="costBase" className="col-span-3"
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

                                        console.log({ menuItemsCosts })

                                        return (
                                            <section >
                                                <div className="grid grid-cols-8 gap-2 items-center px-4">
                                                    <span className="text-xs font-semibold uppercase tracking-wide ">Publicado</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide col-span-2 ">Sabor</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide">Custo Receita</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-center">Custo Receita Sugerida</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wide">Custo Total</span>
                                                </div>

                                                <Separator className="mt-2" />

                                                <div className="max-h-96 overflow-y-auto p-4">

                                                    <ul className="flex flex-col gap-0">
                                                        {
                                                            items.map((item, index) => {


                                                                let costs = {
                                                                    recipeCost: 0,
                                                                    suggestedRecipeCost: 0
                                                                }

                                                                if (menuItemsCosts) {
                                                                    const itemCostRecord = menuItemsCosts.find((menuItemCost) =>
                                                                        menuItemCost.menuItemId === item.id)


                                                                    if (itemCostRecord) {
                                                                        costs = {
                                                                            recipeCost: itemCostRecord.recipeCostAmount || 0,
                                                                            suggestedRecipeCost: itemCostRecord.suggestedRecipeCost || 0
                                                                        }
                                                                    }
                                                                }


                                                                return (
                                                                    <li key={index} >

                                                                        <CostMenuItemForm item={item}
                                                                            sizeBaseCost={pizzaSizeConfig?.costBase || 0}
                                                                            // @ts-ignore
                                                                            sizeConfig={pizzaSizeConfig}
                                                                            recipeCost={String(costs.recipeCost)}
                                                                            suggestedRecipeCost={String(costs.suggestedRecipeCost)}
                                                                        />
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
    sizeBaseCost: number
    sizeConfig: MenuItemSize
    recipeCost: string
    suggestedRecipeCost: string
}


function CostMenuItemForm({ item, sizeBaseCost, sizeConfig, recipeCost, suggestedRecipeCost }: CostMenuItemFormProps) {

    if (!sizeConfig) {
        return null
    }

    const [recipeCostAmount, setRecipeCostAmount] = useState(recipeCost)

    const [recipeCostAmountErrorInput, setRecipeCostAmountErrorInput] = useState("")

    return (
        <Form method="post">
            <div className="grid grid-cols-8 items-center">
                <input type="hidden" name="menuItemId" value={item.id} />
                <input type="hidden" name="sizeId" value={sizeConfig.id} />
                <input type="hidden" name="sizeSlug" value={sizeConfig.slug} />

                <span className="text-xs text-muted-foreground">{item.visible ?
                    <Tooltip content="Item publicado" >
                        <Globe className="w-4 h-4" />
                    </Tooltip> :
                    <Tooltip content="Item privado" >
                        <X className="w-4 h-4" />
                    </Tooltip>
                }</span>
                <Link to={`/admin/gerenciamento/cardapio/${item.id}/main`} className="text-sm col-span-2">{item.name}</Link>

                <FinanceInput inputValue={recipeCostAmount} name="recipeCostAmount"
                    onChange={(value) => {
                        setRecipeCostAmount(value)
                    }}
                />

                <span className="text-muted-foreground text-center text-xs hover:underline hover:cursor-pointer"
                    onClick={() => setRecipeCostAmount(suggestedRecipeCost)}
                >
                    {Number(suggestedRecipeCost).toFixed(2)}</span>
                <span className="font-semibold text-center text-sm">{Number(Number(sizeBaseCost) + Number(recipeCostAmount)).toFixed(2)}</span>

                <SubmitButton actionName="menu-item-edit-cost" onlyIcon variant={"outline"} tabIndex={0} iconColor="black" />
            </div>
        </Form>
    )
}







