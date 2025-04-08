import { MenuItemPriceVariation } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, } from "@remix-run/node";
import { Await, useLoaderData, defer, Form, Link } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Separator } from "~/components/ui/separator";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemPriceVariationsEntity } from "~/domain/cardapio/menu-item-price-variations.prisma.entity.server";
import { MenuItemWithSellPriceVariations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import ExportCsvButton from "~/domain/export-csv/components/export-csv-button/export-csv-button";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import parserFormDataEntryToNumber from "~/utils/parse-form-data-entry-to-number";



export async function loader({ request }: LoaderFunctionArgs) {

    const menuItemsWithSellPriceVariations = menuItemPrismaEntity.findAllPriceVariations()

    const user = authenticator.isAuthenticated(request);

    const dnaEmpresaSettings = prismaIt(prismaClient.dnaEmpresaSettings.findFirst())


    const data = Promise.all([menuItemsWithSellPriceVariations, user, dnaEmpresaSettings]);

    return defer({
        data
    })
}

export async function action({ request }: ActionFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    console.log({ action: _action, values })

    if (_action === "menu-item-price-variation-update") {

        const name = values?.name as string

        const amount = isNaN(Number(values?.amount)) ? 0 : Number(values?.amount)
        const latestAmount = parserFormDataEntryToNumber(values?.latestAmount)
        const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)
        const showOnCardapio = values?.showOnCardapio === "on" ? true : false
        const updatedBy = jsonParse(values?.updatedBy)?.email || ""

        const nextPrice: Partial<MenuItemPriceVariation> = {
            id: values.id as string,
            amount,
            discountPercentage,
            showOnCardapio,
            latestAmount,
            updatedBy
        }

        const [err, result] = await prismaIt(menuItemPriceVariationsEntity.update(values.id as string, nextPrice))

        if (err) {
            return badRequest(err)
        }

        return ok(`O preço de venda do item ${name} do tamanho ${values.sizeName} foi atualizado com sucesso`)
    }



    return ok("Elemento atualizado com successo")
}

export default function AdminGerenciamentoCardapioSellPriceManagement() {
    const { data } = useLoaderData<typeof loader>()

    return (
        <div className="flex flex-col gap-4">

            <div className="flex justify-between items-center">
                <ExportCsvButton context="menu-items-price-variations">
                    Exportar preços de venda
                </ExportCsvButton>
                <div className="flex gap-4">
                    <Link to="/admin/gerenciamento/cardapio/dna" className="flex items-center gap-1 text-sm underline">DNA Empresa</Link>
                </div>
            </div>




            <Suspense fallback={<Loading />}>
                <Await resolve={data}>
                    {/* @ts-ignore */}
                    {([menuItemsWithSellPriceVariations, user, [err, dnaEmpresaSettings]]) => {

                        console.log({ dnaEmpresaSettings })

                        return (

                            <>
                                <div className="flex items-center justify-center">
                                    <p className="text-lg">DNA Empresa: <span className="font-semibold text-xl">{dnaEmpresaSettings?.dnaPerc}%</span></p>
                                </div>

                                <div className="h-[500px] overflow-y-scroll">
                                    <ul>
                                        {
                                            menuItemsWithSellPriceVariations.map((menuItem: MenuItemWithSellPriceVariations) => {

                                                return (
                                                    <li key={menuItem.id} className="mb-6 hover:bg-slate-50 p-2">
                                                        <div className="flex flex-col gap-0 mb-4">
                                                            <span className="text-md font-semibold">{menuItem.name}</span>
                                                            {/* <span className="text-[10px] text-muted-foreground">{menuItem.ingredients}</span> */}
                                                        </div>

                                                        <ul className="grid grid-cols-5 gap-x-4">
                                                            {
                                                                menuItem.priceVariations.map(pv => {
                                                                    return (
                                                                        <li key={pv.menuItemPriceVariationId} >
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[12px] font-medium uppercase tracking-wider">{pv.variationName}</span>
                                                                                <Form method="post" className="flex flex-col gap-1 justify-center items-center">

                                                                                    <div className="flex gap-1">
                                                                                        <input type="hidden" name="name" defaultValue={menuItem.name} />
                                                                                        <input type="hidden" name="menuItemPriceVariationId" defaultValue={pv.menuItemPriceVariationId} />
                                                                                        <input type="hidden" name="updatedBy" defaultValue={pv.updatedBy || ""} />
                                                                                        <input type="hidden" name="name" defaultValue={pv.variationName} />
                                                                                        <div className="flex flex-col gap-y-0">
                                                                                            <span className="text-muted-foreground text-[11px]">Valor</span>
                                                                                            <NumericInput name="amount" defaultValue={pv.amount} placeholder="0" />
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-y-0">
                                                                                            <span className="text-muted-foreground text-[11px]">% Desc.</span>
                                                                                            <NumericInput name="discountPercentage" defaultValue={pv.discountPercentage} decimalScale={0} />
                                                                                        </div>

                                                                                    </div>

                                                                                    <SubmitButton actionName="menu-item-price-variation-update" tabIndex={0}
                                                                                        cnContainer="md:px-12 md:py-0 bg-slate-300 hover:bg-slate-400"
                                                                                        cnLabel="text-[11px] tracking-widest text-black uppercase"
                                                                                        iconColor="black"


                                                                                    />

                                                                                </Form>
                                                                            </div>
                                                                        </li>

                                                                    )
                                                                })
                                                            }
                                                        </ul>

                                                        <Separator className="my-4" />




                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
                                </div>

                            </>
                        )

                    }}
                </Await>
            </Suspense>


        </div>
    )
}

