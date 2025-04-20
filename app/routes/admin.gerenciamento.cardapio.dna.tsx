import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { useActionData, Form, Await, useLoaderData } from "@remix-run/react";

import { Suspense, useTransition } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import prismaClient from "~/lib/prisma/client.server";

import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { toast } from "~/components/ui/use-toast";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import { Separator } from "~/components/ui/separator";
import toFixedNumber from "~/utils/to-fixed-number";


export async function loader({ request }: LoaderFunctionArgs) {

    const dnaEmpresaSettings = prismaIt(prismaClient.dnaEmpresaSettings.findFirst())



    return defer({
        dnaEmpresaSettings
    })
}


type ActionData = {
    errors?: {
        faturamentoBrutoAmount?: string;
        custoFixoAmount?: string;
        taxaCartaoPerc?: string;
        taxaMarketplacePerc?: string;
        impostoPerc?: string;
    };
};

export const action: ActionFunction = async ({ request }) => {
    const formData = await request.formData();

    // Extração dos valores do formulário
    const faturamentoBrutoAmount = formData.get("faturamentoBrutoAmount");
    const custoFixoAmount = formData.get("custoFixoAmount");
    const taxaCartaoPerc = formData.get("taxaCartaoPerc");
    const taxaMarketplacePerc = formData.get("taxaMarketplacePerc");
    const impostoPerc = formData.get("impostoPerc");


    // Validação simples (é possível aprimorar conforme necessário)
    let errors: ActionData["errors"] = {};
    if (!faturamentoBrutoAmount || isNaN(Number(faturamentoBrutoAmount))) {
        errors.faturamentoBrutoAmount = "Valor inválido para faturamento bruto";
    }
    if (!custoFixoAmount || isNaN(Number(custoFixoAmount))) {
        errors.custoFixoAmount = "Valor inválido para custo fixo";
    }
    // Outras validações podem ser feitas para os demais campos

    if (Object.keys(errors).length > 0) {
        return json({ errors }, { status: 400 });
    }

    const settingsRecord = await prismaClient.dnaEmpresaSettings.findFirst();

    const custoFixoPerc = toFixedNumber(toFixedNumber(custoFixoAmount) / toFixedNumber(faturamentoBrutoAmount) * 100);
    const dnaPerc = toFixedNumber(custoFixoPerc) + toFixedNumber(taxaCartaoPerc) + toFixedNumber(taxaMarketplacePerc) + toFixedNumber(impostoPerc);


    if (!settingsRecord) {
        // create the record
        const [err, record] = await prismaIt(prismaClient.dnaEmpresaSettings.create({
            data: {
                faturamentoBrutoAmount: Number(faturamentoBrutoAmount),
                custoFixoAmount: Number(custoFixoAmount),
                custoFixoPerc,
                taxaCartaoPerc: Number(taxaCartaoPerc),
                taxaMarketplacePerc: Number(taxaMarketplacePerc),
                impostoPerc: Number(impostoPerc),
                dnaPerc,
            },
        }));

        if (err) {
            return badRequest(err);
        }

        return ok(record);
    }

    // Atualize o registro no banco de dados (exemplo: atualizando o registro com id 1)
    const [err, record] = await prismaIt(prismaClient.dnaEmpresaSettings.update({
        where: { id: settingsRecord.id },
        data: {
            faturamentoBrutoAmount: Number(faturamentoBrutoAmount),
            custoFixoAmount: Number(custoFixoAmount),
            custoFixoPerc,
            taxaCartaoPerc: Number(taxaCartaoPerc),
            taxaMarketplacePerc: Number(taxaMarketplacePerc),
            impostoPerc: Number(impostoPerc),
            dnaPerc,
        },
    }))

    if (err) {
        return badRequest(err);
    }

    return ok('Atualizado'); // Redireciona para uma página de sucesso
};


export default function DnaEmpresaSettingsPage() {
    const { dnaEmpresaSettings } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const [isPending, startTransition] = useTransition()

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
        <Form method="post" >
            <Suspense fallback={<Loading />}>

                <Await resolve={dnaEmpresaSettings}>
                    {([err, dnaEmpresaSettings]) => {


                        // @ts-ignore
                        return (
                            <div className="mb-6">
                                <div className="flex flex-col mb-4">
                                    <h3 className="font-semibold mb-2">DNA da Empresa</h3>
                                    <div className="flex flex-col">
                                        <p className="text-sm text-muted-foreground mb-2">
                                            A percentagem do DNA (%) deve ser imbutida ao preço de venda do produto
                                        </p>
                                        <div className="text-sm flex items-center gap-2">
                                            <p className="font-semibold">Fonte:</p>
                                            <a href="https://www.youtube.com/watch?v=iOitqHfbRHA&list=PL5G6QFIQaDlQOkSW24dvXlxg7FPzi6eNH&index=19"
                                                target="_blank"
                                            >Video Youtube</a>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:px-64 md:py-6">
                                    <div className="flex flex-col gap-2 mb-4 justify-center ">
                                        <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground ">
                                                Faturamento Bruto (R$)
                                            </span>
                                            <NumericInput name="faturamentoBrutoAmount" defaultValue={dnaEmpresaSettings?.faturamentoBrutoAmount || 0} />
                                            {actionData?.errors?.faturamentoBrutoAmount && (
                                                <span className="text-red-500 text-xs">
                                                    {actionData.errors.faturamentoBrutoAmount}
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground ">
                                                Custo Fixo (R$)
                                            </span>
                                            <NumericInput name="custoFixoAmount" defaultValue={dnaEmpresaSettings?.custoFixoAmount || 0} />
                                            {actionData?.errors?.custoFixoAmount && (
                                                <span className="text-red-500 text-xs">
                                                    {actionData.errors.custoFixoAmount}
                                                </span>
                                            )}
                                        </div>



                                        <div className="grid grid-cols-2">
                                            <span className="text-muted-foreground ">
                                                Custo Fixo (%)
                                            </span>
                                            <NumericInput
                                                name="custoFixoPerc"
                                                defaultValue={dnaEmpresaSettings?.custoFixoPerc || 0}
                                                className="border-none  bg-slate-100"
                                                readOnly
                                            />
                                        </div>

                                        <Separator className="my-4" />

                                        <div className="flex flex-col gap-4">

                                            <div className="grid grid-cols-2">
                                                <span className="text-muted-foreground ">
                                                    Taxa cartão (%)
                                                </span>
                                                <NumericInput name="taxaCartaoPerc" defaultValue={dnaEmpresaSettings?.taxaCartaoPerc || 0} />
                                                {actionData?.errors?.taxaCartaoPerc && (
                                                    <span className="text-red-500 text-xs">
                                                        {actionData.errors.taxaCartaoPerc}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2">
                                                <span className="text-muted-foreground ">
                                                    Taxa marketplace (%)
                                                </span>
                                                <NumericInput name="taxaMarketplacePerc" defaultValue={dnaEmpresaSettings?.taxaCartaoPerc || 0} />
                                                {actionData?.errors?.taxaMarketplacePerc && (
                                                    <span className="text-red-500 text-xs">
                                                        {actionData.errors.taxaMarketplacePerc}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2">
                                                <span className="text-muted-foreground ">
                                                    Imposto (%)
                                                </span>
                                                <NumericInput name="impostoPerc" defaultValue={dnaEmpresaSettings?.impostoPerc || 0} />
                                                {actionData?.errors?.impostoPerc && (
                                                    <span className="text-red-500 text-xs">
                                                        {actionData.errors.impostoPerc}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2">
                                                <span className="text-muted-foreground ">
                                                    DNA (%)
                                                </span>

                                                <NumericInput
                                                    name="dnaPerc"
                                                    defaultValue={dnaEmpresaSettings?.dnaPerc || 0}
                                                    decimalScale={2}
                                                    className="border-none bg-slate-100 font-semibold text-lg"
                                                    readOnly
                                                />
                                            </div>

                                        </div>
                                    </div>
                                    <SubmitButton
                                        actionName="dna-empresa-update"
                                        disabled={isPending === true}
                                    >
                                        {isPending === true ? "Salvando..." : "Salvar"}
                                    </SubmitButton>
                                </div>


                            </div>
                        )
                    }}
                </Await>
            </Suspense>


        </Form >
    );
}