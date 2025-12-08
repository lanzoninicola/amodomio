// app/routes/admin.financeiro.fechamento-mensal.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import prismaClient from "~/lib/prisma/client.server";
import { DecimalInput } from "~/components/inputs/inputs";
import formatMoneyString from "~/utils/format-money-string";
import { FinancialMonthlyClose } from "@prisma/client";

type LoaderData = {
  closes: FinancialMonthlyClose[];
  monthlyCloseRepoMissing?: boolean;
};

type ActionData = {
  ok: boolean;
  message: string;
};

const MONTH_OPTIONS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export async function loader({ }: LoaderFunctionArgs) {
  const monthlyCloseRepo = (prismaClient as any).financialMonthlyClose;

  if (!monthlyCloseRepo || typeof monthlyCloseRepo.findMany !== "function") {
    return json<LoaderData>({ closes: [], monthlyCloseRepoMissing: true });
  }

  const closes = await monthlyCloseRepo.findMany({
    orderBy: [
      { referenceYear: "desc" },
      { referenceMonth: "desc" },
    ],
    take: 24,
  });

  return json<LoaderData>({ closes, monthlyCloseRepoMissing: false });
}

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
    const monthlyCloseRepo = (prismaClient as any).financialMonthlyClose;
    if (!monthlyCloseRepo || typeof monthlyCloseRepo.findMany !== "function") {
      return json({
        ok: false,
        message: "Tabela de fechamento mensal não encontrada. Rode `prisma migrate dev` e `prisma generate`.",
      });
    }

    if (intent === "delete") {
      const id = String(form.get("id") || "");
      if (!id) return json({ ok: false, message: "ID inválido." });
      await monthlyCloseRepo.delete({ where: { id } });
      return json({ ok: true, message: "Fechamento removido." });
    }

    const referenceMonth = num("referenceMonth");
    const referenceYear = num("referenceYear");

    if (!referenceMonth || !referenceYear) {
      return json({ ok: false, message: "Informe mês e ano do fechamento." });
    }

    // Base de caixa: receita do mês (já líquida das operadoras) menos custos variáveis manuais
    const receitaBrutaAmount = num("receitaBrutaAmount");

    // Dados informativos (não entram no cálculo)
    const vendaCartaoAmount = num("vendaCartaoAmount");
    const taxaCartaoPerc = num("taxaCartaoPerc");
    const impostoPerc = num("impostoPerc");
    const vendaMarketplaceAmount = num("vendaMarketplaceAmount");
    const taxaMarketplacePerc = num("taxaMarketplacePerc");

    // Custos fixos
    const custoFixoFolhaAmount = num("custoFixoFolhaAmount");
    const custoFixoFolhaFuncionariosAmount = num("custoFixoFolhaFuncionariosAmount");
    const custoFixoProlaboreAmount = num("custoFixoProlaboreAmount");
    const custoFixoRetiradaProlaboreAmount = num("custoFixoRetiradaProlaboreAmount");
    const custoFixoRetiradaResultadoAmount = num("custoFixoRetiradaResultadoAmount");
    const custoFixoParcelaFinanciamentoAmount = num("custoFixoParcelaFinanciamentoAmount");
    const custoFixoMarketingAmount = num("custoFixoMarketingAmount");
    const custoFixoFaturaCartaoAmount = num("custoFixoFaturaCartaoAmount");
    const custoFixoTotalAmount = num("custoFixoTotalAmount");
    const custoFixoOutrosAmount =
      custoFixoTotalAmount -
      (custoFixoFolhaAmount +
        custoFixoFolhaFuncionariosAmount +
        custoFixoProlaboreAmount +
        custoFixoRetiradaProlaboreAmount +
        custoFixoRetiradaResultadoAmount +
        custoFixoParcelaFinanciamentoAmount +
        custoFixoMarketingAmount +
        custoFixoFaturaCartaoAmount);

    // Custos variáveis (todos manuais)
    const custoVariavelInsumosAmount = num("custoVariavelInsumosAmount");
    const custoVariavelEntregaAmount = num("custoVariavelEntregaAmount");
    const custoVariavelImpostosAmount = num("custoVariavelImpostosAmount");
    const custoVariavelMarketingAmount = num("custoVariavelMarketingAmount"); // Tráfego pago (Meta)
    const custoVariavelTotalAmount = num("custoVariavelTotalAmount");
    const custoVariavelOutrosAmount =
      custoVariavelTotalAmount -
      (custoVariavelInsumosAmount +
        custoVariavelEntregaAmount +
        custoVariavelImpostosAmount +
        custoVariavelMarketingAmount);

    const vendaCartaoPerc = receitaBrutaAmount > 0 ? (vendaCartaoAmount / receitaBrutaAmount) * 100 : 0;
    const taxaCartaoAmount = vendaCartaoAmount > 0 ? (vendaCartaoAmount * taxaCartaoPerc) / 100 : 0;
    const impostoAmount = 0; // manual via custoVariavelImpostosAmount, não calculado por %
    const taxaMarketplaceAmount = vendaMarketplaceAmount > 0 ? (vendaMarketplaceAmount * taxaMarketplacePerc) / 100 : 0;

    const custoFixoTotalAmountNormalized = custoFixoTotalAmount;
    const custoVariavelTotalAmountNormalized = custoVariavelTotalAmount;

    const receitaLiquidaAmount = receitaBrutaAmount - custoVariavelTotalAmountNormalized;
    const custoFixoPerc = receitaLiquidaAmount > 0 ? custoFixoTotalAmountNormalized / receitaLiquidaAmount : 0;
    const custoVariavelPerc = receitaBrutaAmount > 0 ? custoVariavelTotalAmountNormalized / receitaBrutaAmount : 0;

    const pontoEquilibrioAmount = receitaBrutaAmount > 0 && (1 - custoVariavelPerc) !== 0
      ? custoFixoTotalAmountNormalized / (1 - custoVariavelPerc)
      : 0;

    const margemContribAmount = receitaBrutaAmount - custoVariavelTotalAmountNormalized;
    const margemContribPerc = receitaBrutaAmount > 0 ? (margemContribAmount / receitaBrutaAmount) * 100 : 0;
    const resultadoLiquidoAmount = margemContribAmount - custoFixoTotalAmountNormalized;
    const resultadoLiquidoPerc = receitaBrutaAmount > 0 ? (resultadoLiquidoAmount / receitaBrutaAmount) * 100 : 0;

    const data = {
      referenceMonth,
      referenceYear,
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

      custoFixoFolhaAmount,
      custoFixoFolhaFuncionariosAmount,
      custoFixoProlaboreAmount,
      custoFixoRetiradaProlaboreAmount,
      custoFixoRetiradaResultadoAmount,
      custoFixoParcelaFinanciamentoAmount,
      custoFixoMarketingAmount,
      custoFixoFaturaCartaoAmount,
      custoFixoOutrosAmount,

      custoVariavelInsumosAmount,
      custoVariavelEntregaAmount,
      custoVariavelImpostosAmount,
      custoVariavelMarketingAmount,
      custoVariavelOutrosAmount,

      custoFixoTotalAmount: custoFixoTotalAmountNormalized,
      custoVariavelTotalAmount: custoVariavelTotalAmountNormalized,
      custoFixoPerc,
      custoVariavelPerc,
      pontoEquilibrioAmount,
      margemContribAmount,
      margemContribPerc,
      resultadoLiquidoAmount,
      resultadoLiquidoPerc,
    };

    await monthlyCloseRepo.upsert({
      where: {
        referenceYear_referenceMonth: {
          referenceYear,
          referenceMonth,
        },
      },
      update: data,
      create: data,
    });

    return json({
      ok: true,
      message: `Fechamento de ${referenceMonth}/${referenceYear} salvo. Receita líquida: ${formatMoneyString(receitaLiquidaAmount, 2)}.`,
    });
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: "Erro ao salvar o fechamento mensal." });
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}

function calcTotals(c?: Partial<FinancialMonthlyClose> | null) {
  if (!c) {
    return {
      receitaBruta: 0,
      receitaLiquida: 0,
      custoFixoTotal: 0,
      custoVariavelTotal: 0,
      margemContrib: 0,
      margemContribPerc: 0,
      resultadoLiquido: 0,
      resultadoLiquidoPercBruta: 0,
      pontoEquilibrio: 0,
    };
  }

  const receitaBruta = c.receitaBrutaAmount ?? 0;
  const receitaLiquida = c.receitaLiquidaAmount ?? receitaBruta - (c.custoVariavelTotalAmount ?? 0);

  const custoFixoTotal =
    c.custoFixoTotalAmount ??
    ((c.custoFixoFolhaAmount ?? 0) +
      (c.custoFixoFolhaFuncionariosAmount ?? 0) +
      (c.custoFixoProlaboreAmount ?? 0) +
      (c.custoFixoRetiradaProlaboreAmount ?? c.custoFixoRetiradaLucroAmount ?? 0) +
      (c.custoFixoRetiradaResultadoAmount ?? 0) +
      (c.custoFixoMarketingAmount ?? 0) +
      (c.custoFixoFaturaCartaoAmount ?? 0) +
      (c.custoFixoParcelaFinanciamentoAmount ?? 0) +
      (c.custoFixoOutrosAmount ?? 0));

  const custoVariavelTotal =
    c.custoVariavelTotalAmount ??
    ((c.custoVariavelInsumosAmount ?? 0) +
      (c.custoVariavelEntregaAmount ?? 0) +
      (c.custoVariavelImpostosAmount ?? 0) +
      (c.custoVariavelMarketingAmount ?? 0) +
      (c.custoVariavelOutrosAmount ?? 0));

  const margemContrib =
    c.margemContribAmount ??
    receitaBruta - custoVariavelTotal;
  const margemContribPerc =
    c.margemContribPerc ??
    (receitaBruta > 0 ? (margemContrib / receitaBruta) * 100 : 0);

  const resultadoLiquido =
    c.resultadoLiquidoAmount ??
    margemContrib - custoFixoTotal;
  const resultadoLiquidoPercBruta =
    c.resultadoLiquidoPerc ??
    (receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0);

  const varPerc = receitaBruta > 0 ? custoVariavelTotal / receitaBruta : 0;
  const pontoEquilibrio = receitaBruta > 0 && (1 - varPerc) !== 0
    ? custoFixoTotal / (1 - varPerc)
    : c.pontoEquilibrioAmount ?? 0;

  return {
    receitaBruta,
    receitaLiquida,
    custoFixoTotal,
    custoVariavelTotal,
    margemContrib,
    margemContribPerc,
    resultadoLiquido,
    resultadoLiquidoPercBruta,
    pontoEquilibrio,
  };
}

export default function AdminFinanceiroFechamentoMensal() {
  const { closes, monthlyCloseRepoMissing } = useLoaderData<typeof loader>();
  const action = useActionData<ActionData>();
  const nav = useNavigation();
  const saving = nav.state !== "idle";

  const now = new Date();
  const [referenceMonth, setReferenceMonth] = React.useState<number>(now.getMonth() + 1);
  const [referenceYear, setReferenceYear] = React.useState<number>(now.getFullYear());

  const currentDefaults =
    closes.find((c) => c.referenceMonth === referenceMonth && c.referenceYear === referenceYear) ??
    closes[0];
  const totals = calcTotals(currentDefaults);

  const [receitaBruta, setReceitaBruta] = React.useState<number>(currentDefaults?.receitaBrutaAmount ?? 0);
  const [impostoPerc, setImpostoPerc] = React.useState<number>(currentDefaults?.impostoPerc ?? 0);
  const [vendaCartaoAmount, setVendaCartaoAmount] = React.useState<number>(currentDefaults?.vendaCartaoAmount ?? 0);
  const [taxaCartaoPerc, setTaxaCartaoPerc] = React.useState<number>(currentDefaults?.taxaCartaoPerc ?? 0);
  const [vendaMarketplaceAmount, setVendaMarketplaceAmount] = React.useState<number>(currentDefaults?.vendaMarketplaceAmount ?? 0);
  const [taxaMarketplacePerc, setTaxaMarketplacePerc] = React.useState<number>(currentDefaults?.taxaMarketplacePerc ?? 0);
  const [custoFixoFolha, setCustoFixoFolha] = React.useState<number>(currentDefaults?.custoFixoFolhaAmount ?? 0);
  const [custoFixoFolhaFuncionarios, setCustoFixoFolhaFuncionarios] = React.useState<number>(currentDefaults?.custoFixoFolhaFuncionariosAmount ?? 0);
  const [custoFixoProlabore, setCustoFixoProlabore] = React.useState<number>(currentDefaults?.custoFixoProlaboreAmount ?? 0);
  const [custoFixoRetiradaProlabore, setCustoFixoRetiradaProlabore] = React.useState<number>(currentDefaults?.custoFixoRetiradaProlaboreAmount ?? 0);
  const [custoFixoRetiradaResultado, setCustoFixoRetiradaResultado] = React.useState<number>(currentDefaults?.custoFixoRetiradaResultadoAmount ?? 0);
  const [custoFixoFinanciamento, setCustoFixoFinanciamento] = React.useState<number>(currentDefaults?.custoFixoParcelaFinanciamentoAmount ?? 0);
  const [custoFixoMarketing, setCustoFixoMarketing] = React.useState<number>(currentDefaults?.custoFixoMarketingAmount ?? 0);
  const [custoFixoFaturaCartao, setCustoFixoFaturaCartao] = React.useState<number>(currentDefaults?.custoFixoFaturaCartaoAmount ?? 0);
  const [custoFixoOutros, setCustoFixoOutros] = React.useState<number>(currentDefaults?.custoFixoOutrosAmount ?? 0);
  const [custoFixoTotalEdit, setCustoFixoTotalEdit] = React.useState<number>(currentDefaults?.custoFixoTotalAmount ?? 0);
  const [custoVarInsumos, setCustoVarInsumos] = React.useState<number>(currentDefaults?.custoVariavelInsumosAmount ?? 0);
  const [custoVarEntrega, setCustoVarEntrega] = React.useState<number>(currentDefaults?.custoVariavelEntregaAmount ?? 0);
  const [custoVarImpostos, setCustoVarImpostos] = React.useState<number>(currentDefaults?.custoVariavelImpostosAmount ?? 0);
  const [custoVarMarketing, setCustoVarMarketing] = React.useState<number>(currentDefaults?.custoVariavelMarketingAmount ?? 0); // Trafego Pago (Meta)
  const [custoVarOutros, setCustoVarOutros] = React.useState<number>(currentDefaults?.custoVariavelOutrosAmount ?? 0);
  const [custoVarTotalEdit, setCustoVarTotalEdit] = React.useState<number>(currentDefaults?.custoVariavelTotalAmount ?? 0);

  React.useEffect(() => {
    setReceitaBruta(currentDefaults?.receitaBrutaAmount ?? 0);
    setImpostoPerc(currentDefaults?.impostoPerc ?? 0);
    setVendaCartaoAmount(currentDefaults?.vendaCartaoAmount ?? 0);
    setTaxaCartaoPerc(currentDefaults?.taxaCartaoPerc ?? 0);
    setVendaMarketplaceAmount(currentDefaults?.vendaMarketplaceAmount ?? 0);
    setTaxaMarketplacePerc(currentDefaults?.taxaMarketplacePerc ?? 0);
    setCustoFixoFolha(currentDefaults?.custoFixoFolhaAmount ?? 0);
    setCustoFixoFolhaFuncionarios(currentDefaults?.custoFixoFolhaFuncionariosAmount ?? 0);
    setCustoFixoProlabore(currentDefaults?.custoFixoProlaboreAmount ?? 0);
    setCustoFixoRetiradaProlabore(currentDefaults?.custoFixoRetiradaProlaboreAmount ?? 0);
    setCustoFixoRetiradaResultado(currentDefaults?.custoFixoRetiradaResultadoAmount ?? 0);
    setCustoFixoFinanciamento(currentDefaults?.custoFixoParcelaFinanciamentoAmount ?? 0);
    setCustoFixoMarketing(currentDefaults?.custoFixoMarketingAmount ?? 0);
    setCustoFixoFaturaCartao(currentDefaults?.custoFixoFaturaCartaoAmount ?? 0);
    setCustoFixoOutros(currentDefaults?.custoFixoOutrosAmount ?? 0);
    setCustoFixoTotalEdit(currentDefaults?.custoFixoTotalAmount ?? 0);
    setCustoVarInsumos(currentDefaults?.custoVariavelInsumosAmount ?? 0);
    setCustoVarEntrega(currentDefaults?.custoVariavelEntregaAmount ?? 0);
    setCustoVarImpostos(currentDefaults?.custoVariavelImpostosAmount ?? 0);
    setCustoVarMarketing(currentDefaults?.custoVariavelMarketingAmount ?? 0);
    setCustoVarOutros(currentDefaults?.custoVariavelOutrosAmount ?? 0);
    setCustoVarTotalEdit(currentDefaults?.custoVariavelTotalAmount ?? 0);
  }, [currentDefaults?.id, currentDefaults?.referenceMonth, currentDefaults?.referenceYear]);

  const taxaCartaoAmountPreview = vendaCartaoAmount > 0 ? (vendaCartaoAmount * taxaCartaoPerc) / 100 : 0;
  const taxaMarketplaceAmountPreview = vendaMarketplaceAmount > 0 ? (vendaMarketplaceAmount * taxaMarketplacePerc) / 100 : 0;
  const custoFixoTotalPreview = custoFixoTotalEdit;
  const custoVariavelTotalPreview = custoVarTotalEdit;
  const custoFixoOutrosPreview = custoFixoTotalEdit - (custoFixoFolha + custoFixoFolhaFuncionarios + custoFixoProlabore + custoFixoRetiradaProlabore + custoFixoRetiradaResultado + custoFixoFinanciamento + custoFixoMarketing + custoFixoFaturaCartao);
  const custoVariavelOutrosPreview = custoVarTotalEdit - (custoVarInsumos + custoVarEntrega + custoVarImpostos);
  const margemContribPreview = receitaBruta - custoVariavelTotalPreview;
  const resultadoLiquidoPreview = margemContribPreview - custoFixoTotalPreview;
  const resultadoLiquidoPercPreview = receitaBruta > 0 ? (resultadoLiquidoPreview / receitaBruta) * 100 : 0;

  return (
    <div className="space-y-6 mb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Fechamento mensal</h2>
          <p className="text-sm text-muted-foreground">Registre o fechamento do mês com os principais custos para recalcular metas.</p>
        </div>
        {currentDefaults && (
          <Card className="min-w-[260px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Último fechamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Ref.</span>
                <span className="font-medium">
                  {MONTH_OPTIONS.find((m) => m.value === currentDefaults.referenceMonth)?.label ?? currentDefaults.referenceMonth} / {currentDefaults.referenceYear}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Receita líquida</span>
                <span className="font-mono">{formatMoneyString(currentDefaults.receitaLiquidaAmount, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ponto de equilíbrio</span>
                <span className="font-mono">{formatMoneyString(currentDefaults.pontoEquilibrioAmount, 2)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Margem de contribuição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Receita de caixa menos custos variáveis. É o que sobra para pagar os fixos.
            </p>
            <div className="flex justify-between">
              <span>Valor</span>
              <span className="font-mono">{formatMoneyString(totals.margemContrib, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>% sobre receita de caixa</span>
              <span className="font-mono">{totals.margemContribPerc.toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resultado líquido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Margem de contribuição menos custos fixos. Lucro/prejuízo do mês.
            </p>
            <div className="flex justify-between">
              <span>Valor</span>
              <span className="font-mono">{formatMoneyString(totals.resultadoLiquido, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>% sobre receita bruta</span>
              <span className={`font-mono ${totals.resultadoLiquido >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totals.resultadoLiquidoPercBruta.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ponto de equilíbrio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              Receita de caixa mínima para zerar lucro. Cobertura mostra o quanto a receita atual alcança do PE.
            </p>
            <div className="flex justify-between">
              <span>Valor</span>
              <span className="font-mono">{formatMoneyString(totals.pontoEquilibrio, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cobertura</span>
              <span className="font-mono">
                {totals.receitaBruta > 0 ? ((totals.receitaBruta / (totals.pontoEquilibrio || 1)) * 100).toFixed(2) : "0.00"}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {(action || monthlyCloseRepoMissing) && (
        <Alert variant={(action?.ok ?? !monthlyCloseRepoMissing) ? "default" : "destructive"}>
          <AlertTitle>{action?.ok ? "Sucesso" : "Erro"}</AlertTitle>
          <AlertDescription>
            {monthlyCloseRepoMissing
              ? "Tabela de fechamento mensal não encontrada. Rode `prisma migrate dev` e `prisma generate`."
              : action?.message}
          </AlertDescription>
        </Alert>
      )}

      <Form
        method="post"
        className="space-y-6"
        key={`${referenceMonth}-${referenceYear}-${currentDefaults?.id ?? "novo"}`}
      >
        <input type="hidden" name="intent" value="save" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <Label>Mês</Label>
            <select
              name="referenceMonth"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(Number(e.target.value))}
              className="h-9 rounded-md border px-2"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Ano</Label>
            <input
              name="referenceYear"
              type="number"
              className="h-9 rounded-md border px-2"
              value={referenceYear}
              onChange={(e) => setReferenceYear(Number(e.target.value))}
              min={2020}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-8 gap-4">
          <Card className="lg:col-span-3" >
            <CardHeader className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-sm font-semibold">Receita (caixa)</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Use o valor que entrou na conta no mês, já líquido de taxas de cartão e marketplace.
                  </p>
                </div>

              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Receita de caixa do mês (R$)</Label>
                <DecimalInput
                  name="receitaBrutaAmount"
                  defaultValue={currentDefaults?.receitaBrutaAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setReceitaBruta(Number(e?.target?.value ?? 0))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-sm font-semibold">Dados informativos</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Esse valores são gravado com o unico escopo de historico
                  </p>
                </div>

              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">

              <div className="grid md:grid-cols-3 items-center gap-x-4">
                <div className="flex flex-col gap-2">
                  <Label>Venda no cartão (R$)</Label>
                  <DecimalInput
                    name="vendaCartaoAmount"
                    defaultValue={currentDefaults?.vendaCartaoAmount ?? 0}
                    fractionDigits={2}
                    className="w-full"
                    onChange={(e: any) => setVendaCartaoAmount(Number(e?.target?.value ?? 0))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Taxa Cartão (%)</Label>
                  <DecimalInput
                    name="taxaCartaoPerc"
                    defaultValue={currentDefaults?.taxaCartaoPerc ?? 0}
                    fractionDigits={2}
                    className="w-full"
                    onChange={(e: any) => setTaxaCartaoPerc(Number(e?.target?.value ?? 0))}
                  />


                </div>
                <div className="flex flex-col">
                  <Label>Taxa Cartão (R$)</Label>
                  <DecimalInput
                    name="taxaCartaoAmountPreview"
                    defaultValue={taxaCartaoAmountPreview}
                    fractionDigits={2}
                    className="w-full bg-muted text-muted-foreground font-mono"
                    disabled
                    readOnly
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 items-center gap-x-4">
                <div className="flex flex-col gap-2">
                  <Label>Venda marketplace (R$)</Label>
                  <DecimalInput
                    name="vendaMarketplaceAmount"
                    defaultValue={currentDefaults?.vendaMarketplaceAmount ?? 0}
                    fractionDigits={2}
                    className="w-full"
                    onChange={(e: any) => setVendaMarketplaceAmount(Number(e?.target?.value ?? 0))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Taxa marketplace (%)</Label>
                  <DecimalInput
                    name="taxaMarketplacePerc"
                    defaultValue={currentDefaults?.taxaMarketplacePerc ?? 0}
                    fractionDigits={2}
                    className="w-full"
                    onChange={(e: any) => setTaxaMarketplacePerc(Number(e?.target?.value ?? 0))}
                  />

                </div>
                <div className="flex flex-col">
                  <Label>Taxa marketplace (R$)</Label>
                  <DecimalInput
                    name="taxaMarketplaceAmountPreview"
                    defaultValue={taxaMarketplaceAmountPreview}
                    fractionDigits={2}
                    className="w-full bg-muted text-muted-foreground font-mono"
                    disabled
                    readOnly
                  />
                </div>
              </div>
            </CardContent>
          </Card>


        </div>



        <Separator />

        {/* Custos variáveis logo após receita */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Custos variáveis (principais)</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Total (editável):</span>
                  <DecimalInput
                    name="custoVariavelTotalAmount"
                    defaultValue={custoVarTotalEdit}
                    fractionDigits={2}
                    className="w-32"
                    onChange={(e: any) => setCustoVarTotalEdit(Number(e?.target?.value ?? 0))}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Imposto sobre vendas (R$)</Label>
                <DecimalInput
                  name="custoVariavelImpostosAmount"
                  defaultValue={currentDefaults?.custoVariavelImpostosAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoVarImpostos(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Insumos (R$)</Label>
                <DecimalInput
                  name="custoVariavelInsumosAmount"
                  defaultValue={currentDefaults?.custoVariavelInsumosAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoVarInsumos(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Entrega (R$)</Label>
                <DecimalInput
                  name="custoVariavelEntregaAmount"
                  defaultValue={currentDefaults?.custoVariavelEntregaAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoVarEntrega(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tráfego Pago (Meta) (R$)</Label>
                <DecimalInput
                  name="custoVariavelMarketingAmount"
                  defaultValue={currentDefaults?.custoVariavelMarketingAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoVarMarketing(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="md:col-span-2">
                <Separator />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Outros variáveis (R$)</Label>
                <DecimalInput
                  key={`outros-var-${custoVariavelOutrosPreview}`}
                  name="custoVariavelOutrosAmount"
                  defaultValue={custoVariavelOutrosPreview}
                  fractionDigits={2}
                  className="w-full bg-muted text-muted-foreground font-mono"
                  disabled
                  readOnly
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Custos fixos (principais)</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Total (editável):</span>
                  <DecimalInput
                    name="custoFixoTotalAmount"
                    defaultValue={custoFixoTotalEdit}
                    fractionDigits={2}
                    className="w-32"
                    onChange={(e: any) => setCustoFixoTotalEdit(Number(e?.target?.value ?? 0))}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Folha funcionários (R$)</Label>
                <DecimalInput
                  name="custoFixoFolhaFuncionariosAmount"
                  defaultValue={currentDefaults?.custoFixoFolhaFuncionariosAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoFixoFolhaFuncionarios(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Pró-labore (R$)</Label>
                <DecimalInput
                  name="custoFixoProlaboreAmount"
                  defaultValue={currentDefaults?.custoFixoProlaboreAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoFixoProlabore(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Retirada de lucro / pró-labore (R$)</Label>
                <DecimalInput
                  name="custoFixoRetiradaProlaboreAmount"
                  defaultValue={currentDefaults?.custoFixoRetiradaProlaboreAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoFixoRetiradaProlabore(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Retirada de lucro / resultado (R$)</Label>
                <DecimalInput
                  name="custoFixoRetiradaResultadoAmount"
                  defaultValue={currentDefaults?.custoFixoRetiradaResultadoAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoFixoRetiradaResultado(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Parcela financiamento (R$)</Label>
                <DecimalInput
                  name="custoFixoParcelaFinanciamentoAmount"
                  defaultValue={currentDefaults?.custoFixoParcelaFinanciamentoAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoFixoFinanciamento(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Fatura cartão crédito (R$)</Label>
                <DecimalInput
                  name="custoFixoFaturaCartaoAmount"
                  defaultValue={currentDefaults?.custoFixoFaturaCartaoAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoFixoFaturaCartao(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Marketing (R$)</Label>
                <DecimalInput
                  name="custoFixoMarketingAmount"
                  defaultValue={currentDefaults?.custoFixoMarketingAmount ?? 0}
                  fractionDigits={2}
                  className="w-full"
                  onChange={(e: any) => setCustoFixoMarketing(Number(e?.target?.value ?? 0))}
                />
              </div>
              <div className="md:col-span-2">
                <Separator />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Outros fixos (R$)</Label>
                <DecimalInput
                  key={`outros-fixo-${custoFixoOutrosPreview}`}
                  name="custoFixoOutrosAmount"
                  defaultValue={custoFixoOutrosPreview}
                  fractionDigits={2}
                  className="w-full bg-muted text-muted-foreground font-mono"
                  disabled
                  readOnly
                />
              </div>
            </CardContent>
          </Card>


        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar fechamento"}
          </Button>
        </div>
      </Form>

      <Separator />

      <section className="space-y-4">
        <h3 className="font-semibold">Fechamentos recentes</h3>
        {closes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum fechamento salvo ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {closes.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {MONTH_OPTIONS.find((m) => m.value === c.referenceMonth)?.label ?? c.referenceMonth} / {c.referenceYear}
                    </CardTitle>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="ghost" size="sm">Excluir</Button>
                    </Form>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receita líquida {formatMoneyString(c.receitaLiquidaAmount, 2)} · PE {formatMoneyString(c.pontoEquilibrioAmount, 2)}
                  </p>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-xs">
                  <span>Custo fixo: {formatMoneyString(c.custoFixoTotalAmount, 2)}</span>
                  <span>Custo variável: {formatMoneyString(c.custoVariavelTotalAmount, 2)}</span>
                  <span>Cartão: {formatMoneyString(c.taxaCartaoAmount, 2)}</span>
                  <span>Marketplace: {formatMoneyString(c.taxaMarketplaceAmount, 2)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
