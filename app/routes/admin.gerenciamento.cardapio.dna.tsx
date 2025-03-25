import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { useActionData, Form, Await, useLoaderData } from "@remix-run/react";
import { ok } from "assert";
import { Suspense, useTransition } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import prismaClient from "~/lib/prisma/client.server";

import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest } from "~/utils/http-response.server";
import { toast } from "~/components/ui/use-toast";
import Loading from "~/components/loading/loading";


export async function loader({ request }: LoaderFunctionArgs) {

    const dnaEmpresaSettings = prismaClient.dnaEmpresaSettings.findFirst()

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
    const custoFixoPerc = formData.get("custoFixoPerc");
    const taxaCartaoPerc = formData.get("taxaCartaoPerc");
    const taxaMarketplacePerc = formData.get("taxaMarketplacePerc");
    const impostoPerc = formData.get("impostoPerc");
    const dnaPerc = formData.get("dnaPerc");

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

    if (!settingsRecord) {
        // create the record
        const [err, record] = await prismaIt(prismaClient.dnaEmpresaSettings.create({
            data: {
                faturamentoBrutoAmount: Number(faturamentoBrutoAmount),
                custoFixoAmount: Number(custoFixoAmount),
                custoFixoPerc: Number(custoFixoPerc),
                taxaCartaoPerc: Number(taxaCartaoPerc),
                taxaMarketplacePerc: Number(taxaMarketplacePerc),
                impostoPerc: Number(impostoPerc),
                dnaPerc: Number(dnaPerc),
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
            custoFixoPerc: Number(custoFixoPerc),
            taxaCartaoPerc: Number(taxaCartaoPerc),
            taxaMarketplacePerc: Number(taxaMarketplacePerc),
            impostoPerc: Number(impostoPerc),
            dnaPerc: Number(dnaPerc),
        },
    }))

    if (err) {
        return badRequest(err);
    }

    return ok('Atualizdo'); // Redireciona para uma página de sucesso
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
                    {(is) => {

                        // @ts-ignore
                        return (
                            <div className="mb-6">
                                <div className="flex flex-col mb-4">
                                    <h3 className="font-semibold">DNA da Empresa</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Essa percentagem deve ser imbutida ao preço de venda do produto
                                    </p>
                                </div>
                                <div className="flex gap-2 mb-4">
                                    <div className="flex flex-col gap-y-0">
                                        <span className="text-muted-foreground text-[11px]">
                                            Faturamento Bruto (R$)
                                        </span>
                                        <Input name="faturamentoBrutoAmount" defaultValue={0} />
                                        {actionData?.errors?.faturamentoBrutoAmount && (
                                            <span className="text-red-500 text-xs">
                                                {actionData.errors.faturamentoBrutoAmount}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-y-0">
                                        <span className="text-muted-foreground text-[11px]">
                                            Custo Fixo (R$)
                                        </span>
                                        <Input name="custoFixoAmount" defaultValue={0} />
                                        {actionData?.errors?.custoFixoAmount && (
                                            <span className="text-red-500 text-xs">
                                                {actionData.errors.custoFixoAmount}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-y-0">
                                        <span className="text-muted-foreground text-[11px]">
                                            Custo Fixo (%)
                                        </span>
                                        <Input
                                            name="custoFixoPerc"
                                            defaultValue={0}
                                            className="border-none"
                                            readOnly
                                        />
                                    </div>

                                    <div className="flex flex-col gap-y-0">
                                        <span className="text-muted-foreground text-[11px]">
                                            Taxa cartão (%)
                                        </span>
                                        <Input name="taxaCartaoPerc" defaultValue={0} />
                                        {actionData?.errors?.taxaCartaoPerc && (
                                            <span className="text-red-500 text-xs">
                                                {actionData.errors.taxaCartaoPerc}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-y-0">
                                        <span className="text-muted-foreground text-[11px]">
                                            Taxa marketplace (%)
                                        </span>
                                        <Input name="taxaMarketplacePerc" defaultValue={0} />
                                        {actionData?.errors?.taxaMarketplacePerc && (
                                            <span className="text-red-500 text-xs">
                                                {actionData.errors.taxaMarketplacePerc}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-y-0">
                                        <span className="text-muted-foreground text-[11px]">
                                            Imposto (%)
                                        </span>
                                        <Input name="impostoPerc" defaultValue={0} />
                                        {actionData?.errors?.impostoPerc && (
                                            <span className="text-red-500 text-xs">
                                                {actionData.errors.impostoPerc}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-y-0">
                                        <span className="text-muted-foreground text-[11px]">
                                            DNA (%)
                                        </span>
                                        <Input
                                            name="dnaPerc"
                                            defaultValue={0}
                                            className="border-none"
                                            readOnly
                                        />
                                    </div>
                                </div>

                                <SubmitButton
                                    actionName="dna-empresa-update"
                                    disabled={isPending === true}
                                >
                                    {isPending === true ? "Salvando..." : "Salvar"}
                                </SubmitButton>
                            </div>
                        )
                    }}
                </Await>
            </Suspense>


        </Form >
    );
}