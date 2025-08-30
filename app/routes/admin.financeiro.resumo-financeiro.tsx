// app/routes/admin.financeiro.resumo-financeiro.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import {
  Await,
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useFetcher,
} from "@remix-run/react";
import * as React from "react";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { History, Loader2, Trash2 } from "lucide-react";

import prismaClient from "~/lib/prisma/client.server";
import { DecimalInput } from "~/components/inputs/inputs";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";

/* -------------------------------
   Types
------------------------------- */
type FinancialSummary = {
  id: string;
  isSnapshot: boolean;
  description: string | null;
  receitaBrutaAmount: number;
  impostoPerc: number;
  impostoAmount: number;
  vendaCartaoAmount: number;
  vendaCartaoPerc: number;
  taxaCartaoPerc: number;
  taxaCartaoAmount: number;
  vendaMarketplaceAmount: number;
  taxaMarketplacePerc: number;
  taxaMarketplaceAmount: number;
  receitaLiquidaAmount: number;
  custoFixoAmount: number;
  custoFixoPerc: number;
  custoVariavelAmount: number;
  custoVariavelPerc: number;
  pontoEquilibrioAmount: number;
  ticketMedio: number;
  createdAt: string;
  updatedAt: string;
};

type FinancialDailyGoalSettings = {
  id?: string;
  targetProfitPerc: number;
  participacaoDia01Perc: number;
  participacaoDia02Perc: number;
  participacaoDia03Perc: number;
  participacaoDia04Perc: number;
  participacaoDia05Perc: number;
};

/* -------------------------------
   Loader com defer
------------------------------- */
export async function loader({ request }: LoaderFunctionArgs) {
  const currentPromise = await prismaClient.financialSummary.findFirst({
    where: { isSnapshot: false },
    orderBy: { createdAt: "desc" },
  });

  const snapshotsPromise = await prismaClient.financialSummary.findMany({
    where: { isSnapshot: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const settingsPromise = await prismaClient.financialDailyGoalSettings.findFirst({
    orderBy: { id: "desc" },
  });

  return defer({
    current: currentPromise,
    snapshots: snapshotsPromise,
    settings: settingsPromise,
  });
}

/* -------------------------------
   Action
------------------------------- */
type ActionData = {
  ok: boolean;
  message: string;
  suggestRecalcMetas?: boolean;
  keepSettingsOpen?: boolean;
};

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");
  const num = (k: string, def = 0) => {
    const v = form.get(k);
    if (v == null || v === "") return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  try {
    /* ------------------------------------------------------
       CRUD dos Settings (inline) - via fetcher (mesma rota)
       (continua funcionando aqui)
    ------------------------------------------------------ */
    if (intent === "settings.upsert") {
      const id = String(form.get("settingsId") || "");
      const targetProfitPerc = num("settings_targetProfitPerc");
      const p1 = num("settings_participacaoDia01Perc");
      const p2 = num("settings_participacaoDia02Perc");
      const p3 = num("settings_participacaoDia03Perc");
      const p4 = num("settings_participacaoDia04Perc");
      const p5 = num("settings_participacaoDia05Perc");
      const soma = p1 + p2 + p3 + p4 + p5;

      if (Math.abs(soma - 100) > 0.01) {
        return json({
          ok: false,
          message: `A soma das participações por dia é ${soma.toFixed(2)}%. Ajuste para 100%.`,
          keepSettingsOpen: true,
        });
      }

      if (id) {
        await prismaClient.financialDailyGoalSettings.update({
          where: { id },
          data: {
            targetProfitPerc,
            participacaoDia01Perc: p1,
            participacaoDia02Perc: p2,
            participacaoDia03Perc: p3,
            participacaoDia04Perc: p4,
            participacaoDia05Perc: p5,
          },
        });
        return json({ ok: true, message: "Configurações atualizadas.", keepSettingsOpen: true });
      } else {
        await prismaClient.financialDailyGoalSettings.create({
          data: {
            targetProfitPerc,
            participacaoDia01Perc: p1,
            participacaoDia02Perc: p2,
            participacaoDia03Perc: p3,
            participacaoDia04Perc: p4,
            participacaoDia05Perc: p5,
          },
        });
        return json({ ok: true, message: "Configurações criadas.", keepSettingsOpen: true });
      }
    }

    if (intent === "settings.delete") {
      const id = String(form.get("settingsId"));
      if (!id) return json({ ok: false, message: "ID inválido para remover configurações.", keepSettingsOpen: true });
      await prismaClient.financialDailyGoalSettings.delete({ where: { id } });
      return json({ ok: true, message: "Configurações removidas." });
    }

    /* ------------------------------------------------------
       Recalcular metas (usa settings) - também via fetcher
    ------------------------------------------------------ */
    if (intent === "generateDailyGoals") {
      const summary = await prismaClient.financialSummary.findFirst({
        where: { isSnapshot: false },
        orderBy: { createdAt: "desc" },
        select: { id: true, pontoEquilibrioAmount: true },
      });

      if (!summary) {
        return json({ ok: false, message: "Não há resumo financeiro corrente para calcular o PE." });
      }

      const settings = await prismaClient.financialDailyGoalSettings.findFirst({
        orderBy: { id: "desc" },
      });

      if (!settings) {
        return json({
          ok: false,
          message: "Nenhuma configuração de metas encontrada. Preencha o formulário de padrões abaixo e salve.",
          keepSettingsOpen: true,
        });
      }

      const pe = summary.pontoEquilibrioAmount ?? 0;
      const p1 = settings.participacaoDia01Perc ?? 0;
      const p2 = settings.participacaoDia02Perc ?? 0;
      const p3 = settings.participacaoDia03Perc ?? 0;
      const p4 = settings.participacaoDia04Perc ?? 0;
      const p5 = settings.participacaoDia05Perc ?? 0;
      const tgt = settings.targetProfitPerc ?? 0;

      const soma = p1 + p2 + p3 + p4 + p5;
      if (Math.abs(soma - 100) > 0.01) {
        return json({
          ok: false,
          message: `A soma das participações por dia é ${soma.toFixed(2)}%. Ajuste para 100% nas configurações e tente novamente.`,
          keepSettingsOpen: true,
        });
      }

      const min = (perc: number) => pe * (perc / 100);
      const mult = 1 + tgt / 100;

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

      await prismaClient.financialDailyGoal.create({
        data: {
          financialSummaryId: summary.id,
          isActive: true,
          targetProfitPerc: tgt,
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
        },
      });

      return json({
        ok: true,
        message:
          "Metas diárias recalculadas a partir do PE corrente e das configurações padrão. O goal anterior (se havia) foi arquivado.",
      });
    }

    /* ------------------------------------------------------
       Remover snapshot
    ------------------------------------------------------ */
    if (intent === "deleteSnapshot") {
      const id = String(form.get("snapshotId"));
      await prismaClient.financialSummary.delete({ where: { id } });
      return json({ ok: true, message: "Snapshot removido." });
    }

    /* ------------------------------------------------------
       Salvar resumo corrente
    ------------------------------------------------------ */
    const receitaBrutaAmount = num("receitaBrutaAmount");
    const rba = receitaBrutaAmount;

    const vendaCartaoAmount = num("vendaCartaoAmount");
    const vendaCartaoPerc = rba > 0 ? (vendaCartaoAmount / rba) * 100 : 0;
    const taxaCartaoPerc = num("taxaCartaoPerc");
    const receitaBrutaCartao = rba > 0 ? (rba * vendaCartaoPerc) / 100 : 0;
    const taxaCartaoAmount = receitaBrutaCartao > 0 ? (receitaBrutaCartao * taxaCartaoPerc) / 100 : 0;

    const impostoPerc = num("impostoPerc");
    const impostoAmount = rba > 0 ? (rba * impostoPerc) / 100 : 0;

    const vendaMarketplaceAmount = num("vendaMarketplaceAmount");
    const taxaMarketplacePerc = num("taxaMarketplacePerc");
    const taxaMarketplaceAmount = vendaMarketplaceAmount > 0 ? (vendaMarketplaceAmount * taxaMarketplacePerc) / 100 : 0;

    const receitaLiquidaAmount = rba > 0 ? rba - taxaCartaoAmount - impostoAmount - taxaMarketplaceAmount : 0;

    const custoFixoAmount = num("custoFixoAmount");
    const custoVariavelAmount = num("custoVariavelAmount");
    const ticketMedio = num("ticketMedio");

    const receitaBaseValor = receitaLiquidaAmount;
    const custoFixoPerc = receitaBaseValor > 0 ? custoFixoAmount / receitaBaseValor : 0;
    const custoVariavelPerc = receitaBaseValor > 0 ? custoVariavelAmount / receitaBaseValor : 0;
    const pontoEquilibrioAmount = 1 - custoVariavelPerc !== 0 ? custoFixoAmount / (1 - custoVariavelPerc) : 0;

    const baseData = {
      receitaBrutaAmount,
      vendaCartaoAmount,
      vendaCartaoPerc,
      taxaCartaoPerc,
      taxaCartaoAmount,
      impostoPerc,
      impostoAmount,
      vendaMarketplaceAmount,
      taxaMarketplacePerc,
      taxaMarketplaceAmount,
      receitaLiquidaAmount,
      custoFixoAmount,
      custoFixoPerc,
      custoVariavelAmount,
      custoVariavelPerc,
      pontoEquilibrioAmount,
      ticketMedio,
    } as const;

    if (intent === "save") {
      const existing = await prismaClient.financialSummary.findFirst({
        where: { isSnapshot: false },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        await prismaClient.financialSummary.update({
          where: { id: existing.id },
          data: { ...baseData, isSnapshot: false },
        });
      } else {
        await prismaClient.financialSummary.create({
          data: { ...baseData, isSnapshot: false, description: null },
        });
      }

      return json({
        ok: true,
        message: "Resumo salvo. Deseja recalcular as metas com o novo PE?",
        suggestRecalcMetas: true,
      });
    }

    if (intent === "snapshot") {
      const description = String(form.get("description") || "Snapshot");
      await prismaClient.financialSummary.create({
        data: { ...baseData, isSnapshot: true, description },
      });
      return json({ ok: true, message: "Snapshot criado." });
    }

    return json({ ok: false, message: "Intent desconhecido." });
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: "Erro ao processar a ação." });
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

/* -------------------------------
   Client Page
------------------------------- */
export default function AdminFinanceiroResumoFinanceiro() {
  const data = useLoaderData<typeof loader>();
  const action = useActionData<ActionData>();
  const nav = useNavigation();
  const saving = nav.state !== "idle";

  // fetchers sem navegação (não resetam scroll)
  const settingsFetcher = useFetcher<ActionData>();
  const goalsFetcher = useFetcher<ActionData>();

  const [showGuide, setShowGuide] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const [showSnapshot, setShowSnapshot] = React.useState(false)

  // ref para scroll suave até o painel de settings
  const settingsRef = React.useRef<HTMLDivElement | null>(null);

  // manter painel aberto após salvar/erro via action OU fetcher
  React.useEffect(() => {
    if (action?.keepSettingsOpen) setShowSettings(true);
    if (settingsFetcher.data?.keepSettingsOpen) setShowSettings(true);
  }, [action?.keepSettingsOpen, settingsFetcher.data?.keepSettingsOpen]);

  const handleToggleSettings = () => {
    setShowSettings((v) => !v);
    // ao abrir, rola suavemente até o painel
    requestAnimationFrame(() => {
      if (!showSettings && settingsRef.current) {
        settingsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Resumo Financeiro</h2>
      </div>
      <p className="text-sm text-muted-foreground">Edite os valores abaixo e salve para atualizar o resumo.</p>

      <Separator />

      <div className="flex justify-end">
        <button className=" text-sm underline flex items-center gap-2 font-semibold" onClick={() => setShowGuide(!showGuide)}>
          <span><QuestionMarkCircledIcon /></span>
          Receita bruta ou líquida
        </button>
      </div>

      {showGuide && (
        <div className="rounded-md bg-muted p-4 text-sm space-y-2">
          <p>Depende do objetivo da meta:</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <p className="font-semibold uppercase">Receita Bruta</p>
              <p>Inclui tudo que você faturou nas vendas (sem tirar impostos, taxas, devoluções).</p>
              <p>Boa para comparar desempenho comercial e motivar equipe de vendas.</p>
              <p>Problema: pode mascarar a realidade, porque parte desse dinheiro não fica na pizzaria.</p>
            </div>

            <div className="flex flex-col">
              <p className="font-semibold uppercase">Receita Líquida</p>
              <p>Receita Bruta – impostos – descontos – devoluções</p>
              <p>Mostra o valor real que sobra para pagar custos e gerar lucro.</p>
              <p>É o que se conecta ao ponto de equilíbrio e ao DRE.</p>
            </div>
          </div>

          <Separator className="my-2" />

          <p>
            Se a meta for financeira/gestão de negócio (cobrir custos, lucro, ponto de equilíbrio) →{" "}
            <strong>use RECEITA LÍQUIDA.</strong>
          </p>
          <p>
            Se a meta for comercial (desempenho de vendas, incentivo de equipe) → <strong>pode usar RECEITA BRUTA</strong>.
          </p>
        </div>
      )}

      {/* ------------------------ FORM PRINCIPAL (SALVAR RESUMO) ------------------------ */}
      <Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save" />

        <React.Suspense fallback={<p>Carregando...</p>}>
          <Await resolve={data.current} errorElement={<div className="text-red-600">Erro ao carregar</div>}>
            {(current: Partial<FinancialSummary> | null) => {
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Row>
                      <Label>Receita Bruta (R$)</Label>
                      <DecimalInput name="receitaBrutaAmount" defaultValue={current?.receitaBrutaAmount ?? 0} fractionDigits={2} className="w-full" />
                    </Row>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 gap-4">
                    <h3 className="font-semibold">Cálculo Receita Líquida</h3>

                    <div className="grid grid-cols-2 gap-x-12">
                      <div className="flex flex-col gap-2">
                        <Row>
                          <div className="flex flex-col gap-0">
                            <Label>Venda no cartão (R$)</Label>
                            <span className="text-[11px] text-muted-foreground">Média de receita paga em cartão</span>
                          </div>
                          <DecimalInput name="vendaCartaoAmount" defaultValue={(current?.vendaCartaoAmount ?? 0)} fractionDigits={2} className="w-full " />
                        </Row>

                        <Row>
                          <Label>Venda no cartão (%)</Label>
                          <DecimalInput name="vendaCartaoPerc" defaultValue={(current?.vendaCartaoPerc ?? 0)} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>

                        <Row>
                          <Label>Taxa Cartão (%)</Label>
                          <DecimalInput name="taxaCartaoPerc" defaultValue={(current?.taxaCartaoPerc ?? 0)} fractionDigits={2} className="w-full" />
                        </Row>
                        <Row>
                          <Label>Taxa Cartão (R$)</Label>
                          <DecimalInput name="taxaCartaAmount" defaultValue={current?.taxaCartaoAmount ?? 0} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>

                        <Separator />

                        <Row>
                          <Label>Imposto (%)</Label>
                          <DecimalInput name="impostoPerc" defaultValue={(current?.impostoPerc ?? 0)} fractionDigits={2} className="w-full" />
                        </Row>

                        <Row>
                          <Label>Imposto (R$)</Label>
                          <DecimalInput name="impostoAmount" defaultValue={(current?.impostoAmount ?? 0)} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>

                        <Separator />

                        <Row>
                          <div className="flex flex-col gap-0">
                            <Label>Venda marketplace (R$)</Label>
                            <span className="text-[11px] text-muted-foreground">Média de receita gerada pelo marketplace</span>
                          </div>
                          <DecimalInput name="vendaMarketplaceAmount" defaultValue={(current?.vendaMarketplaceAmount ?? 0)} fractionDigits={2} className="w-full " />
                        </Row>

                        <Row>
                          <Label>Taxa Marketplace (%)</Label>
                          <DecimalInput name="taxaMarketplacePerc" defaultValue={(current?.taxaMarketplacePerc ?? 0)} fractionDigits={2} className="w-full" />
                        </Row>

                        <Row>
                          <Label>Taxa Marketplace (R$)</Label>
                          <DecimalInput name="taxaMarketplaceAmount" defaultValue={(current?.taxaMarketplaceAmount ?? 0)} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>
                      </div>

                      <div className="flex flex-col gap-4 items-end h-full justify-center">
                        <p className="text-lg font-semibold uppercase tracking-wider font-mono">Receita Líquida (R$)</p>
                        <DecimalInput name="receitaLiquidaAmount" defaultValue={current?.receitaLiquidaAmount ?? 0} fractionDigits={2} className="w-full text-2xl font-mono" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col space-y-4">
                    <h3 className="font-semibold">Custos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Row>
                          <Label>Custo Fixo (R$)</Label>
                          <DecimalInput name="custoFixoAmount" defaultValue={current?.custoFixoAmount ?? 0} fractionDigits={2} className="w-full" />
                        </Row>
                        <Row>
                          <Label>Custo Fixo (%)</Label>
                          <DecimalInput name="custoFixoAmount" defaultValue={(current?.custoFixoPerc ?? 0) * 100} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Row>
                          <Label>Custo Variável (R$)</Label>
                          <DecimalInput name="custoVariavelAmount" defaultValue={current?.custoVariavelAmount ?? 0} fractionDigits={2} className="w-full" />
                        </Row>
                        <Row>
                          <Label>Custo Variável (%)</Label>
                          <DecimalInput name="custoFixoAmount" defaultValue={(current?.custoVariavelPerc ?? 0) * 100} fractionDigits={2} className="w-full border-none disabled:bg-green-50 disabled:text-black" disabled />
                        </Row>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-x-4">
                    <Row>
                      <p className="text-lg font-semibold uppercase tracking-wider font-mono">Ponto de equilíbrio (R$)</p>
                      <DecimalInput
                        name="pontoEquilibrioAmount"
                        defaultValue={current?.pontoEquilibrioAmount ?? 0}
                        fractionDigits={2}
                        className="w-full font-mono p-3 text-2xl"
                      />
                    </Row>
                    <p className="font-semibold">
                      A empresa deve alcançar uma receita mínima de R$ {formatDecimalPlaces(current?.pontoEquilibrioAmount ?? 0, 2)} para
                      cobrir todos os custos e atingir o ponto de equilíbrio (lucro zero).
                    </p>
                  </div>

                  <Separator />

                  <div className="flex justify-between">
                    {action && (
                      <Alert variant={action.ok ? "default" : "destructive"}>
                        <AlertTitle>{action.ok ? "Sucesso" : "Erro"}</AlertTitle>
                        <AlertDescription className="flex items-center gap-3">
                          <span>{action.message}</span>
                          {action.ok && action.suggestRecalcMetas && (
                            <goalsFetcher.Form method="post">
                              <input type="hidden" name="intent" value="generateDailyGoals" />
                              <Button type="submit" variant="secondary" size="sm">Recalcular metas</Button>
                            </goalsFetcher.Form>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex justify-end w-full">
                      <Button type="submit" disabled={saving}>
                        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }}
          </Await>
        </React.Suspense>
      </Form>
      {/* ------------------------ FIM DO FORM PRINCIPAL ------------------------ */}

      {/* ------------------------ METAS / PADRÕES (FORA DO FORM PRINCIPAL) ------------------------ */}
      <Separator />

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Metas diárias</h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* 1 clique para gerar/recalcular metas com base no PE + Settings (fetcher, sem navegação) */}
          <goalsFetcher.Form method="post">
            <input type="hidden" name="intent" value="generateDailyGoals" />
            <Button type="submit" variant="secondary">
              Recalcular metas agora
            </Button>
          </goalsFetcher.Form>

          {/* Toggle do CRUD inline dos padrões (não navega) */}
          <Button type="button" variant="outline" onClick={handleToggleSettings}>
            Configurar padrões de metas
          </Button>
        </div>
      </div>

      {/* Alertas locais (fetchers) */}
      {(settingsFetcher.data || goalsFetcher.data) && (
        <Alert variant={(settingsFetcher.data?.ok ?? goalsFetcher.data?.ok) ? "default" : "destructive"}>
          <AlertTitle>{(settingsFetcher.data?.ok ?? goalsFetcher.data?.ok) ? "Sucesso" : "Erro"}</AlertTitle>
          <AlertDescription>
            {settingsFetcher.data?.message || goalsFetcher.data?.message}
          </AlertDescription>
        </Alert>
      )}

      {/* CRUD inline de FinancialDailyGoalSettings (fora do form principal) */}
      {showSettings && (
        <React.Suspense fallback={<p>Carregando padrões…</p>}>
          <Await resolve={data.settings}>
            {(settings: Partial<FinancialDailyGoalSettings> | null) => {
              const [sp1, setSp1] = React.useState<number>(settings?.participacaoDia01Perc ?? 0);
              const [sp2, setSp2] = React.useState<number>(settings?.participacaoDia02Perc ?? 0);
              const [sp3, setSp3] = React.useState<number>(settings?.participacaoDia03Perc ?? 0);
              const [sp4, setSp4] = React.useState<number>(settings?.participacaoDia04Perc ?? 0);
              const [sp5, setSp5] = React.useState<number>(settings?.participacaoDia05Perc ?? 0);
              const [stgt, setStgt] = React.useState<number>(settings?.targetProfitPerc ?? 0);
              const sSum = sp1 + sp2 + sp3 + sp4 + sp5;

              return (
                <div ref={settingsRef} className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-semibold">Padrões de metas (FinancialDailyGoalSettings)</h4>
                    <p className="text-xs text-muted-foreground">
                      O recálculo usa o ponto de equilíbrio atual e as configurações padrão (participação por dia e % de lucro-alvo).
                      O goal ativo anterior é arquivado automaticamente.
                    </p>
                  </div>

                  <settingsFetcher.Form method="post" className="space-y-4">
                    <input type="hidden" name="intent" value="settings.upsert" />
                    {settings?.id && <input type="hidden" name="settingsId" value={String(settings.id)} />}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Row>
                        <Label>Lucro-alvo sobre o mínimo (%)</Label>
                        <DecimalInput
                          name="settings_targetProfitPerc"
                          defaultValue={stgt}
                          fractionDigits={2}
                          className="w-full"
                          onChange={(e: any) => setStgt(Number(e?.target?.value ?? 0))}
                        />
                      </Row>

                    </div>

                    <Separator />

                    <Row>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Somatório das participações:</span>
                        <span className={`text-sm font-semibold ${Math.abs(sSum - 100) < 0.001 ? "text-green-600" : "text-red-600"}`}>
                          {sSum.toFixed(2)}%
                        </span>
                      </div>
                      <div />
                    </Row>

                    <div className="grid grid-cols-1 md:grid-cols-8 items-end gap-4">
                      <div className="grid grid-cols-5 col-span-6 gap-x-4">
                        <div>
                          <Label>DIA 1 (Quarta) – %</Label>
                          <DecimalInput
                            name="settings_participacaoDia01Perc"
                            defaultValue={sp1}
                            fractionDigits={2}
                            className="w-full"
                            onChange={(e: any) => setSp1(Number(e?.target?.value ?? 0))}
                          />
                        </div>
                        <div>
                          <Label>DIA 2 (Quinta) – %</Label>
                          <DecimalInput
                            name="settings_participacaoDia02Perc"
                            defaultValue={sp2}
                            fractionDigits={2}
                            className="w-full"
                            onChange={(e: any) => setSp2(Number(e?.target?.value ?? 0))}
                          />
                        </div>
                        <div>
                          <Label>DIA 3 (Sexta) – %</Label>
                          <DecimalInput
                            name="settings_participacaoDia03Perc"
                            defaultValue={sp3}
                            fractionDigits={2}
                            className="w-full"
                            onChange={(e: any) => setSp3(Number(e?.target?.value ?? 0))}
                          />
                        </div>
                        <div>
                          <Label>DIA 4 (Sábado) – %</Label>
                          <DecimalInput
                            name="settings_participacaoDia04Perc"
                            defaultValue={sp4}
                            fractionDigits={2}
                            className="w-full"
                            onChange={(e: any) => setSp4(Number(e?.target?.value ?? 0))}
                          />
                        </div>
                        <div>
                          <Label>DIA 5 (Domingo) – %</Label>
                          <DecimalInput
                            name="settings_participacaoDia05Perc"
                            defaultValue={sp5}
                            fractionDigits={2}
                            className="w-full"
                            onChange={(e: any) => setSp5(Number(e?.target?.value ?? 0))}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 col-span-2">
                        <Button type="submit" disabled={settingsFetcher.state !== "idle"}>
                          {settingsFetcher.state !== "idle" ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</>
                          ) : (
                            <span className="leading-[110%] uppercase text-sm tracking-wide font-semibold">Salvar padrões</span>
                          )}
                        </Button>

                        {settings?.id && (
                          <settingsFetcher.Form method="post" onSubmit={(e) => {
                            if (!confirm("Remover as configurações atuais?")) e.preventDefault();
                          }}>
                            <input type="hidden" name="intent" value="settings.delete" />
                            <input type="hidden" name="settingsId" value={String(settings.id)} />
                            <Button type="submit" variant="destructive">
                              <span className="leading-[110%] uppercase text-sm tracking-wide font-semibold">Remover padrões</span>
                            </Button>
                          </settingsFetcher.Form>
                        )}
                      </div>
                    </div>



                    <p className="text-xs text-muted-foreground">
                      Essas configurações são usadas para gerar a meta diária a partir do ponto de equilíbrio atual.
                    </p>
                  </settingsFetcher.Form>
                </div>
              );
            }}
          </Await>
        </React.Suspense>
      )}


      {/* ------------------------ FIM: METAS / PADRÕES ------------------------ */}

      <Separator />


      <button className=" text-sm underline flex items-center gap-2 font-semibold" onClick={() => setShowSnapshot(!showSnapshot)}>
        <span><History /></span>
        Snapshot
      </button>

      {
        showSnapshot && (
          <>
            <Form method="post" className="grid grid-cols-8 gap-x-4">
              <input type="hidden" name="intent" value="snapshot" />
              <Textarea name="description" placeholder="Descrição do snapshot" className="col-span-4" />
              <Button type="submit" variant="secondary" className="col-span-2">Criar snapshot</Button>
            </Form>

            <section className="space-y-3">
              <h4 className="font-semibold">Snapshots recentes</h4>
              <React.Suspense fallback={<p>Carregando snapshots...</p>}>
                <Await resolve={data.snapshots} errorElement={<div className="text-red-600">Erro ao carregar snapshots</div>}>
                  {(snapshots: Partial<FinancialSummary>[]) => (
                    snapshots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum snapshot ainda.</p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {snapshots.map((s) => (
                          <li key={s.id}>
                            <div className="grid grid-cols-1 md:grid-cols-8 gap-2 p-3 text-sm">
                              <span className="md:col-span-3 font-medium">{s.description ?? "-"}</span>
                              <span className="opacity-80">Receita Bruta: {s.receitaBrutaAmount}</span>
                              <span className="opacity-80">C.Fixo: {s.custoFixoAmount}</span>
                              <span className="opacity-80">PE: {s.pontoEquilibrioAmount}</span>
                              <span className="">{new Date(s.createdAt!).toLocaleString()}</span>
                              <Form method="post">
                                <input type="hidden" name="intent" value="deleteSnapshot" />
                                <input type="hidden" name="snapshotId" value={s.id} />
                                <Button type="submit" variant="secondary" className="col-span-2">
                                  <Trash2 className="h-4 w-4 mr-2" /> Remover
                                </Button>
                              </Form>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </Await>
              </React.Suspense>
            </section>
          </>
        )
      }
    </div>
  );
}
