import { LoaderFunctionArgs, defer, type ActionFunction, type MetaFunction } from "@remix-run/node";
import { useActionData, Form, Await, useLoaderData, Link } from "@remix-run/react";
import { Suspense, useState, useTransition } from "react";
import type { FinancialMonthlyClose } from "@prisma/client";

import SubmitButton from "~/components/primitives/submit-button/submit-button";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import toFixedNumber from "~/utils/to-fixed-number";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import DnaEmpresaForm, { type DnaFieldHistory, type DnaFieldHistorySummary } from "~/domain/finance/components/dna-empresa-form";
import getSearchParam from "~/utils/get-search-param";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { calcMonthlyCloseTotals } from "~/domain/finance/calc-monthly-close-totals";

export const meta: MetaFunction = () => [
    { title: "DNA da Empresa | Admin" },
];

function average(values: number[], size: number) {
    const slice = values.slice(0, size);
    if (!slice.length) return null;
    return slice.reduce((acc, value) => acc + value, 0) / slice.length;
}

function formatReferenceMonthYear(referenceMonth: number, referenceYear: number) {
    return new Intl.DateTimeFormat("pt-BR", {
        month: "2-digit",
        year: "numeric",
    }).format(new Date(referenceYear, referenceMonth - 1, 1));
}

function buildHistorySummary(
    values: number[],
    kind: "money" | "percent",
    options?: {
        note?: string;
        latestReferenceLabel?: string | null;
    }
): DnaFieldHistorySummary {
    const note = options?.note;
    if (note) {
        return { kind, note, latestReferenceLabel: options?.latestReferenceLabel ?? null };
    }

    return {
        kind,
        latest: values[0] ?? null,
        avg3: average(values, 3),
        avg6: average(values, 6),
        latestReferenceLabel: options?.latestReferenceLabel ?? null,
    };
}

function buildFieldHistory(closes: FinancialMonthlyClose[]): DnaFieldHistory {
    const latestClose = closes[0];
    const latestReferenceLabel = latestClose
        ? formatReferenceMonthYear(latestClose.referenceMonth, latestClose.referenceYear)
        : null;
    const monthlyValues = closes.map((close) => {
        const totals = calcMonthlyCloseTotals(close);
        const receitaBase = close.faturamentoMensalAmount ?? 0;
        const custoFixoPerc = receitaBase > 0 ? (totals.custoFixoTotal / receitaBase) * 100 : 0;
        const custoVariavelPerc = totals.receitaBruta > 0 ? (totals.custoVariavelTotal / totals.receitaBruta) * 100 : 0;
        const dnaPerc = custoFixoPerc + (close.taxaCartaoPerc ?? 0) + (close.impostoPerc ?? 0);

        return {
            faturamentoBrutoAmount: receitaBase,
            custoFixoAmount: totals.custoFixoTotal,
            taxaCartaoPerc: close.taxaCartaoPerc ?? 0,
            impostoPerc: close.impostoPerc ?? 0,
            custoVariavelPerc,
            dnaPerc,
        };
    });

    return {
        faturamentoBrutoAmount: buildHistorySummary(monthlyValues.map((item) => item.faturamentoBrutoAmount), "money", { latestReferenceLabel }),
        custoFixoAmount: buildHistorySummary(monthlyValues.map((item) => item.custoFixoAmount), "money", { latestReferenceLabel }),
        taxaCartaoPerc: buildHistorySummary(monthlyValues.map((item) => item.taxaCartaoPerc), "percent", { latestReferenceLabel }),
        impostoPerc: buildHistorySummary(monthlyValues.map((item) => item.impostoPerc), "percent", { latestReferenceLabel }),
        investimentoPerc: buildHistorySummary([], "percent", {
            note: "Preenchimento manual. Nao usa historico do fechamento mensal.",
            latestReferenceLabel,
        }),
        wastePerc: buildHistorySummary([], "percent", {
            note: "Sem historico equivalente no fechamento mensal.",
            latestReferenceLabel,
        }),
        dnaPerc: buildHistorySummary(
            monthlyValues.map((item) => item.dnaPerc),
            "percent",
            {
                latestReferenceLabel,
                note: monthlyValues.length
                    ? "Baseado em faturamento, custos fixos, taxa de cartao e impostos do fechamento mensal."
                    : undefined,
            },
        ),
        custoVariavelPerc: buildHistorySummary(monthlyValues.map((item) => item.custoVariavelPerc), "percent", { latestReferenceLabel }),
    };
}

export async function loader({ request }: LoaderFunctionArgs) {
    const dnaEmpresaSettings = prismaIt(
        prismaClient.dnaEmpresaSettings.findFirst({
            where: { isSnapshot: false },
            orderBy: { createdAt: "desc" },
        })
    );
    const dnaEmpresaSnapshots = prismaIt(
        prismaClient.dnaEmpresaSettings.findMany({
            where: { isSnapshot: true },
            orderBy: { createdAt: "desc" },
            take: 15,
        })
    );
    const monthlyCloseRepo = (prismaClient as any).financialMonthlyClose;
    const monthlyCloses: FinancialMonthlyClose[] =
        monthlyCloseRepo && typeof monthlyCloseRepo.findMany === "function"
            ? await monthlyCloseRepo.findMany({
                orderBy: [
                    { referenceYear: "desc" },
                    { referenceMonth: "desc" },
                ],
                take: 6,
            })
            : [];
    const redirectFrom = getSearchParam({ request, paramName: "redirectFrom" });
    const fieldHistory = buildFieldHistory(monthlyCloses);

    return defer({ dnaEmpresaSettings, dnaEmpresaSnapshots, redirectFrom, fieldHistory });
}

type ActionData = {
    errors?: {
        faturamentoBrutoAmount?: string;
        custoFixoAmount?: string;
        taxaCartaoPerc?: string;
        impostoPerc?: string;
        investimentoPerc?: string;
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
        const investimentoPerc = Number(formData.get("investimentoPerc") ?? 0);
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
        if (!Number.isFinite(investimentoPerc) || investimentoPerc < 0) {
            errors.investimentoPerc = "Informe investimento (%) válido (>= 0)";
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
            toFixedNumber(investimentoPerc) +
            toFixedNumber(wastePerc);

        await prismaClient.$transaction([
            prismaClient.dnaEmpresaSettings.deleteMany({
                where: { isSnapshot: false },
            }),
            prismaClient.dnaEmpresaSettings.create({
                data: {
                    faturamentoBrutoAmount,
                    custoFixoAmount,
                    custoFixoPerc: custoFixoPerc,
                    taxaCartaoPerc,
                    impostoPerc,
                    investimentoPerc,
                    wastePerc,
                    custoVariavelPerc,
                    dnaPerc,
                    isSnapshot: false,
                },
            }),
        ]);

        return ok<ActionData>({ ok: "Salvo" });
    }

    if (actionName === "dna-empresa-create-snapshot") {
        // description é opcional segundo o modelo fornecido (String?)
        const descriptionRaw = formData.get("description");
        const description = descriptionRaw == null ? null : String(descriptionRaw).trim() || null;

        const settings = await prismaClient.dnaEmpresaSettings.findFirst({
            where: { isSnapshot: false },
            orderBy: { createdAt: "desc" },
        });
        if (!settings) {
            return badRequest<ActionData>({ errors: { dnaPerc: "Configuração DNA não encontrada para snapshot" } });
        }

        // Modelo: DnaEmpresaSettingsSnapshot sem relation/settingsId
        await prismaClient.dnaEmpresaSettings.create({
            data: {
                isSnapshot: true,
                description,
                faturamentoBrutoAmount: Number(settings.faturamentoBrutoAmount ?? 0),
                custoFixoAmount: Number(settings.custoFixoAmount ?? 0),
                custoFixoPerc: Number(settings.custoFixoPerc ?? 0),
                taxaCartaoPerc: Number(settings.taxaCartaoPerc ?? 0),
                impostoPerc: Number(settings.impostoPerc ?? 0),
                investimentoPerc: Number((settings as any).investimentoPerc ?? 0),
                dnaPerc: Number(settings.dnaPerc ?? 0),
                wastePerc: Number(settings.wastePerc ?? 0),
                custoVariavelAmount: Number((settings as any).custoVariavelAmount ?? 0),
                custoVariavelPerc: Number((settings as any).custoVariavelPerc ?? 0),
            },
        });

        return ok<ActionData>({ ok: "Snapshot criado" });
    }

    return badRequest<ActionData>({ errors: { dnaPerc: "Ação inválida" } });
};

export default function AdminVendasDna() {
    const actionData = useActionData<ActionData>();
    const { dnaEmpresaSettings, dnaEmpresaSnapshots, redirectFrom, fieldHistory } = useLoaderData<typeof loader>();
    const [isFormTouched, setIsFormTouched] = useState(false);
    const [isPending, startTransition] = useTransition();

    return (
        <div className="space-y-6">
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
                            const currentSettings = settings[1];
                            const values = {
                                faturamentoBrutoAmount: currentSettings?.faturamentoBrutoAmount ?? 0,
                                custoFixoAmount: currentSettings?.custoFixoAmount ?? 0,
                                taxaCartaoPerc: currentSettings?.taxaCartaoPerc ?? 0,
                                impostoPerc: currentSettings?.impostoPerc ?? 0,
                                investimentoPerc: (currentSettings as any)?.investimentoPerc ?? 0,
                                wastePerc: currentSettings?.wastePerc ?? 0,
                                custoVariavelPerc: currentSettings?.custoVariavelPerc ?? 0,
                                dnaPerc: currentSettings?.dnaPerc ?? 0,
                            } as const;
                            const lastCalculatedAt = currentSettings?.createdAt
                                ? new Date(currentSettings.createdAt).toLocaleString("pt-BR")
                                : null;
                            const staleThreshold = new Date();
                            staleThreshold.setMonth(staleThreshold.getMonth() - 2);
                            const isCalculationOlderThanTwoMonths = currentSettings?.createdAt
                                ? new Date(currentSettings.createdAt) < staleThreshold
                                : false;

                            return (
                                <div className="space-y-6">
                                    {lastCalculatedAt ? (
                                        <p className="text-sm text-muted-foreground">
                                            Calculado em <span className="font-medium text-foreground">{lastCalculatedAt}</span>
                                        </p>
                                    ) : null}

                                    {isCalculationOlderThanTwoMonths ? (
                                        <Alert variant="default" className="border-amber-300">
                                            <TriangleAlert className="h-4 w-4" />
                                            <AlertTitle>Cálculo do DNA desatualizado</AlertTitle>
                                            <AlertDescription>
                                                O último cálculo foi feito há mais de 2 meses. Revise os valores e clique em <strong>Salvar</strong> para recalcular.
                                            </AlertDescription>
                                        </Alert>
                                    ) : null}

                                    <DnaEmpresaForm
                                        defaultValues={values}
                                        errors={actionData?.errors}
                                        onAnyFieldChange={() => setIsFormTouched(true)}
                                        readOnlyCalculated
                                        fieldHistory={fieldHistory}
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
                                        <li key={s.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 text-sm">
                                            <span className="md:col-span-3 font-medium">{s.description ?? "-"}</span>
                                            <span className="opacity-80">Fatur.: {Number(s.faturamentoBrutoAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                            <span className="opacity-80">C.Fixo: {Number(s.custoFixoAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                            <span className="opacity-80">C.Fixo%: {Number(s.custoFixoPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                            <span className="opacity-80">Cartão: {Number(s.taxaCartaoPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                            <span className="opacity-80">Impostos: {Number(s.impostoPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                            <span className="opacity-80">Invest.: {Number((s as any).investimentoPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                            <span className="opacity-80">Waste: {Number(s.wastePerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                            <span className="opacity-80">Variáveis: {Number(s.custoVariavelPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                            <span className="opacity-80 font-medium">DNA: {Number(s.dnaPerc ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                            <span className="md:col-start-12 md:text-right opacity-70">{new Date(s.createdAt).toLocaleString("pt-BR")}</span>
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
