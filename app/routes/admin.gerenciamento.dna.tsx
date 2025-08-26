import { LoaderFunctionArgs, MetaFunction, defer, type ActionFunction } from "@remix-run/node";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

// Titulo pagina
export const meta: MetaFunction = () => {
    return [{ title: "DNA | Gerenciamento" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const dnaEmpresaSettings = prismaIt(prismaClient.dnaEmpresaSettings.findFirst());
    const dnaEmpresaSnapshots = prismaIt(
        prismaClient.dnaEmpresaSettingsSnapshot.findMany({
            orderBy: { createdAt: "desc" },
            take: 15,
        })
    );
    const redirectFrom = getSearchParam({ request, paramName: "redirectFrom" });

    return defer({ dnaEmpresaSettings, dnaEmpresaSnapshots, redirectFrom });
}

type ActionData = {
    errors?: {
        faturamentoBrutoAmount?: string;
        custoFixoAmount?: string;
        taxaCartaoPerc?: string;
        impostoPerc?: string;
        wastePerc?: string;
        custoVariavelPerc?: string;
        dnaPerc?: string;
        description?: string;
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
        const custoVariavelPerc = Number(formData.get("custoVariavelPerc") ?? 0);

        const errors: ActionData["errors"] = {};
        if (!Number.isFinite(faturamentoBrutoAmount) || faturamentoBrutoAmount <= 0) {
            errors.faturamentoBrutoAmount = "Informe um faturamento bruto válido (> 0)";
        }
        if (!Number.isFinite(custoFixoAmount) || custoFixoAmount < 0) {
            errors.custoFixoAmount = "Informe um custo fixo válido (>= 0)";
        }
        if (!Number.isFinite(custoVariavelPerc) || custoVariavelPerc < 0) {
            errors.custoVariavelPerc = "Informe custos variáveis (%) válido (>= 0)";
        }
        if (Object.keys(errors).length > 0) {
            return badRequest<ActionData>({ errors });
        }

        const custoFixoPerc = faturamentoBrutoAmount > 0 ? (custoFixoAmount / faturamentoBrutoAmount) * 100 : 0;
        // DNA NÃO inclui custoVariavelPerc por requisito
        const dnaPerc =
            toFixedNumber(custoFixoPerc) +
            toFixedNumber(taxaCartaoPerc) +
            toFixedNumber(impostoPerc) +
            toFixedNumber(wastePerc);

        const current = await prismaClient.dnaEmpresaSettings.findFirst();
        await (current
            ? prismaClient.dnaEmpresaSettings.update({
                where: { id: current.id },
                data: {
                    faturamentoBrutoAmount,
                    custoFixoAmount,
                    custoFixoPerc: custoFixoPerc,
                    taxaCartaoPerc,
                    impostoPerc,
                    wastePerc,
                    custoVariavelPerc, // persistência apenas
                    dnaPerc,
                },
            })
            : prismaClient.dnaEmpresaSettings.create({
                data: {
                    faturamentoBrutoAmount,
                    custoFixoAmount,
                    custoFixoPerc: custoFixoPerc,
                    taxaCartaoPerc,
                    impostoPerc,
                    wastePerc,
                    custoVariavelPerc,
                    dnaPerc,
                },
            }));

        return ok<ActionData>({ ok: "Salvo" });
    }

    if (actionName === "dna-empresa-create-snapshot") {
        // description é opcional segundo o modelo fornecido (String?)
        const descriptionRaw = formData.get("description");
        const description = descriptionRaw == null ? null : String(descriptionRaw).trim() || null;

        const settings = await prismaClient.dnaEmpresaSettings.findFirst();
        if (!settings) {
            return badRequest<ActionData>({ errors: { dnaPerc: "Configuração DNA não encontrada para snapshot" } });
        }

        // Modelo: DnaEmpresaSettingsSnapshot sem relation/settingsId
        await prismaClient.dnaEmpresaSettingsSnapshot.create({
            data: {
                description,
                faturamentoBrutoAmount: Number(settings.faturamentoBrutoAmount ?? 0),
                custoFixoAmount: Number(settings.custoFixoAmount ?? 0),
                custoFixoPerc: Number(settings.custoFixoPerc ?? 0),
                taxaCartaoPerc: Number(settings.taxaCartaoPerc ?? 0),
                impostoPerc: Number(settings.impostoPerc ?? 0),
                dnaPerc: Number(settings.dnaPerc ?? 0),
                wastePerc: Number(settings.wastePerc ?? 0),
                custoVariavelPerc: Number((settings as any).custoVariavelPerc ?? 0),
            },
        });

        return ok<ActionData>({ ok: "Snapshot criado" });
    }

    return badRequest<ActionData>({ errors: { dnaPerc: "Ação inválida" } });
};

export default function AdminGerenciamentoDna() {
    const actionData = useActionData<ActionData>();
    const { dnaEmpresaSettings, dnaEmpresaSnapshots, redirectFrom } = useLoaderData<typeof loader>();
    const [isFormTouched, setIsFormTouched] = useState(false);
    const [isPending, startTransition] = useTransition();

    return (
        <div className="space-y-6 mb-12">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">DNA da Empresa</h2>
                <Suspense fallback={<Loading cnContainer="h-24" />}>
                    <Await resolve={redirectFrom}>
                        {(rf) => rf ? (
                            <Link to={`/${rf}`}>
                                <p className="text-xs underline uppercase tracking-widest">Voltar</p>
                            </Link>
                        ) : null}
                    </Await>
                </Suspense>
            </div>
            <p className="text-sm text-muted-foreground">Ajuste os parâmetros e salve para atualizar o DNA (%).</p>

            <Separator />

            <Form method="post" className="space-y-6" onSubmit={() => startTransition(() => { })}>
                <input type="hidden" name="actionName" value="dna-empresa-update" />

                <Suspense fallback={<Loading cnContainer="h-24" />}>
                    <Await resolve={dnaEmpresaSettings} errorElement={<div className="text-red-600">Erro ao carregar</div>}>
                        {(settings) => {
                            const values = {
                                faturamentoBrutoAmount: settings[1]?.faturamentoBrutoAmount ?? 0,
                                custoFixoAmount: settings[1]?.custoFixoAmount ?? 0,
                                taxaCartaoPerc: settings[1]?.taxaCartaoPerc ?? 0,
                                impostoPerc: settings[1]?.impostoPerc ?? 0,
                                wastePerc: settings[1]?.wastePerc ?? 0,
                                custoVariavelPerc: settings[1]?.custoVariavelPerc ?? 0,
                                dnaPerc: settings[1]?.dnaPerc ?? 0,
                            } as const;

                            return (
                                <div className="space-y-6">
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

                                    <div className="flex items-center justify-between">
                                        {/* Botão de Snapshot */}
                                        <SnapshotDialog />

                                        <div className="flex justify-end">
                                            <SubmitButton disabled={isPending} actionName="dna-empresa-update">
                                                {isPending ? "Salvando..." : "Salvar"}
                                            </SubmitButton>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    </Await>
                </Suspense>
            </Form>

            <Separator />

            {/* Lista de snapshots */}
            <section className="space-y-3">
                <h3 className="font-semibold">Snapshots recentes</h3>
                <Suspense fallback={<Loading cnContainer="h-20" />}>
                    <Await resolve={dnaEmpresaSnapshots} errorElement={<div className="text-red-600">Erro ao carregar snapshots</div>}>
                        {(snapTuple) => {
                            const snaps = snapTuple?.[1] ?? [];
                            if (!snaps.length) return <p className="text-sm text-muted-foreground">Nenhum snapshot ainda.</p>;
                            return (
                                <ul className="divide-y rounded-md border">
                                    {snaps.map((s: any) => (
                                        <li key={s.id} className="grid grid-cols-1 md:grid-cols-12 p-3 text-sm">
                                            <p className="md:col-span-2 font-semibold">{s.description ?? "-"}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-7 md:col-span-9">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">Faturamento Bruto</span>
                                                    <span className="opacity-80">{Number(s.faturamentoBrutoAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">C. Fixo</span>
                                                    <span className="opacity-80">{Number(s.custoFixoAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">C. Fixo</span>
                                                    <span className="opacity-80">{Number(s.custoFixoPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">Cartão</span>
                                                    <span className="opacity-80">{Number(s.taxaCartaoPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">Waste</span>
                                                    <span className="opacity-80">{Number(s.wastePerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">DNA</span>
                                                    <span className="opacity-80">{Number(s.dnaPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">C. Variavel</span>
                                                    <span className="opacity-80">{Number(s.custoVariavelPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                                </div>

                                            </div>
                                            <p className="md:col-span-1 md:text-right opacity-70">{new Date(s.createdAt).toLocaleString("pt-BR")}</p>
                                        </li>

                                    ))}
                                </ul>
                            );
                        }}
                    </Await>
                </Suspense>
            </section>
        </div>
    );
}

function SnapshotDialog() {
    const [open, setOpen] = useState(false);
    const [desc, setDesc] = useState("");
    const [pending, startTransition] = useTransition();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary">Criar snapshot</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <Form method="post" onSubmit={() => startTransition(() => { })}>
                    <input type="hidden" name="actionName" value="dna-empresa-create-snapshot" />
                    <DialogHeader>
                        <DialogTitle>Novo snapshot</DialogTitle>
                    </DialogHeader>
                    <div className="py-2 space-y-2">
                        <label className="text-sm text-muted-foreground" htmlFor="description">Descrição</label>
                        <Input id="description" name="description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Pós-ajuste de tarifas" />
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                        <SubmitButton actionName="dna-empresa-create-snapshot" disabled={pending || !desc.trim()}>
                            {pending ? "Criando..." : "Criar"}
                        </SubmitButton>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
