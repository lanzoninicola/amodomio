
import { ActionFunctionArgs, LoaderFunctionArgs, } from "@remix-run/node";
import { Await, useLoaderData, defer, Form, useActionData } from "@remix-run/react";
import { Suspense, useState } from "react";
import OptionTab from "~/components/layout/option-tab/option-tab";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemCostVariationPrismaEntity } from "~/domain/cardapio/menu-item-cost-variation.entity.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { MenuItemWithCostVariations } from "~/domain/cardapio/menu-item.types";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import parserFormDataEntryToNumber from "~/utils/parse-form-data-entry-to-number";
import randomReactKey from "~/utils/random-react-key";
import createUUID from "~/utils/uuid";



export async function loader({ request }: LoaderFunctionArgs) {

    const menuItemsWithCostVariations = menuItemPrismaEntity.findManyWithCostVariations()

    const user = authenticator.isAuthenticated(request);

    const data = Promise.all([menuItemsWithCostVariations, user]);

    return defer({
        data
    })
}

export async function action({ request }: ActionFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })

    if (_action === "menu-item-cost-variation-upsert-user-input") {

        const menuItemId = values?.menuItemId as string
        const menuItemCostVariationId = values?.menuItemCostVariationId as string
        const menuItemSizeId = values?.menuItemSizeId as string
        const updatedBy = values?.updatedBy as string
        const costAmount = parserFormDataEntryToNumber(values?.costAmount) || 0
        const previousCostAmount = parserFormDataEntryToNumber(values?.previousCostAmount) || 0


        const recordId = menuItemCostVariationId === "" ? createUUID() : menuItemCostVariationId

        const [err, result] = await prismaIt(menuItemCostVariationPrismaEntity.upsert(recordId,
            {
                id: recordId,
                menuItemId,
                menuItemSizeId,
                costAmount,
                previousCostAmount,
                updatedBy,
            }
        ))

        if (err) {
            return badRequest(err)
        }

        return ok(`O custo da ficha tecnica foi atualizado com sucesso`)
    }

    if (_action === "menu-item-cost-variation-upsert-proposed-input") {

        const menuItemId = values?.menuItemId as string
        const menuItemCostVariationId = values?.menuItemCostVariationId as string
        const menuItemSizeId = values?.menuItemSizeId as string
        const updatedBy = values?.updatedBy as string
        const costAmount = parserFormDataEntryToNumber(values?.proposedCostAmount) || 0
        const previousCostAmount = parserFormDataEntryToNumber(values?.previousCostAmount) || 0


        const recordId = menuItemCostVariationId === "" ? createUUID() : menuItemCostVariationId

        const [err, result] = await prismaIt(menuItemCostVariationPrismaEntity.upsert(recordId,
            {
                id: recordId,
                menuItemId,
                menuItemSizeId,
                costAmount,
                previousCostAmount,
                updatedBy,
            }
        ))

        if (err) {
            return badRequest(err)
        }

        return ok(`O custo da ficha tecnica foi atualizado com sucesso`)
    }

    if (_action === "menu-item-cost-variation-upsert-all-proposed-input") {
        const menuItemId = values?.menuItemId as string
        const updatedBy = values?.updatedBy as string

        const menuItemWithCostVariations = await menuItemPrismaEntity.findOneWithCostVariations(menuItemId)

        if (!menuItemWithCostVariations) {
            return badRequest("Nenhum item encontrado")
        }

        const costVariations = menuItemWithCostVariations.costVariations.map(record => {
            return {
                id: record.menuItemCostVariationId,
                menuItemId,
                costAmount: record.proposedCostAmount,
                updatedAt: record.updatedAt,
                updatedBy,
                previousCostAmount: record.costAmount,
                menuItemSizeId: record.sizeId,
            }
        })

        const [err, result] = await prismaIt(menuItemCostVariationPrismaEntity.upsertMany(menuItemId, costVariations))

        if (err) {
            return badRequest(err)
        }

        return ok(`Os custos da ficha tecnica foi atualizado com sucesso`)
    }

    return ok("Elemento atualizado com successo")
}

export default function AdminGerenciamentoCardapioCostManagementIndex() {
    const { data } = useLoaderData<typeof loader>()

    const actionData = useActionData<typeof action>();

    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
        });
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "Ok",
            description: actionData.message,
        });
    }

    return (
        <div className="flex flex-col gap-4">

            <Suspense fallback={<Loading />}>
                <Await resolve={data}>
                    {/* @ts-ignore */}
                    {([menuItemsWithCostVariations, user]) => {

                        {/* @ts-ignore */ }
                        const [items, setItems] = useState<MenuItemWithCostVariations[]>(menuItemsWithCostVariations || [])

                        const [optVisibleItems, setOptVisibleItems] = useState<boolean | null>(true)
                        const [optActiveItems, setOptActiveItems] = useState<boolean | null>(null)

                        const handleOptionVisibileItems = (state: boolean) => {
                            setOptVisibleItems(state)
                            setOptActiveItems(null)
                            // @ts-ignore
                            setItems(menuItemsWithCostVariations.filter(item => item.visible === state && item.active === true))
                        }
                        const handleOptionActiveItems = (state: boolean) => {
                            setOptActiveItems(state)
                            setOptVisibleItems(null)
                            // @ts-ignore
                            setItems(menuItemsWithCostVariations.filter(item => item.active === state))
                        }


                        return (
                            <div className="flex flex-col">
                                <div className="flex gap-4 items-center justify-center">
                                    <OptionTab label="Venda ativa" onClickFn={() => handleOptionVisibileItems(true)} state={true} highlightCondition={optVisibleItems === true && optActiveItems === null} />
                                    <span>-</span>
                                    <OptionTab label="Venda pausada" onClickFn={() => handleOptionVisibileItems(false)} state={false} highlightCondition={optVisibleItems === false && optActiveItems === null} />
                                    <span>-</span>
                                    <OptionTab label="Inativos" onClickFn={() => handleOptionActiveItems(false)} state={false} highlightCondition={optActiveItems === false && optVisibleItems === null} />

                                </div>
                                <Separator className="my-4" />
                                <div className="h-[500px] overflow-y-scroll">
                                    <ul>
                                        {
                                            // @ts-ignore
                                            items.map((menuItem: MenuItemWithCostVariations) => {

                                                return (
                                                    <li key={menuItem.menuItemId} className="p-2">
                                                        <div className="flex justify-between  items-center mb-4 bg-slate-300 rounded-md px-4 py-1">

                                                            <h3 className="text-md font-semibold">{menuItem.name}</h3>
                                                            <Form method="post" className="flex gap-2">
                                                                <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                                                                {/* @ts-ignore */}
                                                                <input type="hidden" name="updatedBy" value={user?.email || ""} />
                                                                <SubmitButton
                                                                    actionName="menu-item-cost-variation-upsert-all-proposed-input"
                                                                    tabIndex={0}
                                                                    cnContainer="bg-white border w-full hover:bg-slate-200"
                                                                    cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                                                                    hideIcon
                                                                    idleText="Aceitar todas as propostas"
                                                                    loadingText="Aceitando..."
                                                                />
                                                            </Form>
                                                        </div>

                                                        <ul className="grid grid-cols-5 gap-x-1">
                                                            {menuItem.costVariations.map((record) => (
                                                                <section key={randomReactKey()} className="mb-8">

                                                                    <ul className="flex gap-6">
                                                                        <li key={record.sizeId} className={
                                                                            cn(
                                                                                "p-2 rounded-md",
                                                                            )
                                                                        }>
                                                                            <div className="flex flex-col">
                                                                                <div className={
                                                                                    cn(
                                                                                        " mb-2",
                                                                                        record.sizeKey === "pizza-medium" && "grid place-items-center bg-black",
                                                                                    )
                                                                                }>
                                                                                    <h4 className={
                                                                                        cn(
                                                                                            "text-[12px] font-medium uppercase tracking-wider",
                                                                                            record.sizeKey === "pizza-medium" && "font-semibold text-white",
                                                                                        )
                                                                                    }>
                                                                                        {record.sizeName}
                                                                                    </h4>
                                                                                </div>

                                                                                <Form method="post" className="flex flex-col gap-1 justify-center items-center">
                                                                                    <div className="flex flex-col gap-2 mb-2">
                                                                                        <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                                                                                        <input type="hidden" name="menuItemCostVariationId" value={record.menuItemCostVariationId ?? ""} />
                                                                                        <input type="hidden" name="menuItemSizeId" value={record.sizeId ?? ""} />
                                                                                        {/* @ts-ignore */}
                                                                                        <input type="hidden" name="updatedBy" value={record.updatedBy || user?.email || ""} />
                                                                                        <input type="hidden" name="previousCostAmount" value={record.previousCostAmount} />

                                                                                        <div className="grid grid-cols-2 gap-2">

                                                                                            <div className="flex flex-col gap-1 items-center">
                                                                                                <div className="flex flex-col gap-y-0">
                                                                                                    <span className="text-muted-foreground text-[11px]">Novo custo:</span>
                                                                                                    <NumericInput name="costAmount" defaultValue={record.costAmount} />
                                                                                                </div>
                                                                                                <SubmitButton
                                                                                                    actionName="menu-item-cost-variation-upsert-user-input"
                                                                                                    tabIndex={0}
                                                                                                    cnContainer="md:py-0 bg-slate-300 hover:bg-slate-400"
                                                                                                    cnLabel="text-[11px] tracking-widest text-black uppercase"
                                                                                                    iconColor="black"
                                                                                                />
                                                                                            </div>

                                                                                            <div className="flex flex-col gap-1 items-center">
                                                                                                <div className="flex flex-col gap-y-0">
                                                                                                    <span className="text-muted-foreground text-[11px]">Valor proposto</span>
                                                                                                    <NumericInput name="proposedCostAmount" defaultValue={record.proposedCostAmount} readOnly />
                                                                                                </div>
                                                                                                <SubmitButton
                                                                                                    actionName="menu-item-cost-variation-upsert-proposed-input"
                                                                                                    tabIndex={0}
                                                                                                    cnContainer="bg-white border w-full hover:bg-slate-200"
                                                                                                    cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                                                                                                    hideIcon
                                                                                                    idleText="Aceitar proposta"
                                                                                                    loadingText="Aceitando..."
                                                                                                />
                                                                                            </div>

                                                                                        </div>




                                                                                        <div className="flex flex-col gap-1">
                                                                                            <span className="text-xs">Custo atual: {record.costAmount}</span>
                                                                                            <span className="text-xs text-muted-foreground">Custo anterior: {record.previousCostAmount}</span>
                                                                                        </div>
                                                                                    </div>


                                                                                </Form>
                                                                            </div>
                                                                        </li>

                                                                    </ul>
                                                                </section>
                                                            ))}

                                                        </ul>


                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
                                </div>
                            </div>
                        )

                    }}
                </Await>
            </Suspense>


        </div>
    )
}

