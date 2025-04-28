
import { MenuItemCostVariation } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, } from "@remix-run/node";
import { Await, useLoaderData, defer, Form, useActionData, Link } from "@remix-run/react";
import { Settings } from "lucide-react";
import { Suspense } from "react";
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

    const menuItemsWithCostVariations = menuItemPrismaEntity.findAllWithCostVariations()

    const user = authenticator.isAuthenticated(request);

    const data = Promise.all([menuItemsWithCostVariations, user]);

    return defer({
        data
    })
}

export async function action({ request }: ActionFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    console.log({ action: _action, values })

    if (_action === "menu-item-cost-variation-update") {

        /**
         * {
          action: 'menu-item-cost-variation-update',
          values: {
            menuItemId: '81de6228-e3e4-4740-a229-a101c741004e',
            menuItemCostingVariationId: '',
            updatedBy: 'lanzoni.nicola@gmail.com',
            previousCostAmount: '',
            costAmount: ''
          }
         */

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

        console.log({ err })

        if (err) {
            return badRequest(err)
        }


        // const menuItemPriceVariationId = values?.menuItemPriceVariationId as string
        // const menuItemId = values?.menuItemId as string
        // const variationId = values?.variationId as string
        // const amount = toFixedNumber(values?.amount, 2) || 0
        // const latestAmount = toFixedNumber(values?.latestAmount, 2) || 0
        // const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)
        // const showOnCardapio = values?.showOnCardapio === "on" ? true : false
        // const updatedBy = values?.updatedBy as string

        // const nextPrice: Partial<MenuItemPriceVariation> = {
        //     id: menuItemPriceVariationId,
        //     menuItemId,
        //     amount,
        //     discountPercentage,
        //     showOnCardapio,
        //     latestAmount,
        //     updatedBy,
        //     menuItemVariationId: variationId,
        //     basePrice: amount,
        // }

        // console.log({ nextPrice })

        // const [err, result] = await prismaIt(menuItemPriceVariationsEntity.upsert(menuItemPriceVariationId, nextPrice))

        // console.log({ err })

        // if (err) {
        //     return badRequest(err)
        // }

        return ok(`O custo da ficha tecnica foi atualizado com sucesso`)
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



                        return (
                            <div className="h-[500px] overflow-y-scroll">
                                <ul>
                                    {
                                        // @ts-ignore
                                        menuItemsWithCostVariations.map((menuItem: MenuItemWithCostVariations) => {

                                            return (
                                                <li key={menuItem.menuItemId} className="mb-6  p-2">
                                                    <div className="flex flex-col gap-0 mb-4 bg-slate-300 rounded-md px-4 py-1">
                                                        <span className="text-md font-semibold">{menuItem.name}</span>
                                                        {/* <span className="text-[10px] text-muted-foreground">{menuItem.ingredients}</span> */}
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
                                                                            <span className={
                                                                                cn(
                                                                                    "text-[12px] font-medium uppercase tracking-wider",
                                                                                    record.sizeKey === "pizza-medium" && "font-semibold",
                                                                                )
                                                                            }>
                                                                                {record.sizeName}
                                                                            </span>

                                                                            <Form method="post" className="flex flex-col gap-1 justify-center items-center">
                                                                                <div className="flex flex-col gap-2 mb-2">
                                                                                    <div className="flex gap-1">
                                                                                        <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                                                                                        <input type="hidden" name="menuItemCostVariationId" value={record.menuItemCostVariationId ?? ""} />
                                                                                        <input type="hidden" name="menuItemSizeId" value={record.sizeId ?? ""} />
                                                                                        <input type="hidden" name="updatedBy" value={record.updatedBy || user?.email || ""} />
                                                                                        <input type="hidden" name="previousCostAmount" value={record.previousCostAmount} />

                                                                                        <div className="flex flex-col gap-y-0">
                                                                                            <span className="text-muted-foreground text-[11px]">Custo Ficha Tecnica</span>
                                                                                            <NumericInput name="costAmount" defaultValue={0} />
                                                                                        </div>


                                                                                    </div>

                                                                                    <div className="flex flex-col gap-1">
                                                                                        <div className="flex flex-col gap-1">
                                                                                            <span className="text-xs font-semibold">Valor proposto: {record.proposedCostAmount}</span>
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1">
                                                                                            <span className="text-xs">Custo atual: {record.costAmount}</span>
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1">
                                                                                            <span className="text-xs text-muted-foreground">Custo anterior: {record.previousCostAmount}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                <SubmitButton
                                                                                    actionName="menu-item-cost-variation-update"
                                                                                    tabIndex={0}
                                                                                    cnContainer="md:px-12 md:py-0 bg-slate-300 hover:bg-slate-400"
                                                                                    cnLabel="text-[11px] tracking-widest text-black uppercase"
                                                                                    iconColor="black"
                                                                                />
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
                        )

                    }}
                </Await>
            </Suspense>


        </div>
    )
}

