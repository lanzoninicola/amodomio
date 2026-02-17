import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DecimalInput } from "~/components/inputs/inputs";
import { calcFinancialDailyGoalAmounts } from "~/domain/finance/calc-financial-daily-goal";
import prismaClient from "~/lib/prisma/client.server";
import formatMoneyString from "~/utils/format-money-string";

type ActionData = {
  ok: boolean;
  message: string;
};

const DEFAULT_MONTHS_WINDOW = 3;
const MIN_MONTHS_WINDOW = 1;
const MAX_MONTHS_WINDOW = 12;
const MAX_MONTHS_LOOKBACK = 36;
const DEFAULT_TARGET_PROFIT_PERC = 0;

function clampMonthsWindow(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MONTHS_WINDOW;
  return Math.max(MIN_MONTHS_WINDOW, Math.min(MAX_MONTHS_WINDOW, Math.trunc(value)));
}

function parseTargetProfitPerc(value: string | null, fallback: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function calcAveragePeFromCloses(
  closes: Array<{ pontoEquilibrioAmount: number }>,
) {
  if (!closes.length) return 0;
  const total = closes.reduce(
    (acc, close) => acc + Number(close.pontoEquilibrioAmount ?? 0),
    0,
  );
  return total / closes.length;
}

function pickClosesWithValidPe<T extends { pontoEquilibrioAmount: number }>(
  closes: T[],
  monthsWindow: number,
) {
  return closes
    .filter((close) => Number(close.pontoEquilibrioAmount ?? 0) > 0)
    .slice(0, monthsWindow);
}

function formatMonthYear(referenceMonth: number, referenceYear: number) {
  const date = new Date(referenceYear, Math.max(0, referenceMonth - 1), 1);
  return date.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const monthsWindow = clampMonthsWindow(Number(url.searchParams.get("months") || DEFAULT_MONTHS_WINDOW));

  const settings = await prismaClient.financialDailyGoalSettings.findFirst({
    orderBy: { id: "desc" },
    select: {
      targetProfitPerc: true,
      salesDistributionPctDay01: true,
      salesDistributionPctDay02: true,
      salesDistributionPctDay03: true,
      salesDistributionPctDay04: true,
      salesDistributionPctDay05: true,
    },
  });

  const monthlyClosesRaw = await prismaClient.financialMonthlyClose.findMany({
    orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }],
    take: MAX_MONTHS_LOOKBACK,
    select: {
      id: true,
      referenceMonth: true,
      referenceYear: true,
      pontoEquilibrioAmount: true,
    },
  });
  const monthlyCloses = pickClosesWithValidPe(monthlyClosesRaw, monthsWindow);
  const averagePeAmount = calcAveragePeFromCloses(monthlyCloses);
  const selectedTargetProfitPerc = parseTargetProfitPerc(
    url.searchParams.get("targetProfitPerc"),
    Number(settings?.targetProfitPerc ?? DEFAULT_TARGET_PROFIT_PERC),
  );

  const preview = settings
    ? calcFinancialDailyGoalAmounts({
      pontoEquilibrioAmount: averagePeAmount,
      targetProfitPerc: selectedTargetProfitPerc,
      salesDistributionPctDay01: Number(settings.salesDistributionPctDay01 ?? 0),
      salesDistributionPctDay02: Number(settings.salesDistributionPctDay02 ?? 0),
      salesDistributionPctDay03: Number(settings.salesDistributionPctDay03 ?? 0),
      salesDistributionPctDay04: Number(settings.salesDistributionPctDay04 ?? 0),
      salesDistributionPctDay05: Number(settings.salesDistributionPctDay05 ?? 0),
    })
    : null;

  const activeGoal = await prismaClient.financialDailyGoal.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetProfitPerc: true,
      minSalesGoalAmountDia01: true,
      minSalesGoalAmountDia02: true,
      minSalesGoalAmountDia03: true,
      minSalesGoalAmountDia04: true,
      minSalesGoalAmountDia05: true,
      targetSalesGoalAmountDia01: true,
      targetSalesGoalAmountDia02: true,
      targetSalesGoalAmountDia03: true,
      targetSalesGoalAmountDia04: true,
      targetSalesGoalAmountDia05: true,
    },
  });

  return json({
    settings,
    selectedTargetProfitPerc,
    monthsWindow,
    monthlyCloses,
    ignoredZeroPeCount: monthlyClosesRaw.length - monthlyCloses.length,
    averagePeAmount,
    preview,
    activeGoal,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const monthsWindow = clampMonthsWindow(Number(form.get("monthsWindow") || DEFAULT_MONTHS_WINDOW));
  const selectedTargetProfitPerc = parseTargetProfitPerc(
    String(form.get("targetProfitPerc") || ""),
    DEFAULT_TARGET_PROFIT_PERC,
  );

  if (intent !== "createGoal") {
    return json<ActionData>({ ok: false, message: "Intent inválido." }, { status: 400 });
  }

  const settings = await prismaClient.financialDailyGoalSettings.findFirst({
    orderBy: { id: "desc" },
    select: {
      targetProfitPerc: true,
      salesDistributionPctDay01: true,
      salesDistributionPctDay02: true,
      salesDistributionPctDay03: true,
      salesDistributionPctDay04: true,
      salesDistributionPctDay05: true,
    },
  });

  if (!settings) {
    return json<ActionData>(
      { ok: false, message: "Nenhuma configuração encontrada para gerar a meta." },
      { status: 400 },
    );
  }

  const monthlyClosesRaw = await prismaClient.financialMonthlyClose.findMany({
    orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }],
    take: MAX_MONTHS_LOOKBACK,
    select: {
      pontoEquilibrioAmount: true,
    },
  });
  const monthlyCloses = pickClosesWithValidPe(monthlyClosesRaw, monthsWindow);
  if (!monthlyCloses.length) {
    return json<ActionData>(
      { ok: false, message: "Nenhum fechamento mensal com PE > 0 disponível para calcular o PE médio." },
      { status: 400 },
    );
  }
  const averagePeAmount = calcAveragePeFromCloses(monthlyCloses);

  const calc = calcFinancialDailyGoalAmounts({
    pontoEquilibrioAmount: averagePeAmount,
    targetProfitPerc: selectedTargetProfitPerc,
    salesDistributionPctDay01: Number(settings.salesDistributionPctDay01 ?? 0),
    salesDistributionPctDay02: Number(settings.salesDistributionPctDay02 ?? 0),
    salesDistributionPctDay03: Number(settings.salesDistributionPctDay03 ?? 0),
    salesDistributionPctDay04: Number(settings.salesDistributionPctDay04 ?? 0),
    salesDistributionPctDay05: Number(settings.salesDistributionPctDay05 ?? 0),
  });

  await prismaClient.$transaction([
    prismaClient.financialDailyGoal.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prismaClient.financialDailyGoal.create({
      data: {
        financialSummaryId: null,
        isActive: true,
        targetProfitPerc: selectedTargetProfitPerc,
        salesDistributionPctDay01: Number(settings.salesDistributionPctDay01 ?? 0),
        salesDistributionPctDay02: Number(settings.salesDistributionPctDay02 ?? 0),
        salesDistributionPctDay03: Number(settings.salesDistributionPctDay03 ?? 0),
        salesDistributionPctDay04: Number(settings.salesDistributionPctDay04 ?? 0),
        salesDistributionPctDay05: Number(settings.salesDistributionPctDay05 ?? 0),
        minSalesGoalAmountDia01: calc.minSalesGoalAmountDia01,
        minSalesGoalAmountDia02: calc.minSalesGoalAmountDia02,
        minSalesGoalAmountDia03: calc.minSalesGoalAmountDia03,
        minSalesGoalAmountDia04: calc.minSalesGoalAmountDia04,
        minSalesGoalAmountDia05: calc.minSalesGoalAmountDia05,
        targetSalesGoalAmountDia01: calc.targetSalesGoalAmountDia01,
        targetSalesGoalAmountDia02: calc.targetSalesGoalAmountDia02,
        targetSalesGoalAmountDia03: calc.targetSalesGoalAmountDia03,
        targetSalesGoalAmountDia04: calc.targetSalesGoalAmountDia04,
        targetSalesGoalAmountDia05: calc.targetSalesGoalAmountDia05,
      },
    }),
  ]);

  return redirect("/admin/financeiro/metas");
}

const dayRows = [
  { label: "Dia 1 (Quarta)", pct: "salesDistributionPctDay01", min: "minSalesGoalAmountDia01", target: "targetSalesGoalAmountDia01" },
  { label: "Dia 2 (Quinta)", pct: "salesDistributionPctDay02", min: "minSalesGoalAmountDia02", target: "targetSalesGoalAmountDia02" },
  { label: "Dia 3 (Sexta)", pct: "salesDistributionPctDay03", min: "minSalesGoalAmountDia03", target: "targetSalesGoalAmountDia03" },
  { label: "Dia 4 (Sábado)", pct: "salesDistributionPctDay04", min: "minSalesGoalAmountDia04", target: "targetSalesGoalAmountDia04" },
  { label: "Dia 5 (Domingo)", pct: "salesDistributionPctDay05", min: "minSalesGoalAmountDia05", target: "targetSalesGoalAmountDia05" },
] as const;

function asMoney(value: number) {
  return `R$ ${formatMoneyString(value ?? 0, 2)}`;
}

function asPct(value: number) {
  return `${formatMoneyString(value ?? 0, 2)}%`;
}

function normalizeMoneyDiff(value: number) {
  // Avoid floating-point noise showing +/- 0,00 with wrong color/sign
  return Math.abs(value) < 0.005 ? 0 : value;
}

function asSignedMoneyDiff(value: number) {
  const normalized = normalizeMoneyDiff(value);
  const sign = normalized > 0 ? "+" : normalized < 0 ? "-" : "";
  return `${sign}R$ ${formatMoneyString(Math.abs(normalized), 2)}`;
}

export default function AdminFinanceiroMetasCreateRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const distributionSum = data.settings
    ? Number(data.settings.salesDistributionPctDay01) +
    Number(data.settings.salesDistributionPctDay02) +
    Number(data.settings.salesDistributionPctDay03) +
    Number(data.settings.salesDistributionPctDay04) +
    Number(data.settings.salesDistributionPctDay05)
    : 0;
  const hasActiveGoal = Boolean(data.activeGoal);
  const usedMonths = data.monthlyCloses.length;
  const usedMonthsLabel = data.monthlyCloses
    .map(
      (close) =>
        `${formatMonthYear(close.referenceMonth, close.referenceYear)}: ${asMoney(
          Number(close.pontoEquilibrioAmount ?? 0),
        )}`,
    )
    .join(", ");
  const canCreateGoal = usedMonths > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Criar nova meta</CardTitle>
          <CardDescription>Use as configurações atuais para gerar e ativar uma nova meta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-4">
            <p className="text-sm leading-relaxed">
              A meta será criada com base na média do Ponto de Equilíbrio (PE) dos últimos meses
              fechados em contabilidade e nas configurações de distribuição por dia. Primeiro
              calculamos a <strong>Meta mínima</strong> de cada dia para sustentar essa base média
              de PE. Depois aplicamos o <strong>% de lucro desejado</strong> sobre essa base para
              gerar a <strong>Meta target</strong>. Ao confirmar, essa nova meta passa a ser a meta
              ativa.
            </p>
          </div>

          {!data.settings ? (
            <p className="text-sm text-red-700">Nenhuma configuração encontrada em settings.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:items-start">
                <div className="rounded-lg border p-4 space-y-3 self-start md:col-span-2 bg-gradient-to-b from-muted/20 to-muted/40">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PE médio usado no cálculo</p>
                    <span className="text-[11px] text-muted-foreground">
                      Média de {usedMonths}/{data.monthsWindow} meses
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Form
                        method="get"
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <label htmlFor="months" className="text-xs text-muted-foreground">
                          Janela PE (meses):
                        </label>
                        <Select name="months" defaultValue={String(data.monthsWindow)}>
                          <SelectTrigger id="months" className="h-8 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="6">6</SelectItem>
                            <SelectItem value="12">12</SelectItem>
                          </SelectContent>
                        </Select>
                        <input type="hidden" name="targetProfitPerc" value={String(data.selectedTargetProfitPerc)} />
                        <Button type="submit" variant="outline" >
                          Atualizar
                        </Button>
                      </Form>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Base: {usedMonths} de {data.monthsWindow} mês(es) solicitado(s) com PE {">"} 0
                        {usedMonthsLabel ? ` (${usedMonthsLabel})` : ""}.
                      </p>
                      {usedMonths < data.monthsWindow ? (
                        <p className="text-xs text-amber-700">
                          Nem todos os meses solicitados tinham PE válido (&gt; 0). Meses com PE zero
                          foram ignorados.
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-end">
                      <p className="font-mono text-3xl font-semibold">{asMoney(Number(data.averagePeAmount ?? 0))}</p>
                    </div>
                  </div>

                  {!canCreateGoal ? (
                    <p className="text-xs text-red-700">
                      Nenhum fechamento mensal disponível para calcular a média do PE.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border p-4 self-start md:col-span-1 bg-blue-50/50 border-blue-200">
                  <p className="text-xs text-muted-foreground mb-6">
                    % lucro desejado{" "}
                    <span className="text-muted-foreground/80">
                      (inicial: {asPct(Number(data.settings?.targetProfitPerc ?? 0))})
                    </span>
                  </p>
                  <Form
                    method="get"
                    className="mt-2 flex items-center gap-2"
                  >
                    <input type="hidden" name="months" value={String(data.monthsWindow)} />
                    <DecimalInput
                      name="targetProfitPerc"
                      defaultValue={Number(data.selectedTargetProfitPerc ?? 0)}
                      fractionDigits={2}
                      className="w-28 text-xl py-6"
                    />
                    <Button type="submit" variant="outline" >
                      Atualizar
                    </Button>
                    <Button asChild type="button" variant="ghost">
                      <Link
                        to={`?months=${data.monthsWindow}&targetProfitPerc=${Number(
                          data.settings?.targetProfitPerc ?? 0,
                        )}`}
                      >
                        Reset
                      </Link>
                    </Button>
                  </Form>
                </div>

                <div className="rounded-lg border p-4 self-start md:col-span-1">
                  <p className="text-xs text-muted-foreground">Somatório da distribuição</p>
                  <p className="font-mono text-3xl font-semibold">{asPct(distributionSum)}</p>
                </div>
              </div>

              {data.preview ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Pré-visualização da nova meta</p>
                  {hasActiveGoal ? (
                    <p className="text-xs text-muted-foreground">
                      Δ mostra a diferença da nova meta em relação à meta ativa atual.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Não há meta ativa para comparar. O Δ será exibido após existir uma meta ativa.
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dayRows.map((row) => {
                      const previewMin = Number(data.preview?.[row.min] ?? 0);
                      const previewTarget = Number(data.preview?.[row.target] ?? 0);
                      const activeMin = Number(data.activeGoal?.[row.min] ?? 0);
                      const activeTarget = Number(data.activeGoal?.[row.target] ?? 0);
                      const diffMin = normalizeMoneyDiff(previewMin - activeMin);
                      const diffTarget = normalizeMoneyDiff(previewTarget - activeTarget);

                      return (
                        <div key={row.label} className="rounded-md border p-3">
                          <p className="font-semibold">{row.label}</p>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">% distribuição</p>
                              <p className="font-mono">{asPct(Number(data.settings?.[row.pct] ?? 0))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Meta mínima</p>
                              <p className="font-mono text-lg">{asMoney(previewMin)}</p>
                              {hasActiveGoal ? (
                                <p
                                  className={`font-mono text-sm ${diffMin > 0
                                    ? "text-emerald-700"
                                    : diffMin < 0
                                      ? "text-red-700"
                                      : "text-muted-foreground"
                                    }`}
                                >
                                  Δ {asSignedMoneyDiff(diffMin)}
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <p className="text-muted-foreground">Meta target</p>
                              <p className="font-mono text-lg font-semibold">{asMoney(previewTarget)}</p>
                              {hasActiveGoal ? (
                                <p
                                  className={`font-mono text-sm ${diffTarget > 0
                                    ? "text-emerald-700"
                                    : diffTarget < 0
                                      ? "text-red-700"
                                      : "text-muted-foreground"
                                    }`}
                                >
                                  Δ {asSignedMoneyDiff(diffTarget)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <Form method="post" className="flex items-center gap-2">
                <input type="hidden" name="intent" value="createGoal" />
                <input type="hidden" name="monthsWindow" value={String(data.monthsWindow)} />
                <input
                  type="hidden"
                  name="targetProfitPerc"
                  value={String(data.selectedTargetProfitPerc)}
                />
                <Button disabled={isSubmitting || !canCreateGoal}>
                  {isSubmitting ? "Gerando..." : "Confirmar e gerar meta"}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin/financeiro/metas">Cancelar</Link>
                </Button>
              </Form>
            </>
          )}
        </CardContent>
      </Card>

      {actionData ? (
        <Card className="border-red-300 bg-red-50/50">
          <CardContent className="pt-6">
            <p className="text-red-700">{actionData.message}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
