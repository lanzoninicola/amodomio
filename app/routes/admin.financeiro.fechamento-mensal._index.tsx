// app/routes/admin.financeiro.fechamento-mensal.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import prismaClient from "~/lib/prisma/client.server";
import { DecimalInput } from "~/components/inputs/inputs";
import formatMoneyString from "~/utils/format-money-string";
import { FinancialMonthlyClose } from "@prisma/client";
import { computeNetRevenueAmount } from "~/domain/finance/compute-net-revenue-amount";
import { useToast } from "~/components/ui/use-toast";
import { calcMonthlyCloseTotals } from "~/domain/finance/calc-monthly-close-totals";

type LoaderData = {
  closes: FinancialMonthlyClose[];
  monthlyCloseRepoMissing?: boolean;
};

type ActionData = {
  ok: boolean;
  message: string;
};

export const meta: MetaFunction = () => [
  { title: "Fechamento mensal | Admin" },
];

const MISSING_REPO_MESSAGE = "Tabela de fechamento mensal não encontrada. Rode `prisma migrate dev` e `prisma generate`.";

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
        message: MISSING_REPO_MESSAGE,
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
    const notes = String(form.get("notes") ?? "").trim();
    const faturamentoMensalAmount = num("faturamentoMensalAmount");

    if (!referenceMonth || !referenceYear) {
      return json({ ok: false, message: "Informe mês e ano do fechamento." });
    }

    // Base de caixa: receita do mês (já líquida das operadoras) menos custos variáveis manuais
    const receitaExtratoBancoAmount = num("receitaExtratoBancoAmount");
    const receitaDinheiroAmount = num("receitaDinheiroAmount");
    const receitaBrutaAmount = receitaExtratoBancoAmount + receitaDinheiroAmount;

    // Dados informativos (alimentam cálculo da receita líquida)
    const vendaCartaoAmount = num("vendaCartaoAmount");
    const taxaCartaoPerc = num("taxaCartaoPerc");
    const vendaMarketplaceAmount = num("vendaMarketplaceAmount");
    const taxaMarketplacePerc = num("taxaMarketplacePerc");

    // Custos fixos
    const custoFixoPlanoSaudeAmount = num("custoFixoPlanoSaudeAmount");
    const custoFixoFolhaFuncionariosAmount = num("custoFixoFolhaFuncionariosAmount");
    const custoFixoProlaboreAmount = num("custoFixoProlaboreAmount");
    const custoFixoRetiradaProlaboreAmount = num("custoFixoRetiradaProlaboreAmount");
    const custoFixoRetiradaResultadoAmount = num("custoFixoRetiradaResultadoAmount");
    const custoFixoParcelaFinanciamentoAmount = num("custoFixoParcelaFinanciamentoAmount");
    const custoFixoAssessoriaMarketingAmount = num("custoFixoAssessoriaMarketingAmount");
    const custoFixoFaturaCartaoAmount = num("custoFixoFaturaCartaoAmount");
    const custoFixoTrafegoPagoAmount = num("custoFixoTrafegoPagoAmount");
    const custoFixoTotalAmount = num("custoFixoTotalAmount");
    const custoFixoOutrosAmount =
      custoFixoTotalAmount -
      (custoFixoPlanoSaudeAmount +
        custoFixoFolhaFuncionariosAmount +
        custoFixoProlaboreAmount +
        custoFixoRetiradaProlaboreAmount +
        custoFixoRetiradaResultadoAmount +
        custoFixoParcelaFinanciamentoAmount +
        custoFixoAssessoriaMarketingAmount +
        custoFixoTrafegoPagoAmount +
        custoFixoFaturaCartaoAmount);

    // Custos variáveis (todos manuais)
    const custoVariavelInsumosAmount = num("custoVariavelInsumosAmount");
    const custoVariavelEntregaAmount = num("custoVariavelEntregaAmount");
    const custoVariavelImpostosAmount = num("custoVariavelImpostosAmount");
    const custoVariavelTotalAmount = num("custoVariavelTotalAmount");
    const custoVariavelOutrosAmount =
      custoVariavelTotalAmount -
      (custoVariavelInsumosAmount +
        custoVariavelEntregaAmount +
        custoVariavelImpostosAmount);

    const impostoAmount = custoVariavelImpostosAmount;
    const impostoPerc = receitaBrutaAmount > 0
      ? Number(((impostoAmount / receitaBrutaAmount) * 100).toFixed(2))
      : 0;

    const entradasNaoOperacionaisAmount = num("entradasNaoOperacionaisAmount");
    const saidasNaoOperacionaisAmount = num("saidasNaoOperacionaisAmount");

    const vendaCartaoPerc = receitaBrutaAmount > 0 ? (vendaCartaoAmount / receitaBrutaAmount) * 100 : 0;
    const receitaBrutaCartao = receitaBrutaAmount > 0 ? (receitaBrutaAmount * vendaCartaoPerc) / 100 : 0;
    const taxaCartaoAmount = receitaBrutaCartao > 0 ? (receitaBrutaCartao * taxaCartaoPerc) / 100 : 0;
    const taxaMarketplaceAmount = vendaMarketplaceAmount > 0 ? (vendaMarketplaceAmount * taxaMarketplacePerc) / 100 : 0;

    const custoFixoTotalAmountNormalized = custoFixoTotalAmount;
    const custoVariavelTotalAmountNormalized = custoVariavelTotalAmount;

    const receitaLiquidaAmount = computeNetRevenueAmount({
      receitaBrutaAmount,
      vendaCartaoAmount,
      taxaCartaoPerc,
      impostoPerc,
      vendaMarketplaceAmount,
      taxaMarketplacePerc,
    });
    const custoFixoPerc = receitaLiquidaAmount > 0 ? custoFixoTotalAmountNormalized / receitaLiquidaAmount : 0;
    const custoVariavelPerc = receitaBrutaAmount > 0 ? custoVariavelTotalAmountNormalized / receitaBrutaAmount : 0;

    const pontoEquilibrioAmount = receitaBrutaAmount > 0 && (1 - custoVariavelPerc) !== 0
      ? custoFixoTotalAmountNormalized / (1 - custoVariavelPerc)
      : 0;

    const margemContribAmount = receitaBrutaAmount - custoVariavelTotalAmountNormalized;
    const margemContribPerc = receitaBrutaAmount > 0 ? (margemContribAmount / receitaBrutaAmount) * 100 : 0;
    const resultadoNaoOperacionalAmount = entradasNaoOperacionaisAmount - saidasNaoOperacionaisAmount;
    const resultadoLiquidoAmount = (margemContribAmount - custoFixoTotalAmountNormalized) + resultadoNaoOperacionalAmount;
    const resultadoLiquidoPerc = receitaBrutaAmount > 0 ? (resultadoLiquidoAmount / receitaBrutaAmount) * 100 : 0;

    const data = {
      referenceMonth,
      referenceYear,
      receitaExtratoBancoAmount,
      receitaDinheiroAmount,
      receitaBrutaAmount,
      faturamentoMensalAmount,
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

      custoFixoPlanoSaudeAmount,
      custoFixoFolhaFuncionariosAmount,
      custoFixoProlaboreAmount,
      custoFixoRetiradaProlaboreAmount,
      custoFixoRetiradaResultadoAmount,
      custoFixoParcelaFinanciamentoAmount,
      custoFixoAssessoriaMarketingAmount,
      custoVariavelMarketingAmount: custoFixoTrafegoPagoAmount,
      custoFixoFaturaCartaoAmount,
      custoFixoOutrosAmount,

      custoVariavelInsumosAmount,
      custoVariavelEntregaAmount,
      custoVariavelImpostosAmount,
      custoVariavelOutrosAmount,

      custoFixoTotalAmount: custoFixoTotalAmountNormalized,
      custoVariavelTotalAmount: custoVariavelTotalAmountNormalized,
      custoFixoPerc,
      custoVariavelPerc,
      pontoEquilibrioAmount,
      margemContribAmount,
      margemContribPerc,
      entradasNaoOperacionaisAmount,
      saidasNaoOperacionaisAmount,
      resultadoLiquidoAmount,
      resultadoLiquidoPerc,
      notes: notes || null,
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

type StatusTone = "good" | "warn" | "bad";

function badgeClasses(tone: StatusTone) {
  if (tone === "good") return "bg-emerald-100 text-emerald-700";
  if (tone === "warn") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-700";
}

function ratePercent(value: number, kind: "margem" | "resultado") {
  const good = kind === "margem" ? 35 : 15;
  const warn = kind === "margem" ? 20 : 5;
  if (value >= good) {
    return { label: "Saudável", tone: "good" as StatusTone, text: "Acima da referência: boa folga." };
  }
  if (value >= warn) {
    return { label: "Atenção", tone: "warn" as StatusTone, text: "Ok, mas acompanhe custos e receita." };
  }
  return { label: "Crítico", tone: "bad" as StatusTone, text: "Abaixo do ideal: reveja custos/receita." };
}

function rateCobertura(coveragePerc: number) {
  if (coveragePerc >= 110) {
    return { label: "Coberto", tone: "good" as StatusTone, text: "Receita cobre o ponto de equilíbrio." };
  }
  if (coveragePerc >= 90) {
    return { label: "No limite", tone: "warn" as StatusTone, text: "Quase lá: mantenha foco em margem." };
  }
  return { label: "Descoberto", tone: "bad" as StatusTone, text: "Falta receita ou reduzir custos." };
}

export default function AdminFinanceiroFechamentoMensal() {
  const { closes, monthlyCloseRepoMissing } = useLoaderData<typeof loader>();
  const action = useActionData<ActionData>();
  const nav = useNavigation();
  const submit = useSubmit();
  const formRef = React.useRef<HTMLFormElement>(null);
  const saving = nav.state !== "idle";
  const { toast } = useToast();

  const now = new Date();
  const [referenceMonth, setReferenceMonth] = React.useState<number>(now.getMonth() + 1);
  const [referenceYear, setReferenceYear] = React.useState<number>(now.getFullYear());

  const currentDefaults =
    closes.find((c) => c.referenceMonth === referenceMonth && c.referenceYear === referenceYear) ??
    closes[0];
  const totals = calcMonthlyCloseTotals(currentDefaults);
  const lastClose = React.useMemo(() => {
    if (!currentDefaults) return undefined;
    const prevMonth = currentDefaults.referenceMonth === 1 ? 12 : currentDefaults.referenceMonth - 1;
    const prevYear = currentDefaults.referenceMonth === 1 ? currentDefaults.referenceYear - 1 : currentDefaults.referenceYear;
    return closes.find((c) => c.referenceMonth === prevMonth && c.referenceYear === prevYear);
  }, [closes, currentDefaults]);
  const lastTotals = calcMonthlyCloseTotals(lastClose);

  const receitaBase = React.useMemo(() => {
    const extrato = (currentDefaults as any)?.receitaExtratoBancoAmount ?? 0;
    const dinheiro = (currentDefaults as any)?.receitaDinheiroAmount ?? 0;
    const receitaBrutaAmount = currentDefaults?.receitaBrutaAmount ?? 0;
    const hasSplit = (extrato ?? 0) + (dinheiro ?? 0) > 0;
    return {
      extrato: hasSplit ? extrato : receitaBrutaAmount,
      dinheiro: hasSplit ? dinheiro : 0,
      bruta: receitaBrutaAmount,
    };
  }, [currentDefaults]);

  const [receitaExtratoBanco, setReceitaExtratoBanco] = React.useState<number>(
    receitaBase.extrato,
  );
  const [receitaDinheiro, setReceitaDinheiro] = React.useState<number>(
    receitaBase.dinheiro,
  );
  const [faturamentoMensal, setFaturamentoMensal] = React.useState<number>((currentDefaults as any)?.faturamentoMensalAmount ?? 0);
  const [vendaCartaoAmount, setVendaCartaoAmount] = React.useState<number>(currentDefaults?.vendaCartaoAmount ?? 0);
  const [taxaCartaoPerc, setTaxaCartaoPerc] = React.useState<number>(currentDefaults?.taxaCartaoPerc ?? 0);
  const [vendaMarketplaceAmount, setVendaMarketplaceAmount] = React.useState<number>(currentDefaults?.vendaMarketplaceAmount ?? 0);
  const [taxaMarketplacePerc, setTaxaMarketplacePerc] = React.useState<number>(currentDefaults?.taxaMarketplacePerc ?? 0);
  const [custoFixoPlanoSaude, setCustoFixoPlanoSaude] = React.useState<number>(currentDefaults?.custoFixoFolhaAmount ?? 0);
  const [custoFixoFolhaFuncionarios, setCustoFixoFolhaFuncionarios] = React.useState<number>(currentDefaults?.custoFixoFolhaFuncionariosAmount ?? 0);
  const [custoFixoProlabore, setCustoFixoProlabore] = React.useState<number>(currentDefaults?.custoFixoProlaboreAmount ?? 0);
  const [custoFixoRetiradaProlabore, setCustoFixoRetiradaProlabore] = React.useState<number>(currentDefaults?.custoFixoRetiradaProlaboreAmount ?? 0);
  const [custoFixoRetiradaResultado, setCustoFixoRetiradaResultado] = React.useState<number>(currentDefaults?.custoFixoRetiradaResultadoAmount ?? 0);
  const [custoFixoFinanciamento, setCustoFixoFinanciamento] = React.useState<number>(currentDefaults?.custoFixoParcelaFinanciamentoAmount ?? 0);
  const [custoFixoMarketing, setCustoFixoMarketing] = React.useState<number>(currentDefaults?.custoFixoAssessoriaMarketingAmount ?? 0);
  const [custoFixoTrafegoPago, setCustoFixoTrafegoPago] = React.useState<number>(currentDefaults?.custoVariavelMarketingAmount ?? 0);
  const [custoFixoFaturaCartao, setCustoFixoFaturaCartao] = React.useState<number>(currentDefaults?.custoFixoFaturaCartaoAmount ?? 0);
  const [custoFixoTotalEdit, setCustoFixoTotalEdit] = React.useState<number>(currentDefaults?.custoFixoTotalAmount ?? 0);
  const [custoVarInsumos, setCustoVarInsumos] = React.useState<number>(currentDefaults?.custoVariavelInsumosAmount ?? 0);
  const [custoVarEntrega, setCustoVarEntrega] = React.useState<number>(currentDefaults?.custoVariavelEntregaAmount ?? 0);
  const [custoVarImpostos, setCustoVarImpostos] = React.useState<number>(currentDefaults?.custoVariavelImpostosAmount ?? 0);
  const [custoVarTotalEdit, setCustoVarTotalEdit] = React.useState<number>(currentDefaults?.custoVariavelTotalAmount ?? 0);
  const [entradasNaoOperacionais, setEntradasNaoOperacionais] = React.useState<number>((currentDefaults as any)?.entradasNaoOperacionaisAmount ?? 0);
  const [saidasNaoOperacionais, setSaidasNaoOperacionais] = React.useState<number>((currentDefaults as any)?.saidasNaoOperacionaisAmount ?? 0);
  const [notes, setNotes] = React.useState<string>(currentDefaults?.notes ?? "");
  const [loadStatus, setLoadStatus] = React.useState<"idle" | "loading" | "ok" | "notfound">("idle");
  const [isSwitchingPeriod, setIsSwitchingPeriod] = React.useState(false);

  const resetFormValues = React.useCallback(() => {
    setReceitaExtratoBanco(0);
    setReceitaDinheiro(0);
    setFaturamentoMensal(0);
    setVendaCartaoAmount(0);
    setTaxaCartaoPerc(0);
    setVendaMarketplaceAmount(0);
    setTaxaMarketplacePerc(0);
    setCustoFixoPlanoSaude(0);
    setCustoFixoFolhaFuncionarios(0);
    setCustoFixoProlabore(0);
    setCustoFixoRetiradaProlabore(0);
    setCustoFixoRetiradaResultado(0);
    setCustoFixoFinanciamento(0);
    setCustoFixoMarketing(0);
    setCustoFixoTrafegoPago(0);
    setCustoFixoFaturaCartao(0);
    setCustoFixoTotalEdit(0);
    setCustoVarInsumos(0);
    setCustoVarEntrega(0);
    setCustoVarImpostos(0);
    setCustoVarTotalEdit(0);
    setEntradasNaoOperacionais(0);
    setSaidasNaoOperacionais(0);
    setNotes("");
  }, []);

  const applyCloseValues = React.useCallback((close?: Partial<FinancialMonthlyClose> | null) => {
    if (!close) return;
    const extrato = (close as any)?.receitaExtratoBancoAmount ?? 0;
    const dinheiro = (close as any)?.receitaDinheiroAmount ?? 0;
    const receitaBrutaAmount = close?.receitaBrutaAmount ?? 0;
    const hasSplit = (extrato ?? 0) + (dinheiro ?? 0) > 0;

    setReceitaExtratoBanco(hasSplit ? extrato : receitaBrutaAmount);
    setReceitaDinheiro(hasSplit ? dinheiro : 0);
    setFaturamentoMensal((close as any)?.faturamentoMensalAmount ?? 0);
    setVendaCartaoAmount(close?.vendaCartaoAmount ?? 0);
    setTaxaCartaoPerc(close?.taxaCartaoPerc ?? 0);
    setVendaMarketplaceAmount(close?.vendaMarketplaceAmount ?? 0);
    setTaxaMarketplacePerc(close?.taxaMarketplacePerc ?? 0);
    setCustoFixoPlanoSaude(close?.custoFixoFolhaAmount ?? close?.custoFixoPlanoSaudeAmount ?? 0);
    setCustoFixoFolhaFuncionarios(close?.custoFixoFolhaFuncionariosAmount ?? 0);
    setCustoFixoProlabore(close?.custoFixoProlaboreAmount ?? 0);
    setCustoFixoRetiradaProlabore(close?.custoFixoRetiradaProlaboreAmount ?? 0);
    setCustoFixoRetiradaResultado(close?.custoFixoRetiradaResultadoAmount ?? 0);
    setCustoFixoFinanciamento(close?.custoFixoParcelaFinanciamentoAmount ?? 0);
    setCustoFixoMarketing(close?.custoFixoAssessoriaMarketingAmount ?? 0);
    setCustoFixoTrafegoPago(close?.custoVariavelMarketingAmount ?? close?.custoFixoTrafegoPagoAmount ?? 0);
    setCustoFixoFaturaCartao(close?.custoFixoFaturaCartaoAmount ?? 0);
    setCustoFixoTotalEdit(close?.custoFixoTotalAmount ?? 0);
    setCustoVarInsumos(close?.custoVariavelInsumosAmount ?? 0);
    setCustoVarEntrega(close?.custoVariavelEntregaAmount ?? 0);
    setCustoVarImpostos(close?.custoVariavelImpostosAmount ?? 0);
    setCustoVarTotalEdit(close?.custoVariavelTotalAmount ?? 0);
    setEntradasNaoOperacionais((close as any)?.entradasNaoOperacionaisAmount ?? 0);
    setSaidasNaoOperacionais((close as any)?.saidasNaoOperacionaisAmount ?? 0);
    setNotes(close?.notes ?? "");
  }, []);

  const loadSavedValues = React.useCallback((opts?: { resetOnMissing?: boolean }) => {
    setIsSwitchingPeriod(true);
    setLoadStatus("loading");

    setTimeout(() => {
      const match = closes.find((c) => c.referenceMonth === referenceMonth && c.referenceYear === referenceYear);
      if (!match) {
        if (opts?.resetOnMissing ?? true) {
          resetFormValues();
        }
        setLoadStatus("notfound");
        setIsSwitchingPeriod(false);
        setTimeout(() => setLoadStatus("idle"), 1200);
        return;
      }
      applyCloseValues(match);
      setLoadStatus("ok");
      setIsSwitchingPeriod(false);
      setTimeout(() => setLoadStatus("idle"), 1200);
    }, 450);
  }, [applyCloseValues, closes, referenceMonth, referenceYear, resetFormValues]);

  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current) return;
    applyCloseValues(currentDefaults);
    didInit.current = true;
  }, [applyCloseValues, currentDefaults]);

  const hasAutoLoaded = React.useRef(false);
  React.useEffect(() => {
    if (!didInit.current) return;
    if (!hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      return;
    }
    loadSavedValues({ resetOnMissing: true });
  }, [loadSavedValues, referenceMonth, referenceYear]);

  const receitaBruta = receitaExtratoBanco + receitaDinheiro;
  const taxaCartaoAmountPreview = vendaCartaoAmount > 0 ? (vendaCartaoAmount * taxaCartaoPerc) / 100 : 0;
  const taxaMarketplaceAmountPreview = vendaMarketplaceAmount > 0 ? (vendaMarketplaceAmount * taxaMarketplacePerc) / 100 : 0;
  const impostoAmountPreview = custoVarImpostos;
  const impostoPercPreview = receitaBruta > 0
    ? Number(((impostoAmountPreview / receitaBruta) * 100).toFixed(2))
    : 0;
  const receitaLiquidaPreview = computeNetRevenueAmount({
    receitaBrutaAmount: receitaBruta,
    vendaCartaoAmount,
    taxaCartaoPerc,
    impostoPerc: impostoPercPreview,
    vendaMarketplaceAmount,
    taxaMarketplacePerc,
  });
  const custoFixoTotalPreview = custoFixoTotalEdit;
  const custoVariavelTotalPreview = custoVarTotalEdit;
  const custoFixoOutrosPreview = custoFixoTotalEdit - (custoFixoPlanoSaude + custoFixoFolhaFuncionarios + custoFixoProlabore + custoFixoRetiradaProlabore + custoFixoRetiradaResultado + custoFixoFinanciamento + custoFixoMarketing + custoFixoTrafegoPago + custoFixoFaturaCartao);
  const custoVariavelOutrosPreview = custoVarTotalEdit - (custoVarInsumos + custoVarEntrega + custoVarImpostos);
  const despesasPessoalTotal = custoFixoPlanoSaude + custoFixoFolhaFuncionarios + custoFixoProlabore + custoFixoRetiradaProlabore + custoFixoRetiradaResultado;
  const marketingTotal = custoFixoMarketing + custoFixoTrafegoPago;
  const servicoDividaTotal = custoFixoFinanciamento + custoFixoFaturaCartao;
  const margemContribPreview = receitaBruta - custoVariavelTotalPreview;
  const resultadoNaoOperacionalPreview = entradasNaoOperacionais - saidasNaoOperacionais;
  const resultadoLiquidoPreview = (margemContribPreview - custoFixoTotalPreview) + resultadoNaoOperacionalPreview;
  const resultadoLiquidoPercPreview = receitaBruta > 0 ? (resultadoLiquidoPreview / receitaBruta) * 100 : 0;
  const coberturaPreview = totals.pontoEquilibrio > 0 ? (totals.receitaBruta / totals.pontoEquilibrio) * 100 : 0;
  const diferencaFaturamentoReceitaBruta = faturamentoMensal - receitaBruta;
  const diferencaFaturamentoTone =
    diferencaFaturamentoReceitaBruta === 0
      ? "text-muted-foreground"
      : diferencaFaturamentoReceitaBruta > 0
        ? "text-emerald-600"
        : "text-red-600";

  const margemStatus = ratePercent(totals.margemContribPerc, "margem");
  const resultadoStatus = ratePercent(totals.resultadoLiquidoPercBruta, "resultado");
  const coberturaStatus = rateCobertura(coberturaPreview);
  const custoFixoPercBruta = totals.receitaBruta > 0 ? (totals.custoFixoTotal / totals.receitaBruta) * 100 : 0;
  const custoVariavelPercBruta = totals.receitaBruta > 0 ? (totals.custoVariavelTotal / totals.receitaBruta) * 100 : 0;
  const hasLastClose = Boolean(lastClose);
  const diffTone = (value: number) => (value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : "text-slate-500");
  const diffBadgeClass = (value: number) =>
    value > 0
      ? "text-emerald-700"
      : value < 0
        ? "text-red-700"
        : "text-slate-600";
  const diffLabel = (value: number, suffix = "") =>
    `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
  const isLoadingData = loadStatus === "loading";
  const formHidden = isLoadingData || isSwitchingPeriod;
  const loadStatusMeta = {
    idle: { label: "Pronto para carregar", tone: "muted" as const },
    loading: { label: "Carregando dados...", tone: "blue" as const },
    ok: { label: "Valores carregados", tone: "green" as const },
    notfound: { label: "Nenhum fechamento para este período", tone: "amber" as const },
  };
  const loadToneClass = {
    muted: "bg-muted text-foreground",
    blue: "bg-blue-100 text-blue-900",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-900",
  }[loadStatusMeta[loadStatus].tone];
  const formatShortPeriodLabel = (month: number, year: number) => {
    const label = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month);
    return `${String(label).slice(0, 3)}/${String(year).slice(-2)}`;
  };
  const currentMonthLabel = MONTH_OPTIONS.find((m) => m.value === referenceMonth)?.label ?? referenceMonth;
  const currentPeriodLabel = `${currentMonthLabel} / ${referenceYear}`;
  const lastCloseLabel = lastClose
    ? formatShortPeriodLabel(lastClose.referenceMonth, lastClose.referenceYear)
    : null;
  const lastClosingLabel = currentDefaults
    ? `${MONTH_OPTIONS.find((m) => m.value === currentDefaults.referenceMonth)?.label ?? currentDefaults.referenceMonth} / ${currentDefaults.referenceYear}`
    : null;

  React.useEffect(() => {
    if (!action) return;
    toast({
      title: action.ok ? "Sucesso" : "Erro",
      description: action.message,
      variant: action.ok ? "default" : "destructive",
    });
  }, [action, toast]);

  const handleSaveShortcut = React.useCallback((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    if (formHidden || saving) return;
    if (!formRef.current) return;
    submit(formRef.current);
  }, [formHidden, saving, submit]);

  React.useEffect(() => {
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [handleSaveShortcut]);

  React.useEffect(() => {
    if (!monthlyCloseRepoMissing) return;
    toast({
      title: "Erro",
      description: MISSING_REPO_MESSAGE,
      variant: "destructive",
      duration: 8000,
    });
  }, [monthlyCloseRepoMissing, toast]);

  return (
    <div className="space-y-6 mb-12">
      <Form
        method="post"
        className="space-y-6"
        ref={formRef}
      >
        <input type="hidden" name="intent" value="save" />

        <div className="sticky top-20 z-30 rounded-2xl border bg-card/70 shadow-sm backdrop-blur p-4 md:p-6 space-y-4">
          <div className="rounded-xl border bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">FECHAMENTO MENSAL</p>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-semibold">{currentPeriodLabel}</span>
                  <span className="rounded-full bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    Troque mês/ano abaixo para recalcular
                  </span>
                </div>
              </div>
              {currentDefaults && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg border bg-background/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Último fechamento</p>
                    <p className="font-semibold">{lastClosingLabel}</p>
                  </div>
                  <div className="rounded-lg border bg-background/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Receita líquida</p>
                    <p className="font-mono font-semibold">{formatMoneyString(receitaLiquidaPreview, 2)}</p>
                  </div>
                  <div className="rounded-lg border bg-background/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Ponto de equilíbrio</p>
                    <p className="font-mono font-semibold">{formatMoneyString(currentDefaults.pontoEquilibrioAmount, 2)}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 md:grid md:grid-cols-8 md:items-center ">
              <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end md:col-span-6">
                <div className="flex flex-col gap-1 col-span-2">
                  <Label>Mês</Label>
                  <select
                    name="referenceMonth"
                    value={referenceMonth}
                    onChange={(e) => setReferenceMonth(Number(e.target.value))}
                    className="h-11 rounded-md border bg-background px-3 text-sm shadow-sm transition focus-visible:border-foreground"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 col-span-1">
                  <Label>Ano</Label>
                  <input
                    name="referenceYear"
                    type="number"
                    className="h-11 rounded-md border bg-background px-3 text-sm shadow-sm transition focus-visible:border-foreground"
                    value={referenceYear}
                    onChange={(e) => setReferenceYear(Number(e.target.value))}
                    min={2020}
                  />
                </div>
              </div>
              <Badge variant="secondary" className={`flex items-center gap-2 px-3 py-2 text-xs font-medium md:col-span-2 ${loadToneClass}`}>
                {isLoadingData && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadStatusMeta[loadStatus].label}
              </Badge>
              <div className="md:col-span-8 flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/financeiro/fechamento-mensal/visualizar">
                    Ver visão anual de fechamentos
                  </Link>
                </Button>
              </div>
            </div>

          </div>




        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="rounded-2xl border bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] uppercase tracking-wide text-slate-900">
                  Margem de contribuição
                </CardTitle>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${badgeClasses(margemStatus.tone)}`}>
                  {margemStatus.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground text-right">{margemStatus.text}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Receita de caixa menos custos variáveis. É o que sobra para pagar os fixos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Valor</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatMoneyString(totals.margemContrib, 2)}
                  </div>
                  {hasLastClose && (
                    <div className={`text-[11px] font-semibold ${diffTone(totals.margemContrib - lastTotals.margemContrib)}`}>
                      {formatMoneyString(totals.margemContrib - lastTotals.margemContrib, 2)} vs {lastCloseLabel}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">% Receita de caixa</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                    {totals.margemContribPerc.toFixed(2)}%
                  </div>
                  {hasLastClose && (
                    <div className={`text-[11px] font-semibold ${diffTone(totals.margemContribPerc - lastTotals.margemContribPerc)}`}>
                      {diffLabel(totals.margemContribPerc - lastTotals.margemContribPerc, "%")} vs {lastCloseLabel}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] uppercase tracking-wide text-slate-900">
                  Resultado líquido
                </CardTitle>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${badgeClasses(resultadoStatus.tone)}`}>
                  {resultadoStatus.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground text-right">{resultadoStatus.text}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Margem de contribuição menos custos fixos. Lucro/prejuízo do mês.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Valor</div>
                  <div
                    className={`text-2xl font-bold tabular-nums ${totals.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {formatMoneyString(totals.resultadoLiquido, 2)}
                  </div>
                  {hasLastClose && (
                    <div
                      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${diffBadgeClass(
                        totals.resultadoLiquido - lastTotals.resultadoLiquido,
                      )}`}
                    >
                      {formatMoneyString(totals.resultadoLiquido - lastTotals.resultadoLiquido, 2)} vs {lastCloseLabel}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Ajuste não operacional</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatMoneyString(totals.entradasNaoOperacionais - totals.saidasNaoOperacionais, 2)}
                  </div>
                  {hasLastClose && (
                    <div
                      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${diffBadgeClass(
                        (totals.entradasNaoOperacionais - totals.saidasNaoOperacionais) -
                        (lastTotals.entradasNaoOperacionais - lastTotals.saidasNaoOperacionais),
                      )}`}
                    >
                      {formatMoneyString(
                        (totals.entradasNaoOperacionais - totals.saidasNaoOperacionais) -
                        (lastTotals.entradasNaoOperacionais - lastTotals.saidasNaoOperacionais),
                        2,
                      )}{" "}
                      vs {lastCloseLabel}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] uppercase tracking-wide text-slate-900">
                  Ponto de equilíbrio
                </CardTitle>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${badgeClasses(coberturaStatus.tone)}`}>
                  {coberturaStatus.label}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground text-right">{coberturaStatus.text}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Receita de caixa mínima para zerar lucro. Cobertura mostra o quanto a receita atual alcança do PE.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Valor</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatMoneyString(totals.pontoEquilibrio, 2)}
                  </div>
                  {hasLastClose && (
                    <div className={`text-[11px] font-semibold ${diffTone(totals.pontoEquilibrio - lastTotals.pontoEquilibrio)}`}>
                      {formatMoneyString(totals.pontoEquilibrio - lastTotals.pontoEquilibrio, 2)} vs {lastCloseLabel}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center space-y-1">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Cobertura</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                    {totals.receitaBruta > 0 ? ((totals.receitaBruta / (totals.pontoEquilibrio || 1)) * 100).toFixed(2) : "0.00"}%
                  </div>
                  {hasLastClose && (
                    <div
                      className={`text-[11px] font-semibold ${diffTone(
                        (totals.receitaBruta > 0 ? (totals.receitaBruta / (totals.pontoEquilibrio || 1)) * 100 : 0) -
                        (lastTotals.receitaBruta > 0 ? (lastTotals.receitaBruta / (lastTotals.pontoEquilibrio || 1)) * 100 : 0),
                      )}`}
                    >
                      {diffLabel(
                        (totals.receitaBruta > 0 ? (totals.receitaBruta / (totals.pontoEquilibrio || 1)) * 100 : 0) -
                        (lastTotals.receitaBruta > 0 ? (lastTotals.receitaBruta / (lastTotals.pontoEquilibrio || 1)) * 100 : 0),
                        "%",
                      )}{" "}
                      vs {lastCloseLabel}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] uppercase tracking-wide text-slate-900">
                % receita bruta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Percentuais de custos fixos e variáveis em relação à receita bruta.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Custos fixos</span>
                    <span className="text-lg font-bold text-slate-900 tabular-nums">{custoFixoPercBruta.toFixed(2)}%</span>
                  </div>
                  {hasLastClose && (
                    <div className="flex justify-start">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${diffBadgeClass(
                          custoFixoPercBruta - (lastTotals.receitaBruta > 0 ? (lastTotals.custoFixoTotal / lastTotals.receitaBruta) * 100 : 0),
                        )}`}
                      >
                        {diffLabel(
                          custoFixoPercBruta - (lastTotals.receitaBruta > 0 ? (lastTotals.custoFixoTotal / lastTotals.receitaBruta) * 100 : 0),
                          "%",
                        )}{" "}
                        vs {lastCloseLabel}
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Custos variáveis</span>
                    <span className="text-lg font-bold text-slate-900 tabular-nums">{custoVariavelPercBruta.toFixed(2)}%</span>
                  </div>
                  {hasLastClose && (
                    <div className="flex justify-start">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${diffBadgeClass(
                          custoVariavelPercBruta - (lastTotals.receitaBruta > 0 ? (lastTotals.custoVariavelTotal / lastTotals.receitaBruta) * 100 : 0),
                        )}`}
                      >
                        {diffLabel(
                          custoVariavelPercBruta - (lastTotals.receitaBruta > 0 ? (lastTotals.custoVariavelTotal / lastTotals.receitaBruta) * 100 : 0),
                          "%",
                        )}{" "}
                        vs {lastCloseLabel}
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-600">Lucro</span>
                    <span className={`text-lg font-bold tabular-nums ${totals.resultadoLiquidoPercBruta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {totals.resultadoLiquidoPercBruta.toFixed(2)}%
                    </span>
                  </div>
                  {hasLastClose && (
                    <div className="flex justify-start">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${diffBadgeClass(
                          totals.resultadoLiquidoPercBruta - lastTotals.resultadoLiquidoPercBruta,
                        )}`}
                      >
                        {diffLabel(totals.resultadoLiquidoPercBruta - lastTotals.resultadoLiquidoPercBruta, "%")} vs {lastCloseLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Anotações</CardTitle>
            <p className="text-xs text-muted-foreground">
              Guarde observações importantes sobre o fechamento (fatos não numéricos, eventos pontuais, etc.).
            </p>
          </CardHeader>
          <CardContent>
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: mês com campanha agressiva, atraso de fornecedor, troca de maquininha..."
              className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </CardContent>
        </Card>

        {formHidden ? (
          <div className="rounded-xl border bg-muted/30 p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{isLoadingData ? "Carregando dados salvos..." : "Atualizando período selecionado..."}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        ) : (
          <>

            <div className="grid grid-cols-1 lg:grid-cols-8 gap-4">
              <Card className="lg:col-span-3" >
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Receita Bruta</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total:</span>
                      <DecimalInput
                        name="receitaBrutaAmount"
                        defaultValue={receitaBruta}
                        fractionDigits={2}
                        className="w-48 font-mono text-lg font-semibold"
                        readOnly={true}
                      />
                    </div>
                  </div>

                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Receita extrato banco (R$)</Label>
                    <DecimalInput
                      name="receitaExtratoBancoAmount"
                      defaultValue={receitaExtratoBanco}
                      fractionDigits={2}
                      className="w-full"
                      onValueChange={setReceitaExtratoBanco}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Receita dinheiro (R$)</Label>
                    <DecimalInput
                      name="receitaDinheiroAmount"
                      defaultValue={receitaDinheiro}
                      fractionDigits={2}
                      className="w-full"
                      onValueChange={setReceitaDinheiro}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Separator />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Faturamento mensal (informativo)</Label>
                      <span className={`text-xs font-medium ${diferencaFaturamentoTone}`}>
                        Diferença vs receita bruta: {formatMoneyString(diferencaFaturamentoReceitaBruta, 2)}
                      </span>
                    </div>
                    <DecimalInput
                      name="faturamentoMensalAmount"
                      defaultValue={faturamentoMensal}
                      fractionDigits={2}
                      className="w-full"
                      onValueChange={setFaturamentoMensal}
                    />
                    <p className="text-xs text-muted-foreground">Registro manual do faturamento. Não entra nos cálculos.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-5">
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-sm font-semibold">Receita Liquida (calculo)</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Esses valores alimentam o cálculo da receita líquida e ficam salvos para histórico.
                      </p>
                    </div>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-3 items-center gap-x-4">
                      <div className="flex flex-col gap-2">
                        <Label>Taxa Cartão (%)</Label>
                        <DecimalInput
                          name="taxaCartaoPerc"
                          defaultValue={taxaCartaoPerc}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setTaxaCartaoPerc}
                        />


                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Taxa marketplace (%)</Label>
                        <DecimalInput
                          name="taxaMarketplacePerc"
                          defaultValue={taxaMarketplacePerc}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setTaxaMarketplacePerc}
                        />

                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Imposto sobre vendas (%)</Label>
                        <DecimalInput
                          key={`imposto-perc-${impostoPercPreview}`}
                          name="impostoPercPreview"
                          defaultValue={impostoPercPreview}
                          fractionDigits={2}
                          className="w-full bg-muted text-muted-foreground font-mono"
                          disabled
                          readOnly
                        />
                        <input type="hidden" name="impostoPerc" value={impostoPercPreview.toFixed(2)} />
                      </div>
                    </div>

                  </div>
                  <Separator className="my-2" />
                </CardHeader>

                <CardContent className="flex flex-col gap-6">

                  <div className="grid md:grid-cols-3 items-center gap-x-4">
                    <div className="flex flex-col gap-2">
                      <Label>Venda no cartão (R$)</Label>
                      <DecimalInput
                        name="vendaCartaoAmount"
                        defaultValue={vendaCartaoAmount}
                        fractionDigits={2}
                        className="w-full"
                        onValueChange={setVendaCartaoAmount}
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
                        defaultValue={vendaMarketplaceAmount}
                        fractionDigits={2}
                        className="w-full"
                        onValueChange={setVendaMarketplaceAmount}
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
                  <div className="grid md:grid-cols-3 items-center gap-x-4">

                    <div className="flex flex-col">
                      <Label>Imposto sobre vendas (R$)</Label>
                      <DecimalInput
                        key={`imposto-amount-${impostoAmountPreview}`}
                        name="impostoAmountPreview"
                        defaultValue={impostoAmountPreview}
                        fractionDigits={2}
                        className="w-full bg-muted text-muted-foreground font-mono"
                        disabled
                        readOnly
                      />
                    </div>

                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center gap-x-8">
                    <Label>Receita líquida (R$)</Label>
                    <DecimalInput
                      key={`receita-liquida-${receitaLiquidaPreview}`}
                      name="receitaLiquidaAmountPreview"
                      defaultValue={receitaLiquidaPreview}
                      fractionDigits={2}
                      className="w-full bg-white border-none font-bold text-lg font-mono"
                      disabled
                      readOnly
                    />
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
                        className="w-48 font-mono text-lg font-semibold"
                        onValueChange={setCustoVarTotalEdit}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Imposto sobre vendas (R$)</Label>
                    <DecimalInput
                      name="custoVariavelImpostosAmount"
                      defaultValue={custoVarImpostos}
                      fractionDigits={2}
                      className="w-full"
                      onValueChange={setCustoVarImpostos}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Insumos (R$)</Label>
                    <DecimalInput
                      name="custoVariavelInsumosAmount"
                      defaultValue={custoVarInsumos}
                      fractionDigits={2}
                      className="w-full"
                      onValueChange={setCustoVarInsumos}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Entrega (R$)</Label>
                    <DecimalInput
                      name="custoVariavelEntregaAmount"
                      defaultValue={custoVarEntrega}
                      fractionDigits={2}
                      className="w-full"
                      onValueChange={setCustoVarEntrega}
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
                        className="w-48 font-mono text-lg font-semibold"
                        onValueChange={setCustoFixoTotalEdit}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Despesas com pessoal</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(despesasPessoalTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Folha funcionários (R$)</Label>
                        <DecimalInput
                          name="custoFixoFolhaFuncionariosAmount"
                          defaultValue={custoFixoFolhaFuncionarios}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoFolhaFuncionarios}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Pró-labore (R$)</Label>
                        <DecimalInput
                          name="custoFixoProlaboreAmount"
                          defaultValue={custoFixoProlabore}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoProlabore}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Retirada de lucro / pró-labore (R$)</Label>
                        <DecimalInput
                          name="custoFixoRetiradaProlaboreAmount"
                          defaultValue={custoFixoRetiradaProlabore}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoRetiradaProlabore}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Retirada de lucro / resultado (R$)</Label>
                        <DecimalInput
                          name="custoFixoRetiradaResultadoAmount"
                          defaultValue={custoFixoRetiradaResultado}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoRetiradaResultado}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Plano de saúde (R$)</Label>
                        <DecimalInput
                          name="custoFixoPlanoSaudeAmount"
                          defaultValue={custoFixoPlanoSaude}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoPlanoSaude}
                        />
                      </div>
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Marketing</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(marketingTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Assessoria (R$)</Label>
                        <DecimalInput
                          name="custoFixoAssessoriaMarketingAmount"
                          defaultValue={custoFixoMarketing}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoMarketing}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Tráfego pago (R$)</Label>
                        <DecimalInput
                          name="custoFixoTrafegoPagoAmount"
                          defaultValue={custoFixoTrafegoPago}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoTrafegoPago}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Serviço da dívida</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(servicoDividaTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Parcela financiamento (R$)</Label>
                        <DecimalInput
                          name="custoFixoParcelaFinanciamentoAmount"
                          defaultValue={custoFixoFinanciamento}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoFinanciamento}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Fatura cartão crédito (R$)</Label>
                        <DecimalInput
                          name="custoFixoFaturaCartaoAmount"
                          defaultValue={custoFixoFaturaCartao}
                          fractionDigits={2}
                          className="w-full"
                          onValueChange={setCustoFixoFaturaCartao}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-2 md:max-w-md">
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Movimentos não operacionais</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Entradas/saídas fora da operação do mês. Elas ajustam diretamente o resultado líquido.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="flex flex-col gap-2">
                  <Label>Entradas não operacionais (R$)</Label>
                  <DecimalInput
                    name="entradasNaoOperacionaisAmount"
                    defaultValue={entradasNaoOperacionais}
                    fractionDigits={2}
                    className="w-full"
                    onValueChange={setEntradasNaoOperacionais}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Saídas não operacionais (R$)</Label>
                  <DecimalInput
                    name="saidasNaoOperacionaisAmount"
                    defaultValue={saidasNaoOperacionais}
                    fractionDigits={2}
                    className="w-full"
                    onValueChange={setSaidasNaoOperacionais}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Impacto no resultado (R$)</Label>
                  <DecimalInput
                    key={`impacto-nao-operacional-${resultadoNaoOperacionalPreview}`}
                    name="resultadoNaoOperacionalPreview"
                    defaultValue={resultadoNaoOperacionalPreview}
                    fractionDigits={2}
                    className="w-full bg-muted text-muted-foreground font-mono"
                    disabled
                    readOnly
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Entradas menos saídas; somado ao lucro/prejuízo operacional.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar fechamento"}
              </Button>
            </div>
          </>
        )}
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
                  {c.notes && (
                    <p className="col-span-2 text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">Anotações:</span> {c.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
