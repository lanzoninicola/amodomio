// app/routes/admin.financeiro.metas.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import { Await, Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import * as React from "react";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

import prismaClient from "~/lib/prisma/client.server";
import { DecimalInput } from "~/components/inputs/inputs";

/* ---------------------------------
   Tipos
--------------------------------- */
type FinancialSummary = {
  id: string;
  isSnapshot: boolean;
  pontoEquilibrioAmount: number;
};

type FinancialDailyGoal = {
  id: string;
  isActive: boolean;

  targetProfitPerc: number;

  participacaoDia01Perc: number;
  participacaoDia02Perc: number;
  participacaoDia03Perc: number;
  participacaoDia04Perc: number;
  participacaoDia05Perc: number;

  minimumGoalDia01Amount: number;
  minimumGoalDia02Amount: number;
  minimumGoalDia03Amount: number;
  minimumGoalDia04Amount: number;
  minimumGoalDia05Amount: number;

  targetProfitDia01Amount: number;
  targetProfitDia02Amount: number;
  targetProfitDia03Amount: number;
  targetProfitDia04Amount: number;
  targetProfitDia05Amount: number;

  createdAt: string;
  updatedAt: string;
};

type FinancialDailyGoalSettings = {
  targetProfitPerc: number;
  participacaoDia01Perc: number;
  participacaoDia02Perc: number;
  participacaoDia03Perc: number;
  participacaoDia04Perc: number;
  participacaoDia05Perc: number;
};

/* ---------------------------------
   Loader (defer)
--------------------------------- */
export async function loader({ request }: LoaderFunctionArgs) {
  const summaryPromise = prismaClient.financialSummary.findFirst({
    where: { isSnapshot: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, isSnapshot: true, pontoEquilibrioAmount: true },
  });

  // pega APENAS o goal ativo (se houver)
  const goalPromise = prismaClient.financialDailyGoal.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  // configurações padrão
  const settingsPromise = prismaClient.financialDailyGoalSettings.findFirst({
    orderBy: { id: "desc" },
  });

  return defer({
    summary: summaryPromise,
    goal: goalPromise,
    settings: settingsPromise,
  });
}

/* ---------------------------------
   Action
--------------------------------- */
type ActionData = { ok: boolean; message: string };

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const num = (k: string, def = 0) => {
    const v = form.get(k);
    if (v == null || v === "") return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  try {
    // Lê entradas editáveis
    const targetProfitPerc = num("targetProfitPerc");

    const p1 = num("participacaoDia01Perc");
    const p2 = num("participacaoDia02Perc");
    const p3 = num("participacaoDia03Perc");
    const p4 = num("participacaoDia04Perc");
    const p5 = num("participacaoDia05Perc");

    // Obtém ponto de equilíbrio corrente e id do summary
    const summary = await prismaClient.financialSummary.findFirst({
      where: { isSnapshot: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, pontoEquilibrioAmount: true },
    });

    const pe = summary?.pontoEquilibrioAmount ?? 0;

    // Cálculos
    const min = (perc: number) => pe * (perc / 100);
    const mult = 1 + targetProfitPerc / 100;

    const data = {
      financialSummaryId: summary?.id ?? undefined,
      isActive: true,
      targetProfitPerc,

      participacaoDia01Perc: p1,
      participacaoDia02Perc: p2,
      participacaoDia03Perc: p3,
      participacaoDia04Perc: p4,
      participacaoDia05Perc: p5,

      minimumGoalDia01Amount: min(p1),
      minimumGoalDia02Amount: min(p2),
      minimumGoalDia03Amount: min(p3),
      minimumGoalDia04Amount: min(p4),
      minimumGoalDia05Amount: min(p5),

      targetProfitDia01Amount: min(p1) * mult,
      targetProfitDia02Amount: min(p2) * mult,
      targetProfitDia03Amount: min(p3) * mult,
      targetProfitDia04Amount: min(p4) * mult,
      targetProfitDia05Amount: min(p5) * mult,
    };

    // Arquiva o goal ativo (se houver) e cria um novo ativo
    const existingActive = await prismaClient.financialDailyGoal.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingActive) {
      await prismaClient.financialDailyGoal.update({
        where: { id: existingActive.id },
        data: { isActive: false },
      });
    }

    await prismaClient.financialDailyGoal.create({ data });

    return json({
      ok: true,
      message:
        existingActive
          ? "Já existia uma meta ativa: ela foi arquivada e uma nova foi criada."
          : "Metas diárias criadas e ativadas.",
    });
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: "Erro ao salvar as metas diárias." });
  }
}

/* ----------------- Helpers de layout (2 colunas) ----------------- */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 md:items-center gap-2 md:gap-6">
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}

/* ---------------------------------
   Client Page
--------------------------------- */
export default function AdminFinanceiroMetas() {
  const data = useLoaderData<typeof loader>();
  const action = useActionData<ActionData>();
  const nav = useNavigation();
  const saving = nav.state !== "idle";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Metas Diárias (DIA 1–5)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Defina a % de participação por dia da semana e a % de lucro-alvo. Os valores mínimos e de alvo são calculados
        com base no <span className="font-semibold">ponto de equilíbrio corrente</span>.
      </p>

      <Separator />

      <Form method="post" className="space-y-6">
        <React.Suspense fallback={<p>Carregando…</p>}>
          <Await resolve={Promise.all([data.summary, data.goal, data.settings])}>
            {([summary, goal, settings]: [Partial<FinancialSummary> | null, Partial<FinancialDailyGoal> | null, Partial<FinancialDailyGoalSettings> | null]) => {
              const pe = summary?.pontoEquilibrioAmount ?? 0;

              // estados locais (preferem goal ativo; se não houver, caem no settings)
              const [p1, setP1] = React.useState<number>(goal?.participacaoDia01Perc ?? settings?.participacaoDia01Perc ?? 0);
              const [p2, setP2] = React.useState<number>(goal?.participacaoDia02Perc ?? settings?.participacaoDia02Perc ?? 0);
              const [p3, setP3] = React.useState<number>(goal?.participacaoDia03Perc ?? settings?.participacaoDia03Perc ?? 0);
              const [p4, setP4] = React.useState<number>(goal?.participacaoDia04Perc ?? settings?.participacaoDia04Perc ?? 0);
              const [p5, setP5] = React.useState<number>(goal?.participacaoDia05Perc ?? settings?.participacaoDia05Perc ?? 0);
              const [tgt, setTgt] = React.useState<number>(goal?.targetProfitPerc ?? settings?.targetProfitPerc ?? 0);

              const sum = p1 + p2 + p3 + p4 + p5;
              const mult = 1 + tgt / 100;
              const calcMin = (perc: number) => pe * (perc / 100);
              const calcTgt = (perc: number) => calcMin(perc) * mult;

              // botão para aplicar os settings “como estão” (UX)
              const aplicarDefaults = () => {
                if (!settings) return;
                setP1(settings.participacaoDia01Perc ?? 0);
                setP2(settings.participacaoDia02Perc ?? 0);
                setP3(settings.participacaoDia03Perc ?? 0);
                setP4(settings.participacaoDia04Perc ?? 0);
                setP5(settings.participacaoDia05Perc ?? 0);
                setTgt(settings.targetProfitPerc ?? 0);
              };

              // Componente de cartão por DIA
              const DayCard = (opts: {
                label: string;
                namePerc: string;
                defaultPerc?: number;
                minAmount?: number;
                tgtAmount?: number;
                onPercChange: (v: number) => void;
              }) => (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{opts.label}</h4>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Row>
                      <div className="flex flex-col gap-0">
                        <Label>Participação na Receita Bruta (%)</Label>
                        <DecimalInput
                          name={opts.namePerc}
                          defaultValue={opts.defaultPerc ?? 0}
                          fractionDigits={2}
                          className="w-full"
                          onChange={(e: any) => {
                            const n = Number(e?.target?.value ?? 0);
                            opts.onPercChange(Number.isFinite(n) ? n : 0);
                          }}
                        />
                      </div>
                      <div />
                    </Row>

                    <Row>
                      <div className="flex flex-col gap-0">
                        <Label>Mínimo (R$) • baseado no PE</Label>
                        <DecimalInput
                          name={`${opts.namePerc.replace("Perc", "")}Minimum`}
                          defaultValue={opts.minAmount ?? 0}
                          fractionDigits={2}
                          className="w-full border-none disabled:bg-green-50 disabled:text-black"
                          disabled
                        />
                      </div>
                      <div className="flex flex-col gap-0">
                        <Label>Meta com Lucro-Alvo (R$)</Label>
                        <DecimalInput
                          name={`${opts.namePerc.replace("Perc", "")}Target`}
                          defaultValue={opts.tgtAmount ?? 0}
                          fractionDigits={2}
                          className="w-full border-none disabled:bg-green-50 disabled:text-black"
                          disabled
                        />
                      </div>
                    </Row>
                  </div>
                </Card>
              );

              return (
                <div className="space-y-6">
                  <div className="rounded-md bg-muted p-4 text-sm">
                    <p>
                      Ponto de equilíbrio corrente: <span className="font-mono">R$ {pe.toFixed(2)}</span>
                    </p>
                    {settings && (
                      <div className="mt-2 text-xs opacity-80">
                        <span>Há configurações padrão salvas. </span>
                        <button type="button" onClick={aplicarDefaults} className="underline">Aplicar configurações padrão</button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Row>
                      <Label>Lucro-alvo sobre o mínimo (%)</Label>
                      <DecimalInput
                        name="targetProfitPerc"
                        defaultValue={tgt}
                        fractionDigits={2}
                        className="w-full"
                        onChange={(e: any) => {
                          const n = Number(e?.target?.value ?? 0);
                          setTgt(Number.isFinite(n) ? n : 0);
                        }}
                      />
                    </Row>
                    <Row>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Somatório das participações:</span>
                        <span className={`text-sm font-semibold ${Math.abs(sum - 100) < 0.001 ? "text-green-600" : "text-red-600"}`}>
                          {sum.toFixed(2)}%
                        </span>
                      </div>
                      <div />
                    </Row>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {DayCard({
                      label: "DIA 1 (Quarta)",
                      namePerc: "participacaoDia01Perc",
                      defaultPerc: p1,
                      minAmount: calcMin(p1),
                      tgtAmount: calcTgt(p1),
                      onPercChange: setP1,
                    })}
                    {DayCard({
                      label: "DIA 2 (Quinta)",
                      namePerc: "participacaoDia02Perc",
                      defaultPerc: p2,
                      minAmount: calcMin(p2),
                      tgtAmount: calcTgt(p2),
                      onPercChange: setP2,
                    })}
                    {DayCard({
                      label: "DIA 3 (Sexta)",
                      namePerc: "participacaoDia03Perc",
                      defaultPerc: p3,
                      minAmount: calcMin(p3),
                      tgtAmount: calcTgt(p3),
                      onPercChange: setP3,
                    })}
                    {DayCard({
                      label: "DIA 4 (Sábado)",
                      namePerc: "participacaoDia04Perc",
                      defaultPerc: p4,
                      minAmount: calcMin(p4),
                      tgtAmount: calcTgt(p4),
                      onPercChange: setP4,
                    })}
                    {DayCard({
                      label: "DIA 5 (Domingo)",
                      namePerc: "participacaoDia05Perc",
                      defaultPerc: p5,
                      minAmount: calcMin(p5),
                      tgtAmount: calcTgt(p5),
                      onPercChange: setP5,
                    })}
                  </div>

                  <Separator />

                  <div className="flex justify-between">
                    {action && (
                      <Alert variant={action.ok ? "default" : "destructive"}>
                        <AlertTitle>{action.ok ? "Sucesso" : "Erro"}</AlertTitle>
                        <AlertDescription>{action.message}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex justify-end w-full">
                      <Button type="submit" disabled={saving}>
                        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</> : "Salvar"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }}
          </Await>
        </React.Suspense>
      </Form>
    </div>
  );
}
