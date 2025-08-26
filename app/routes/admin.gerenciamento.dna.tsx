import { LoaderFunctionArgs, defer, type ActionFunction } from "@remix-run/node";
import { useActionData, Form, Await, useLoaderData, Link } from "@remix-run/react";
import { Suspense, useState, useTransition } from "react";

import SubmitButton from "~/components/primitives/submit-button/submit-button";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import toFixedNumber from "~/utils/to-fixed-number";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import DnaEmpresaForm from "~/domain/finance/components/dna-empresa-form";
import getSearchParam from "~/utils/get-search-param";


export async function loader({ request, params }: LoaderFunctionArgs) {

    const dnaEmpresaSettings = prismaIt(prismaClient.dnaEmpresaSettings.findFirst());

    const redirectFrom = getSearchParam({ request, paramName: "redirectFrom" })


    return defer({
        dnaEmpresaSettings,
        redirectFrom
    });
}

type ActionData = {
    errors?: {
        faturamentoBrutoAmount?: string;
        custoFixoAmount?: string;
        taxaCartaoPerc?: string;
        impostoPerc?: string;
        wastePerc?: string;
        dnaPerc?: string;
    };
    ok?: string;
};

export const action: ActionFunction = async ({ request }) => {
    const formData = await request.formData();
    const actionName = formData.get("actionName")?.toString();

    if (actionName === "dna-empresa-update") {
        const faturamentoBrutoAmount = Number(formData.get("faturamentoBrutoAmount") ?? 0);
        const custoFixoAmount = Number(formData.get("custoFixoAmount") ?? 0);
        const taxaCartaoPerc = Number(formData.get("taxaCartaoPerc") ?? 0);
        const impostoPerc = Number(formData.get("impostoPerc") ?? 0);
        const wastePerc = Number(formData.get("wastePerc") ?? 0);

        const errors: ActionData["errors"] = {};
        if (!Number.isFinite(faturamentoBrutoAmount) || faturamentoBrutoAmount <= 0) {
            errors.faturamentoBrutoAmount = "Informe um faturamento bruto válido (> 0)";
        }
        if (!Number.isFinite(custoFixoAmount) || custoFixoAmount < 0) {
            errors.custoFixoAmount = "Informe um custo fixo válido (>= 0)";
        }

        if (Object.keys(errors).length > 0) {
            return badRequest<ActionData>({ errors });
        }

        const custoFixoPerc = faturamentoBrutoAmount > 0 ? (custoFixoAmount / faturamentoBrutoAmount) * 100 : 0;
        const dnaPerc = toFixedNumber(custoFixoPerc) + toFixedNumber(taxaCartaoPerc) + toFixedNumber(impostoPerc) + toFixedNumber(wastePerc);

        const current = await prismaClient.dnaEmpresaSettings.findFirst();
        const saved = current
            ? await prismaClient.dnaEmpresaSettings.update({
                where: { id: current.id },
                data: {
                    faturamentoBrutoAmount,
                    custoFixoAmount,
                    custoFixoPerc: custoFixoPerc,
                    taxaCartaoPerc,
                    impostoPerc,
                    wastePerc,
                    dnaPerc,
                },
            })
            : await prismaClient.dnaEmpresaSettings.create({
                data: {
                    faturamentoBrutoAmount,
                    custoFixoAmount,
                    custoFixoPerc: custoFixoPerc,
                    taxaCartaoPerc,
                    impostoPerc,
                    wastePerc,
                    dnaPerc,
                },
            });

        return ok<ActionData>({ ok: "Salvo" });
    }

    return badRequest<ActionData>({ errors: { dnaPerc: "Ação inválida" } });
};

export default function AdminGerenciamentoCardapioDna() {
    const actionData = useActionData<ActionData>();
    const { dnaEmpresaSettings, redirectFrom } = useLoaderData<typeof loader>();
    const [isFormTouched, setIsFormTouched] = useState(false);
    const [isPending, startTransition] = useTransition();

    return (
        <Form method="post" className="space-y-6" onSubmit={() => startTransition(() => { })}>
            <input type="hidden" name="actionName" value="dna-empresa-update" />

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">DNA da Empresa</h2>
                <Suspense fallback={<Loading cnContainer="h-24" />}>
                    <Await resolve={redirectFrom} >
                        {(redirectFrom) => {

                            if (redirectFrom) {
                                return (
                                    <Link to={`/${redirectFrom ?? ""}`}>
                                        <p className="text-xs underline uppercase tracking-widest">
                                            Voltar
                                        </p>
                                    </Link>
                                )
                            }
                        }}



                    </Await>
                </Suspense>

            </div>
            <p className="text-sm text-muted-foreground">
                Ajuste os parâmetros e salve para atualizar o DNA (%).
            </p>

            <Separator />

            <Suspense fallback={<Loading cnContainer="h-24" />}>
                <Await resolve={dnaEmpresaSettings} errorElement={<div className="text-red-600">Erro ao carregar</div>}>
                    {(settings) => {

                        const values = {
                            faturamentoBrutoAmount: settings[1]?.faturamentoBrutoAmount ?? 0,
                            custoFixoAmount: settings[1]?.custoFixoAmount ?? 0,
                            taxaCartaoPerc: settings[1]?.taxaCartaoPerc ?? 0,
                            impostoPerc: settings[1]?.impostoPerc ?? 0,
                            wastePerc: settings[1]?.wastePerc ?? 0,
                            dnaPerc: settings[1]?.dnaPerc ?? 0,
                        } as const;

                        return (
                            <div className="space-y-6">
                                {/*
                  SUBSTITUIÇÃO: bloco anterior foi trocado

                */}
                                <DnaEmpresaForm
                                    defaultValues={values}
                                    errors={actionData?.errors}
                                    onAnyFieldChange={() => setIsFormTouched(true)}
                                    readOnlyCalculated
                                />

                                {isFormTouched && (
                                    <Alert variant="default" className="border-amber-300">
                                        <TriangleAlert className="h-4 w-4" />
                                        <AlertTitle>Você alterou valores</AlertTitle>
                                        <AlertDescription>
                                            Clique em <strong>Salvar</strong> para recalcular e persistir o DNA.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <Separator />

                                <div className="flex justify-end">
                                    <SubmitButton disabled={isPending} actionName="dna-empresa-update" >
                                        {isPending ? "Salvando..." : "Salvar"}
                                    </SubmitButton>
                                </div>
                            </div>
                        );
                    }}
                </Await>
            </Suspense>
        </Form>
    );
}
