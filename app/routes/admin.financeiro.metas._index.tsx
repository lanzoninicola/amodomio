import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as React from "react";

import prismaClient from "~/lib/prisma/client.server";
import formatMoneyString from "~/utils/format-money-string";
import { Button } from "@/components/ui/button";

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent !== "activateHistoryGoal") {
    return json({ ok: false, message: "Intent inválido." }, { status: 400 });
  }

  const goalId = String(form.get("goalId") || "");
  if (!goalId) {
    return json({ ok: false, message: "Meta não informada." }, { status: 400 });
  }

  const goal = await prismaClient.financialDailyGoal.findUnique({
    where: { id: goalId },
    select: { id: true },
  });

  if (!goal) {
    return json({ ok: false, message: "Meta não encontrada." }, { status: 404 });
  }

  await prismaClient.$transaction([
    prismaClient.financialDailyGoal.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prismaClient.financialDailyGoal.update({
      where: { id: goalId },
      data: { isActive: true },
    }),
  ]);

  return redirect("/admin/financeiro/metas");
}

export async function loader({}: LoaderFunctionArgs) {
  const activeGoal = await prismaClient.financialDailyGoal.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      targetProfitPerc: true,
      salesDistributionPctDay01: true,
      salesDistributionPctDay02: true,
      salesDistributionPctDay03: true,
      salesDistributionPctDay04: true,
      salesDistributionPctDay05: true,
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

  const history = await prismaClient.financialDailyGoal.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      targetProfitPerc: true,
      salesDistributionPctDay01: true,
      salesDistributionPctDay02: true,
      salesDistributionPctDay03: true,
      salesDistributionPctDay04: true,
      salesDistributionPctDay05: true,
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

  return json({ activeGoal, history });
}

const dayConfig = [
  {
    dayLabel: "DIA 1 (Quarta)",
    pctKey: "salesDistributionPctDay01",
    minKey: "minSalesGoalAmountDia01",
    targetKey: "targetSalesGoalAmountDia01",
  },
  {
    dayLabel: "DIA 2 (Quinta)",
    pctKey: "salesDistributionPctDay02",
    minKey: "minSalesGoalAmountDia02",
    targetKey: "targetSalesGoalAmountDia02",
  },
  {
    dayLabel: "DIA 3 (Sexta)",
    pctKey: "salesDistributionPctDay03",
    minKey: "minSalesGoalAmountDia03",
    targetKey: "targetSalesGoalAmountDia03",
  },
  {
    dayLabel: "DIA 4 (Sábado)",
    pctKey: "salesDistributionPctDay04",
    minKey: "minSalesGoalAmountDia04",
    targetKey: "targetSalesGoalAmountDia04",
  },
  {
    dayLabel: "DIA 5 (Domingo)",
    pctKey: "salesDistributionPctDay05",
    minKey: "minSalesGoalAmountDia05",
    targetKey: "targetSalesGoalAmountDia05",
  },
] as const;

function asMoney(value: number) {
  return `R$ ${formatMoneyString(value ?? 0, 2)}`;
}

function asPct(value: number) {
  return `${formatMoneyString(value ?? 0, 2)}%`;
}

function normalizeDiff(value: number) {
  return Math.abs(value) < 0.005 ? 0 : value;
}

function asSignedMoneyDiff(value: number) {
  const normalized = normalizeDiff(value);
  const sign = normalized > 0 ? "+" : normalized < 0 ? "-" : "";
  return `${sign}R$ ${formatMoneyString(Math.abs(normalized), 2)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function GoalDaysGrid({
  goal,
  highlightActive = false,
  baselineGoal,
}: {
  goal: any;
  highlightActive?: boolean;
  baselineGoal?: any | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {dayConfig.map(({ dayLabel, pctKey, minKey, targetKey }) => (
        <div key={dayLabel} className="rounded-md border p-3 space-y-2">
          <p className="font-semibold">{dayLabel}</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">% distribuição</p>
              <p className="font-mono text-lg">{asPct(Number(goal?.[pctKey] ?? 0))}</p>
            </div>
            <div className={highlightActive ? "rounded-md border border-emerald-200 bg-emerald-50 p-2" : ""}>
              <p className="text-muted-foreground">Meta mínima</p>
              <p className="font-mono text-lg">{asMoney(Number(goal?.[minKey] ?? 0))}</p>
              {baselineGoal ? (
                <p
                  className={`font-mono text-sm ${
                    normalizeDiff(Number(goal?.[minKey] ?? 0) - Number(baselineGoal?.[minKey] ?? 0)) > 0
                      ? "text-emerald-700"
                      : normalizeDiff(Number(goal?.[minKey] ?? 0) - Number(baselineGoal?.[minKey] ?? 0)) < 0
                        ? "text-red-700"
                        : "text-muted-foreground"
                  }`}
                >
                  Δ{" "}
                  {asSignedMoneyDiff(
                    Number(goal?.[minKey] ?? 0) - Number(baselineGoal?.[minKey] ?? 0),
                  )}
                </p>
              ) : null}
            </div>
            <div className={highlightActive ? "rounded-md border border-blue-200 bg-blue-50 p-2" : ""}>
              <p className="text-muted-foreground">Meta target</p>
              <p className={`font-mono text-lg ${highlightActive ? "font-semibold" : ""}`}>{asMoney(Number(goal?.[targetKey] ?? 0))}</p>
              {baselineGoal ? (
                <p
                  className={`font-mono text-sm ${
                    normalizeDiff(Number(goal?.[targetKey] ?? 0) - Number(baselineGoal?.[targetKey] ?? 0)) > 0
                      ? "text-emerald-700"
                      : normalizeDiff(Number(goal?.[targetKey] ?? 0) - Number(baselineGoal?.[targetKey] ?? 0)) < 0
                        ? "text-red-700"
                        : "text-muted-foreground"
                  }`}
                >
                  Δ{" "}
                  {asSignedMoneyDiff(
                    Number(goal?.[targetKey] ?? 0) - Number(baselineGoal?.[targetKey] ?? 0),
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminFinanceiroMetasIndexRoute() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const activeGoal = data.activeGoal;
  const history = data.history;
  const isSubmitting = navigation.state !== "idle";
  const latestHistoryGoal = history[0] ?? null;
  const activeDistributionSum = activeGoal
    ? Number(activeGoal.salesDistributionPctDay01) +
      Number(activeGoal.salesDistributionPctDay02) +
      Number(activeGoal.salesDistributionPctDay03) +
      Number(activeGoal.salesDistributionPctDay04) +
      Number(activeGoal.salesDistributionPctDay05)
    : 0;

  return (
    <div className="space-y-4">
      <Card className="bg-muted/40">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <p className="text-base leading-relaxed text-black max-w-prose">
                A Meta Mínima representa a receita bruta diária mínima necessária para sustentar o
                Ponto de Equilíbrio (PE). A Meta Target é calculada aplicando o percentual de lucro
                desejado sobre a Meta Mínima, definindo a receita diária bruta esperada com margem
                de lucro.
              </p>
              <Button asChild className="shrink-0 text-base font-semibold">
                <Link to="/admin/financeiro/metas/create">Criar meta</Link>
              </Button>
            </div>

            <details className="rounded-md border bg-background/70 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Como esta meta é calculada
              </summary>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-prose">
                As metas são calculadas sobre <strong>receita bruta</strong>.
                A base vem da média do campo <code>pontoEquilibrioAmount</code> dos últimos meses
                fechados no modelo <code>FinancialMonthlyClose</code> (página{" "}
                <code>/fechamento-mensal</code>). Esse PE é calculado na lógica atual com base
                na receita bruta. Depois, aplicamos o{" "}
                <code>targetProfitPerc</code> sobre a Meta mínima para obter a Meta target.
              </p>
            </details>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meta ativa</CardTitle>
          <CardDescription>Visualização da meta com isActive = true.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeGoal ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta ativa no momento.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Criada em</p>
                  <p>{formatDate(String(activeGoal.createdAt))}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">% lucro desejado</p>
                  <p className="font-mono">{asPct(Number(activeGoal.targetProfitPerc ?? 0))}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Somatório da distribuição</p>
                  <p className="font-mono">{asPct(activeDistributionSum)}</p>
                </div>
              </div>

              {latestHistoryGoal ? (
                <p className="text-xs text-muted-foreground">
                  Δ comparado com a última meta do histórico.
                </p>
              ) : null}
              <GoalDaysGrid goal={activeGoal} highlightActive baselineGoal={latestHistoryGoal} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de metas</CardTitle>
          <CardDescription>Gerencie múltiplos históricos e reative uma meta quando necessário.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!history.length ? (
            <p className="text-sm text-muted-foreground">Sem histórico de metas.</p>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 bg-muted/40 text-sm font-medium">
                  <span>Data</span>
                  <span>% lucro</span>
                  <span>Distribuição</span>
                  <span className="md:col-span-2">Ações</span>
                </div>
              </div>

              {history.map((goal) => {
                const distributionSum =
                  Number(goal.salesDistributionPctDay01) +
                  Number(goal.salesDistributionPctDay02) +
                  Number(goal.salesDistributionPctDay03) +
                  Number(goal.salesDistributionPctDay04) +
                  Number(goal.salesDistributionPctDay05);

                const isExpanded = expandedId === goal.id;

                return (
                  <div key={goal.id} className="rounded-md border p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm items-center">
                      <span className="text-muted-foreground">{formatDate(String(goal.createdAt))}</span>
                      <span className="font-mono">{asPct(Number(goal.targetProfitPerc ?? 0))}</span>
                      <span className="font-mono">{asPct(distributionSum)}</span>
                      <div className="md:col-span-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : goal.id)}
                        >
                          {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                        </Button>

                        <Form method="post">
                          <input type="hidden" name="intent" value="activateHistoryGoal" />
                          <input type="hidden" name="goalId" value={goal.id} />
                          <Button size="sm" disabled={isSubmitting}>
                            Tornar ativa
                          </Button>
                        </Form>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="space-y-2">
                        {activeGoal ? (
                          <p className="text-xs text-muted-foreground">
                            Δ comparado com a meta ativa atual.
                          </p>
                        ) : null}
                        <GoalDaysGrid goal={goal} baselineGoal={activeGoal} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
