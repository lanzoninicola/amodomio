import { MenuItemPriceVariation } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, } from "@remix-run/node";
import { Await, useLoaderData, defer, Form, Link, useActionData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemPriceVariationsEntity } from "~/domain/cardapio/menu-item-price-variations.prisma.entity.server";
import { MenuItemWithSellPriceVariations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import ExportCsvButton from "~/domain/export-csv/components/export-csv-button/export-csv-button";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import parserFormDataEntryToNumber from "~/utils/parse-form-data-entry-to-number";
import randomReactKey from "~/utils/random-react-key";
import toFixedNumber from "~/utils/to-fixed-number";
import toNumber from "~/utils/to-number";



export async function loader({ request }: LoaderFunctionArgs) {

    const menuItemsWithSellPriceVariations = menuItemPrismaEntity.findAllWithPriceVariations()

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



        const menuItemPriceVariationId = values?.menuItemPriceVariationId as string
        const menuItemId = values?.menuItemId as string
        const variationId = values?.variationId as string
        const amount = toFixedNumber(values?.amount, 2) || 0
        const latestAmount = toFixedNumber(values?.latestAmount, 2) || 0
        const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)
        const showOnCardapio = values?.showOnCardapio === "on" ? true : false
        const updatedBy = values?.updatedBy as string

        const nextPrice: Partial<MenuItemPriceVariation> = {
            id: menuItemPriceVariationId,
            menuItemId,
            amount,
            discountPercentage,
            showOnCardapio,
            latestAmount,
            updatedBy,
            menuItemVariationId: variationId,
            basePrice: amount,
        }

        console.log({ nextPrice })

        const [err, result] = await prismaIt(menuItemPriceVariationsEntity.upsert(menuItemPriceVariationId, nextPrice))

        console.log({ err })

        if (err) {
            return badRequest(err)
        }

        return ok(`O preço de venda foi atualizado com sucesso`)
    }



    return ok("Elemento atualizado com successo")
}

export default function AdminGerenciamentoCardapioSellPriceManagement() {
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

                        return (

                            <>
                                <div className="flex items-center justify-center">
                                    <p className="text-lg">DNA Empresa: <span className="font-semibold text-xl">{dnaEmpresaSettings?.dnaPerc}%</span></p>
                                </div>

                                <div className="h-[500px] overflow-y-scroll">
                                    <ul>
                                        {
                                            // @ts-ignore
                                            menuItemsWithSellPriceVariations.map((menuItem: MenuItemWithSellPriceVariations) => {

                                                return (
                                                    <li key={menuItem.id} className="mb-6  p-2">
                                                        <div className="flex flex-col gap-0 mb-4 bg-slate-300 rounded-md px-4 py-1">
                                                            <span className="text-md font-semibold">{menuItem.name}</span>
                                                            {/* <span className="text-[10px] text-muted-foreground">{menuItem.ingredients}</span> */}
                                                        </div>

                                                        <ul className="flex flex-col">
                                                            {menuItem.priceVariations.map((grouped, index: number) => (
                                                                <section key={randomReactKey()} className="mb-8">
                                                                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-2">
                                                                        {grouped.group}
                                                                    </h3>

                                                                    <Separator className="my-2" />

                                                                    <ul className="flex gap-6">
                                                                        {grouped.variations.map((pv, index: number) => (
                                                                            <li key={randomReactKey()}>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[12px] font-medium uppercase tracking-wider">
                                                                                        {pv.variationName}
                                                                                    </span>

                                                                                    <Form method="post" className="flex flex-col gap-1 justify-center items-center">
                                                                                        <div className="flex flex-col gap-2">
                                                                                            <div className="flex gap-1">
                                                                                                <input type="hidden" name="menuItemPriceVariationId" value={pv.menuItemPriceVariationId ?? ""} />
                                                                                                <input type="hidden" name="menuItemId" value={menuItem.id} />
                                                                                                <input type="hidden" name="variationId" value={pv.variationId} />
                                                                                                <input type="hidden" name="updatedBy" value={pv.updatedBy || user?.email || ""} />
                                                                                                <input type="hidden" name="latestAmount" value={pv.latestAmount} />

                                                                                                <div className="flex flex-col gap-y-0">
                                                                                                    <span className="text-muted-foreground text-[11px]">Valor</span>
                                                                                                    <NumericInput name="amount" defaultValue={pv.amount} />
                                                                                                </div>

                                                                                                <div className="flex flex-col gap-y-0">
                                                                                                    <span className="text-muted-foreground text-[11px]">% Desc.</span>
                                                                                                    <NumericInput name="discountPercentage" value={pv.discountPercentage} decimalScale={0} />
                                                                                                </div>
                                                                                            </div>

                                                                                            <div className="flex flex-col gap-1">
                                                                                                <span className="text-xs text-muted-foreground">Último preço: {pv.latestAmount}</span>
                                                                                            </div>
                                                                                        </div>

                                                                                        <SubmitButton
                                                                                            actionName="menu-item-price-variation-update"
                                                                                            tabIndex={0}
                                                                                            cnContainer="md:px-12 md:py-0 bg-slate-300 hover:bg-slate-400"
                                                                                            cnLabel="text-[11px] tracking-widest text-black uppercase"
                                                                                            iconColor="black"
                                                                                        />
                                                                                    </Form>
                                                                                </div>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </section>
                                                            ))}

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

