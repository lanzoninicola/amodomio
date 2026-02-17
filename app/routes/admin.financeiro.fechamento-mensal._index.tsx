// app/routes/admin.financeiro.fechamento-mensal.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { Loader2, TrendingUp, TrendingDown, Minus, Edit, ChevronDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

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
  return <div className="text-xs font-medium text-slate-600">{children}</div>;
}

function FieldNote({ children }: { children?: React.ReactNode }) {
  return <p className="min-h-[16px] text-xs text-muted-foreground truncate">{children ?? "\u00A0"}</p>;
}

function FieldContainer({
  label,
  note,
  children,
  className = "flex flex-col gap-2",
}: {
  label: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      <FieldNote>{note}</FieldNote>
    </div>
  );
}

function EditableField({
  label,
  name,
  value,
  onValueChange,
  fractionDigits = 2,
  note,
  disabled = false,
  readOnly = false,
  className = "w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono",
  keyValue,
}: {
  label: string;
  name: string;
  value: number;
  onValueChange?: (value: number) => void;
  fractionDigits?: number;
  note?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  keyValue?: string;
}) {
  return (
    <FieldContainer label={label} note={note}>
      <DecimalInput
        key={keyValue}
        name={name}
        defaultValue={value}
        fractionDigits={fractionDigits}
        className={className}
        onValueChange={onValueChange}
        disabled={disabled}
        readOnly={readOnly}
      />
    </FieldContainer>
  );
}

function ReadonlyField({
  label,
  value,
  fractionDigits = 2,
  muted = true,
  note,
}: {
  label: string;
  value: number;
  fractionDigits?: number;
  muted?: boolean;
  note?: string;
}) {
  const comparisonFieldClass =
    "w-full border border-slate-100 bg-slate-50 text-slate-600 font-mono text-base cursor-not-allowed shadow-none";
  return (
    <FieldContainer label={label} note={note}>
      <DecimalInput
        defaultValue={value}
        fractionDigits={fractionDigits}
        className={muted ? comparisonFieldClass : `${comparisonFieldClass} bg-background/60`}
        disabled
        readOnly
      />
    </FieldContainer>
  );
}

function DeltaField({
  label,
  value,
  fractionDigits = 2,
  percent = false,
  note,
}: {
  label: string;
  value: number;
  fractionDigits?: number;
  percent?: boolean;
  note?: string;
}) {
  const deltaTextTone =
    value > 0 ? "text-emerald-700/90" : value < 0 ? "text-red-700/90" : "text-slate-500";
  return (
    <FieldContainer label={label} note={note}>
      {percent ? (
        <div
          className={`h-10 rounded-md border border-muted bg-muted/40 px-3 flex items-center justify-end font-mono text-base ${deltaTextTone}`}
        >
          {value > 0 ? "+" : ""}{value.toFixed(2)}%
        </div>
      ) : (
        <DecimalInput
          defaultValue={value}
          fractionDigits={fractionDigits}
          className={`w-full bg-muted/40 border-muted font-mono text-base shadow-none ${deltaTextTone}`}
          disabled
          readOnly
        />
      )}
    </FieldContainer>
  );
}

type StatusTone = "good" | "warn" | "bad";

function badgeClasses(tone: StatusTone) {
  if (tone === "good") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (tone === "warn") return "bg-slate-100 text-slate-700 border border-slate-200";
  return "bg-red-100 text-red-800 border border-red-200";
}

function badgeIcon(tone: StatusTone) {
  if (tone === "good") return <TrendingUp className="h-3 w-3" />;
  if (tone === "warn") return <Minus className="h-3 w-3" />;
  return <TrendingDown className="h-3 w-3" />;
}

function KPICard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral"
}) {
  const toneClass = {
    positive: "text-emerald-700",
    negative: "text-red-700",
    neutral: "text-slate-900"
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</p>
      <p className={`font-mono text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function CurrentMonthBlock({
  title,
  isOpen,
  onToggle,
  summary,
  tone = "blue",
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  summary?: React.ReactNode;
  tone?: "blue" | "slate";
  children: React.ReactNode;
}) {
  const isBlueTone = tone === "blue";

  return (
    <section className={`rounded-lg border p-2 ${isBlueTone ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-slate-100/50"}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left ${isBlueTone ? "hover:bg-blue-100/60" : "hover:bg-slate-200/60"}`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          {summary ? (
            <span className={`text-xs font-mono ${isOpen ? "text-slate-500" : "text-slate-800 font-semibold"}`}>
              {summary}
            </span>
          ) : null}
          <ChevronDown className={`h-4 w-4 text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>
      {isOpen ? <div className="pt-2">{children}</div> : null}
    </section>
  );
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
  const lastReceitaBase = React.useMemo(() => {
    const extrato = (lastClose as any)?.receitaExtratoBancoAmount ?? 0;
    const dinheiro = (lastClose as any)?.receitaDinheiroAmount ?? 0;
    const receitaBrutaAmount = lastClose?.receitaBrutaAmount ?? 0;
    const hasSplit = (extrato ?? 0) + (dinheiro ?? 0) > 0;
    return {
      extrato: hasSplit ? extrato : receitaBrutaAmount,
      dinheiro: hasSplit ? dinheiro : 0,
      bruta: receitaBrutaAmount,
    };
  }, [lastClose]);

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
  const [currentBlocksOpen, setCurrentBlocksOpen] = React.useState({
    indicadores: true,
    receitas: true,
    custos: true,
    movimentos: true,
  });

  const toggleCurrentBlock = React.useCallback((block: keyof typeof currentBlocksOpen) => {
    setCurrentBlocksOpen((prev) => ({ ...prev, [block]: !prev[block] }));
  }, []);

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
  const pontoEquilibrioDenominatorPreview = receitaBruta > 0
    ? 1 - (custoVariavelTotalPreview / receitaBruta)
    : 0;
  const coberturaPreview = totals.pontoEquilibrio > 0 ? (totals.receitaBruta / totals.pontoEquilibrio) * 100 : 0;
  const margemContribFormulaText = "Fórmula: Margem de contribuição = receita bruta - custos variáveis.";
  const margemContribAppliedText = `Aplicação: ${formatMoneyString(receitaBruta, 2)} - ${formatMoneyString(custoVariavelTotalPreview, 2)} = ${formatMoneyString(margemContribPreview, 2)}.`;
  const resultadoLiquidoFormulaText = "Fórmula: Resultado líquido = margem de contribuição - custos fixos + ajuste não operacional.";
  const resultadoLiquidoAppliedText = `Aplicação: ${formatMoneyString(margemContribPreview, 2)} - ${formatMoneyString(custoFixoTotalPreview, 2)} + ${formatMoneyString(resultadoNaoOperacionalPreview, 2)} = ${formatMoneyString(resultadoLiquidoPreview, 2)}.`;
  const pontoEquilibrioFormulaText = receitaBruta > 0 && pontoEquilibrioDenominatorPreview !== 0
    ? "Fórmula: Ponto de equilíbrio = custos fixos / (1 - margem de contribuição percentual)."
    : "Fórmula: Ponto de equilíbrio = custos fixos / (1 - margem de contribuição percentual).";
  const pontoEquilibrioAppliedText = receitaBruta > 0 && pontoEquilibrioDenominatorPreview !== 0
    ? `Aplicação: ${formatMoneyString(custoFixoTotalPreview, 2)} ÷ (1 - (${formatMoneyString(custoVariavelTotalPreview, 2)} ÷ ${formatMoneyString(receitaBruta, 2)})) = ${formatMoneyString(totals.pontoEquilibrio, 2)}.`
    : "Aplicação: informe receita bruta e custos variáveis para calcular o ponto de equilíbrio.";
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
  const lastCustoFixoPercBruta = lastTotals.receitaBruta > 0 ? (lastTotals.custoFixoTotal / lastTotals.receitaBruta) * 100 : 0;
  const lastCustoVariavelPercBruta = lastTotals.receitaBruta > 0 ? (lastTotals.custoVariavelTotal / lastTotals.receitaBruta) * 100 : 0;
  const lastCoberturaPerc = lastTotals.pontoEquilibrio > 0 ? (lastTotals.receitaBruta / lastTotals.pontoEquilibrio) * 100 : 0;
  const lastMargemStatus = ratePercent(lastTotals.margemContribPerc, "margem");
  const lastResultadoStatus = ratePercent(lastTotals.resultadoLiquidoPercBruta, "resultado");
  const lastCoberturaStatus = rateCobertura(lastCoberturaPerc);
  const hasLastClose = Boolean(lastClose);
  const lastFaturamentoMensal = (lastClose as any)?.faturamentoMensalAmount ?? 0;
  const lastTaxaCartaoPerc = lastClose?.taxaCartaoPerc ?? 0;
  const lastTaxaMarketplacePerc = lastClose?.taxaMarketplacePerc ?? 0;
  const lastVendaCartaoAmount = lastClose?.vendaCartaoAmount ?? 0;
  const lastVendaMarketplaceAmount = lastClose?.vendaMarketplaceAmount ?? 0;
  const lastTaxaCartaoAmountPreview = lastVendaCartaoAmount > 0 ? (lastVendaCartaoAmount * lastTaxaCartaoPerc) / 100 : 0;
  const lastTaxaMarketplaceAmountPreview = lastVendaMarketplaceAmount > 0 ? (lastVendaMarketplaceAmount * lastTaxaMarketplacePerc) / 100 : 0;
  const lastImpostoAmountPreview = (lastClose as any)?.custoVariavelImpostosAmount ?? lastClose?.impostoAmount ?? 0;
  const lastImpostoPercPreview = lastTotals.receitaBruta > 0
    ? Number(((lastImpostoAmountPreview / lastTotals.receitaBruta) * 100).toFixed(2))
    : 0;
  const lastCustoVariavelOutrosPreview = (lastClose?.custoVariavelTotalAmount ?? 0) -
    ((lastClose?.custoVariavelInsumosAmount ?? 0) +
      (lastClose?.custoVariavelEntregaAmount ?? 0) +
      (lastClose?.custoVariavelImpostosAmount ?? 0));
  const lastCustoFixoOutrosPreview = (lastClose?.custoFixoTotalAmount ?? 0) -
    ((lastClose?.custoFixoPlanoSaudeAmount ?? lastClose?.custoFixoFolhaAmount ?? 0) +
      (lastClose?.custoFixoFolhaFuncionariosAmount ?? 0) +
      (lastClose?.custoFixoProlaboreAmount ?? 0) +
      (lastClose?.custoFixoRetiradaProlaboreAmount ?? 0) +
      (lastClose?.custoFixoRetiradaResultadoAmount ?? 0) +
      (lastClose?.custoFixoParcelaFinanciamentoAmount ?? 0) +
      (lastClose?.custoFixoAssessoriaMarketingAmount ?? 0) +
      (lastClose?.custoFixoTrafegoPagoAmount ?? lastClose?.custoVariavelMarketingAmount ?? 0) +
      (lastClose?.custoFixoFaturaCartaoAmount ?? 0));
  const lastCustoFixoPlanoSaude = lastClose?.custoFixoPlanoSaudeAmount ?? lastClose?.custoFixoFolhaAmount ?? 0;
  const lastCustoFixoTrafegoPago = lastClose?.custoFixoTrafegoPagoAmount ?? lastClose?.custoVariavelMarketingAmount ?? 0;
  const lastCustoFixoFolhaFuncionarios = lastClose?.custoFixoFolhaFuncionariosAmount ?? 0;
  const lastCustoFixoProlabore = lastClose?.custoFixoProlaboreAmount ?? 0;
  const lastCustoFixoRetiradaProlabore = lastClose?.custoFixoRetiradaProlaboreAmount ?? 0;
  const lastCustoFixoRetiradaResultado = lastClose?.custoFixoRetiradaResultadoAmount ?? 0;
  const lastCustoFixoFinanciamento = lastClose?.custoFixoParcelaFinanciamentoAmount ?? 0;
  const lastCustoFixoMarketing = lastClose?.custoFixoAssessoriaMarketingAmount ?? 0;
  const lastCustoFixoFaturaCartao = lastClose?.custoFixoFaturaCartaoAmount ?? 0;
  const lastCustoVarInsumos = lastClose?.custoVariavelInsumosAmount ?? 0;
  const lastCustoVarEntrega = lastClose?.custoVariavelEntregaAmount ?? 0;
  const lastCustoVarImpostos = lastClose?.custoVariavelImpostosAmount ?? 0;
  const lastEntradasNaoOperacionais = (lastClose as any)?.entradasNaoOperacionaisAmount ?? 0;
  const lastSaidasNaoOperacionais = (lastClose as any)?.saidasNaoOperacionaisAmount ?? 0;
  const lastResultadoNaoOperacional = lastEntradasNaoOperacionais - lastSaidasNaoOperacionais;
  const lastDespesasPessoalTotal = lastCustoFixoPlanoSaude + lastCustoFixoFolhaFuncionarios + lastCustoFixoProlabore + lastCustoFixoRetiradaProlabore + lastCustoFixoRetiradaResultado;
  const lastMarketingTotal = lastCustoFixoMarketing + lastCustoFixoTrafegoPago;
  const lastServicoDividaTotal = lastCustoFixoFinanciamento + lastCustoFixoFaturaCartao;
  const delta = (current: number, previous: number) => current - previous;
  const diffTone = (value: number) => (value > 0 ? "text-emerald-700" : value < 0 ? "text-red-700" : "text-slate-500");
  const diffLabel = (value: number, suffix = "") => `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
  const rateDelta = (value: number) => {
    if (value > 0) return { label: "Alta", tone: "good" as StatusTone };
    if (value < 0) return { label: "Queda", tone: "bad" as StatusTone };
    return { label: "Estável", tone: "warn" as StatusTone };
  };
  const renderFieldDiff = (
    _previousValue: number,
    _currentValue: number,
    opts?: { asPercent?: boolean; note?: string },
  ) => <FieldNote>{opts?.note}</FieldNote>;
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
  const summaryHeaderGridClass =
    "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(210px,260px)] sm:items-start sm:gap-x-4";
  const summaryMetricsColumnClass = "space-y-2 text-right sm:justify-self-end sm:w-full";
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
        {formHidden && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-foreground/70" />
          </div>
        )}

        <div className="z-30 rounded-2xl border bg-card/70 shadow-sm backdrop-blur p-4 md:p-6 space-y-4">
          <div className="rounded-xl border bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">FECHAMENTO MENSAL</p>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-semibold">{currentPeriodLabel}</span>
                  <span className="rounded-full bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
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

        {/* Top Summary Bar - KPIs Principais */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-slate-200 shadow-sm -mx-4 px-4 py-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              label="Receita Líquida"
              value={formatMoneyString(receitaLiquidaPreview, 2)}
              tone="neutral"
            />
            <KPICard
              label="Resultado Líquido"
              value={formatMoneyString(resultadoLiquidoPreview, 2)}
              tone={resultadoLiquidoPreview >= 0 ? "positive" : "negative"}
            />
            <KPICard
              label="Margem Contribuição"
              value={`${totals.margemContribPerc.toFixed(2)}%`}
              tone={totals.margemContribPerc >= 35 ? "positive" : totals.margemContribPerc >= 20 ? "neutral" : "negative"}
            />
            <KPICard
              label="Ponto Equilíbrio"
              value={formatMoneyString(totals.pontoEquilibrio, 2)}
              tone="neutral"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div className="space-y-4 xl:col-span-4 rounded-lg bg-slate-50 p-3">
            <div className="sticky top-20 z-20 bg-slate-50/95 backdrop-blur-sm shadow-sm rounded-xl border border-slate-200 px-4 py-3 -mx-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">1. Mês anterior</p>
              <p className="text-sm font-semibold">{hasLastClose ? `${lastCloseLabel}` : "Sem referência anterior"}</p>
              <p className="text-xs text-slate-500">Somente leitura para comparação.</p>
            </div>

            <CurrentMonthBlock
              title="Indicadores principais"
              isOpen={currentBlocksOpen.indicadores}
              onToggle={() => toggleCurrentBlock("indicadores")}
              summary={formatMoneyString(hasLastClose ? lastTotals.resultadoLiquido : 0, 2)}
              tone="slate"
            >
            <div className="grid grid-cols-1 gap-3">
              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                      % receita bruta
                    </CardTitle>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Custos fixos</p>
                        <p className="font-mono text-lg font-bold text-slate-900">{hasLastClose ? lastCustoFixoPercBruta.toFixed(2) : "0.00"}%</p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Custos variáveis</p>
                        <p className="font-mono text-lg font-bold text-slate-900">{hasLastClose ? lastCustoVariavelPercBruta.toFixed(2) : "0.00"}%</p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Lucro</p>
                        <p className={`font-mono text-lg font-bold ${lastTotals.resultadoLiquidoPercBruta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {hasLastClose ? lastTotals.resultadoLiquidoPercBruta.toFixed(2) : "0.00"}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Percentuais de custos fixos e variáveis em relação à receita bruta.
                  </p>
                </CardHeader>
              </Card>

              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                        Margem de contribuição
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(lastMargemStatus.tone)}`}>
                        {badgeIcon(lastMargemStatus.tone)}
                        {lastMargemStatus.label}
                      </span>
                    </div>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                        <p className="font-mono text-lg font-bold text-slate-900">{formatMoneyString(hasLastClose ? lastTotals.margemContrib : 0, 2)}</p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">% Receita de caixa</p>
                        <p className="font-mono text-lg font-bold text-slate-900">{hasLastClose ? lastTotals.margemContribPerc.toFixed(2) : "0.00"}%</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receita de caixa menos custos variáveis. É o que sobra para pagar os fixos.
                  </p>
                </CardHeader>
              </Card>

              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                        Resultado líquido
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(lastResultadoStatus.tone)}`}>
                        {badgeIcon(lastResultadoStatus.tone)}
                        {lastResultadoStatus.label}
                      </span>
                    </div>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                        <p className={`font-mono text-lg font-bold ${lastTotals.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {formatMoneyString(hasLastClose ? lastTotals.resultadoLiquido : 0, 2)}
                        </p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Ajuste não operacional</p>
                        <p className="font-mono text-lg font-bold text-slate-900">
                          {formatMoneyString(hasLastClose ? lastTotals.entradasNaoOperacionais - lastTotals.saidasNaoOperacionais : 0, 2)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Margem de contribuição menos custos fixos. Lucro/prejuízo do mês.
                  </p>
                </CardHeader>
              </Card>

              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                        Ponto de equilíbrio
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(lastCoberturaStatus.tone)}`}>
                        {badgeIcon(lastCoberturaStatus.tone)}
                        {lastCoberturaStatus.label}
                      </span>
                    </div>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                        <p className="font-mono text-lg font-bold text-slate-900">{formatMoneyString(hasLastClose ? lastTotals.pontoEquilibrio : 0, 2)}</p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cobertura</p>
                        <p className="font-mono text-lg font-bold text-slate-900">{hasLastClose ? lastCoberturaPerc.toFixed(2) : "0.00"}%</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receita bruta mínima para zerar lucro. Cobertura mostra o quanto a receita atual alcança do PE.
                  </p>
                </CardHeader>
              </Card>
            </div>
            </CurrentMonthBlock>

            <CurrentMonthBlock
              title="Receitas"
              isOpen={currentBlocksOpen.receitas}
              onToggle={() => toggleCurrentBlock("receitas")}
              summary={`${formatMoneyString(lastTotals.receitaBruta, 2)} (${formatMoneyString(lastTotals.receitaLiquida, 2)})`}
              tone="slate"
            >
            <Card>
              <CardHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Receita Bruta</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Total:</span>
                    <DecimalInput
                      defaultValue={lastTotals.receitaBruta}
                      fractionDigits={2}
                      className="w-48 font-mono text-lg font-semibold bg-muted text-muted-foreground"
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4">
                <ReadonlyField label="Receita extrato banco (R$)" value={lastReceitaBase.extrato} muted={false} />
                <ReadonlyField label="Receita dinheiro (R$)" value={lastReceitaBase.dinheiro} muted={false} />
                <Separator className="my-1" />
                <ReadonlyField label="Faturamento mensal (informativo)" value={lastFaturamentoMensal} muted={false} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-1">
                <div>
                  <CardTitle className="text-sm font-semibold">Receita Liquida (calculo)</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Esses valores alimentam o cálculo da receita líquida e ficam salvos para histórico.
                  </p>
                </div>
                <Separator className="my-1" />
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <ReadonlyField label="Taxa Cartão (%)" value={lastTaxaCartaoPerc} muted={false} />
                  <ReadonlyField label="Taxa marketplace (%)" value={lastTaxaMarketplacePerc} muted={false} />
                  <ReadonlyField label="Imposto sobre vendas (%)" value={lastImpostoPercPreview} />
                </div>
                <Separator className="my-1" />
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <ReadonlyField label="Venda no cartão (R$)" value={lastVendaCartaoAmount} muted={false} />
                  <ReadonlyField label="Taxa Cartão (R$)" value={lastTaxaCartaoAmountPreview} />
                </div>
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <ReadonlyField label="Venda marketplace (R$)" value={lastVendaMarketplaceAmount} muted={false} />
                  <ReadonlyField label="Taxa marketplace (R$)" value={lastTaxaMarketplaceAmountPreview} />
                </div>
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <ReadonlyField label="Imposto sobre vendas (R$)" value={lastImpostoAmountPreview} />
                </div>
                <Separator className="my-1" />
                <ReadonlyField label="Receita líquida (R$)" value={lastTotals.receitaLiquida} muted={false} />
              </CardContent>
            </Card>
            </CurrentMonthBlock>

            <CurrentMonthBlock
              title="Custos"
              isOpen={currentBlocksOpen.custos}
              onToggle={() => toggleCurrentBlock("custos")}
              summary={formatMoneyString(lastTotals.custoFixoTotal + lastTotals.custoVariavelTotal, 2)}
              tone="slate"
            >
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Custos variáveis (principais)</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total:</span>
                      <DecimalInput
                        defaultValue={lastTotals.custoVariavelTotal}
                        fractionDigits={2}
                        className="w-48 font-mono text-lg font-semibold bg-muted text-muted-foreground"
                        disabled
                        readOnly
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4">
                  <ReadonlyField label="Imposto sobre vendas (R$)" value={lastCustoVarImpostos} muted={false} />
                  <ReadonlyField label="Insumos (R$)" value={lastCustoVarInsumos} muted={false} />
                  <ReadonlyField label="Entrega (R$)" value={lastCustoVarEntrega} muted={false} />
                  <Separator className="my-1" />
                  <ReadonlyField label="Outros variáveis (R$)" value={lastCustoVariavelOutrosPreview} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Custos fixos (principais)</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total:</span>
                      <DecimalInput
                        defaultValue={lastTotals.custoFixoTotal}
                        fractionDigits={2}
                        className="w-48 font-mono text-lg font-semibold bg-muted text-muted-foreground"
                        disabled
                        readOnly
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Despesas com pessoal</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(lastDespesasPessoalTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <ReadonlyField label="Folha funcionários (R$)" value={lastCustoFixoFolhaFuncionarios} muted={false} />
                      <ReadonlyField label="Pró-labore (R$)" value={lastCustoFixoProlabore} muted={false} />
                      <ReadonlyField label="Retirada de lucro / pró-labore (R$)" value={lastCustoFixoRetiradaProlabore} muted={false} />
                      <ReadonlyField label="Retirada de lucro / resultado (R$)" value={lastCustoFixoRetiradaResultado} muted={false} />
                      <ReadonlyField label="Plano de saúde (R$)" value={lastCustoFixoPlanoSaude} muted={false} />
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Marketing</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(lastMarketingTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <ReadonlyField label="Assessoria (R$)" value={lastCustoFixoMarketing} muted={false} />
                      <ReadonlyField label="Tráfego pago (R$)" value={lastCustoFixoTrafegoPago} muted={false} />
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Serviço da dívida</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(lastServicoDividaTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <ReadonlyField label="Parcela financiamento (R$)" value={lastCustoFixoFinanciamento} muted={false} />
                      <ReadonlyField label="Fatura cartão crédito (R$)" value={lastCustoFixoFaturaCartao} muted={false} />
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <ReadonlyField label="Outros fixos (R$)" value={lastCustoFixoOutrosPreview} />
                </CardContent>
              </Card>
            </div>
            </CurrentMonthBlock>

            <CurrentMonthBlock
              title="Movimentos não operacionais"
              isOpen={currentBlocksOpen.movimentos}
              onToggle={() => toggleCurrentBlock("movimentos")}
              summary={formatMoneyString(lastResultadoNaoOperacional, 2)}
              tone="slate"
            >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Movimentos não operacionais</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Entradas/saídas fora da operação do mês. Elas ajustam diretamente o resultado líquido.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 items-end">
                <ReadonlyField label="Entradas não operacionais (R$)" value={lastEntradasNaoOperacionais} muted={false} />
                <ReadonlyField label="Saídas não operacionais (R$)" value={lastSaidasNaoOperacionais} muted={false} />
                <ReadonlyField label="Impacto no resultado (R$)" value={lastResultadoNaoOperacional} />
              </CardContent>
            </Card>
            </CurrentMonthBlock>
          </div>

          <div className="space-y-4 xl:col-span-4 rounded-lg border-2 border-blue-200 bg-white p-3 shadow-md ring-1 ring-blue-100">
            <div className="sticky top-20 z-20 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl border border-blue-200 px-4 py-3 -mx-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-600">2. Mês corrente</p>
                    <p className="text-sm font-semibold">{currentPeriodLabel}</p>
                    <p className="text-xs text-blue-700 font-medium">Foco de edição</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Resultado líquido atual</p>
                  <p className={`font-mono text-base font-semibold ${resultadoLiquidoPreview >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {formatMoneyString(resultadoLiquidoPreview, 2)}
                  </p>
                </div>
              </div>
            </div>

        <CurrentMonthBlock
          title="Indicadores principais"
          isOpen={currentBlocksOpen.indicadores}
          onToggle={() => toggleCurrentBlock("indicadores")}
          summary={formatMoneyString(resultadoLiquidoPreview, 2)}
        >
        <div className="grid grid-cols-1 gap-3">
          <Card className="rounded-lg border border-blue-100 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <div className={summaryHeaderGridClass}>
                <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                  % receita bruta
                </CardTitle>
                <div className={summaryMetricsColumnClass}>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Custos fixos</p>
                    <p className="font-mono text-lg font-bold text-slate-900">{custoFixoPercBruta.toFixed(2)}%</p>
                  </div>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Custos variáveis</p>
                    <p className="font-mono text-lg font-bold text-slate-900">{custoVariavelPercBruta.toFixed(2)}%</p>
                  </div>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Lucro</p>
                    <p className={`font-mono text-lg font-bold ${totals.resultadoLiquidoPercBruta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {totals.resultadoLiquidoPercBruta.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentuais de custos fixos e variáveis em relação à receita bruta.
              </p>
            </CardHeader>
          </Card>

          <Card className="rounded-lg border border-blue-100 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <div className={summaryHeaderGridClass}>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                    Margem de contribuição
                  </CardTitle>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(margemStatus.tone)}`}>
                    {badgeIcon(margemStatus.tone)}
                    {margemStatus.label}
                  </span>
                </div>
                <div className={summaryMetricsColumnClass}>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                    <p className="font-mono text-lg font-bold text-slate-900">{formatMoneyString(totals.margemContrib, 2)}</p>
                  </div>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">% Receita de caixa</p>
                    <p className="font-mono text-lg font-bold text-slate-900">{totals.margemContribPerc.toFixed(2)}%</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Receita de caixa menos custos variáveis. É o que sobra para pagar os fixos.
              </p>
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                {margemContribFormulaText}
              </p>
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                {margemContribAppliedText}
              </p>
            </CardHeader>
          </Card>

          <Card className="rounded-lg border border-blue-100 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <div className={summaryHeaderGridClass}>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                    Resultado líquido
                  </CardTitle>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(resultadoStatus.tone)}`}>
                    {badgeIcon(resultadoStatus.tone)}
                    {resultadoStatus.label}
                  </span>
                </div>
                <div className={summaryMetricsColumnClass}>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                    <p className={`font-mono text-lg font-bold ${totals.resultadoLiquido >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {formatMoneyString(totals.resultadoLiquido, 2)}
                    </p>
                  </div>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Ajuste não operacional</p>
                    <p className="font-mono text-lg font-bold text-slate-900">
                      {formatMoneyString(totals.entradasNaoOperacionais - totals.saidasNaoOperacionais, 2)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Margem de contribuição menos custos fixos. Lucro/prejuízo do mês.
              </p>
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                {resultadoLiquidoFormulaText}
              </p>
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                {resultadoLiquidoAppliedText}
              </p>
            </CardHeader>
          </Card>

          <Card className="rounded-lg border border-blue-100 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <div className={summaryHeaderGridClass}>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                    Ponto de equilíbrio
                  </CardTitle>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(coberturaStatus.tone)}`}>
                    {badgeIcon(coberturaStatus.tone)}
                    {coberturaStatus.label}
                  </span>
                </div>
                <div className={summaryMetricsColumnClass}>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                    <p className="font-mono text-lg font-bold text-slate-900">{formatMoneyString(totals.pontoEquilibrio, 2)}</p>
                  </div>
                  <div className="w-full">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Cobertura</p>
                    <p className="font-mono text-lg font-bold text-slate-900">
                      {totals.receitaBruta > 0 ? ((totals.receitaBruta / (totals.pontoEquilibrio || 1)) * 100).toFixed(2) : "0.00"}%
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Receita bruta mínima para zerar lucro. Cobertura mostra o quanto a receita atual alcança do PE.
              </p>
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                {pontoEquilibrioFormulaText}
              </p>
              <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                {pontoEquilibrioAppliedText}
              </p>
            </CardHeader>
          </Card>
        </div>
        </CurrentMonthBlock>

        <>
            <CurrentMonthBlock
              title="Receitas"
              isOpen={currentBlocksOpen.receitas}
              onToggle={() => toggleCurrentBlock("receitas")}
              summary={`${formatMoneyString(receitaBruta, 2)} (${formatMoneyString(receitaLiquidaPreview, 2)})`}
            >
            <div className="grid grid-cols-1 gap-4">
              <Card>
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
                <CardContent className="grid grid-cols-1 gap-4">
                  <EditableField
                    label="Receita extrato banco (R$)"
                    name="receitaExtratoBancoAmount"
                    value={receitaExtratoBanco}
                    onValueChange={setReceitaExtratoBanco}
                  />
                  <EditableField
                    label="Receita dinheiro (R$)"
                    name="receitaDinheiroAmount"
                    value={receitaDinheiro}
                    onValueChange={setReceitaDinheiro}
                  />
                  <div>
                    <Separator className="my-1" />
                  </div>
                  <div className="flex flex-col gap-2">
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
                      className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                      onValueChange={setFaturamentoMensal}
                    />
                    <FieldNote>Registro manual do faturamento. Não entra nos cálculos.</FieldNote>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-1">
                  <div>
                    <CardTitle className="text-sm font-semibold">Receita Liquida (calculo)</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Esses valores alimentam o cálculo da receita líquida e ficam salvos para histórico.
                    </p>
                  </div>
                  <Separator className="my-1" />
                </CardHeader>

                <CardContent className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                      <EditableField
                        label="Taxa Cartão (%)"
                        name="taxaCartaoPerc"
                        value={taxaCartaoPerc}
                        onValueChange={setTaxaCartaoPerc}
                      />
                      <EditableField
                        label="Taxa marketplace (%)"
                        name="taxaMarketplacePerc"
                        value={taxaMarketplacePerc}
                        onValueChange={setTaxaMarketplacePerc}
                      />
                      <EditableField
                        label="Imposto sobre vendas (%)"
                        name="impostoPercPreview"
                        value={impostoPercPreview}
                        disabled
                        readOnly
                        className="w-full bg-muted text-muted-foreground font-mono"
                        keyValue={`imposto-perc-${impostoPercPreview}`}
                      />
                      <input type="hidden" name="impostoPerc" value={impostoPercPreview.toFixed(2)} />
                    </div>

                  <Separator className="my-1" />

                  <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                    <EditableField
                      label="Venda no cartão (R$)"
                      name="vendaCartaoAmount"
                      value={vendaCartaoAmount}
                      onValueChange={setVendaCartaoAmount}
                    />
                    <EditableField
                      label="Taxa Cartão (R$)"
                      name="taxaCartaoAmountPreview"
                      value={taxaCartaoAmountPreview}
                      disabled
                      readOnly
                      className="w-full bg-muted text-muted-foreground font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                    <EditableField
                      label="Venda marketplace (R$)"
                      name="vendaMarketplaceAmount"
                      value={vendaMarketplaceAmount}
                      onValueChange={setVendaMarketplaceAmount}
                    />
                    <EditableField
                      label="Taxa marketplace (R$)"
                      name="taxaMarketplaceAmountPreview"
                      value={taxaMarketplaceAmountPreview}
                      disabled
                      readOnly
                      className="w-full bg-muted text-muted-foreground font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                    <EditableField
                      label="Imposto sobre vendas (R$)"
                      name="impostoAmountPreview"
                      value={impostoAmountPreview}
                      disabled
                      readOnly
                      className="w-full bg-muted text-muted-foreground font-mono"
                      keyValue={`imposto-amount-${impostoAmountPreview}`}
                    />

                  </div>

                  <Separator className="my-1" />

                  <div className="flex flex-col gap-2">
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
                    {renderFieldDiff(lastTotals.receitaLiquida, receitaLiquidaPreview)}
                  </div>
                </CardContent>
              </Card>


            </div>
            </CurrentMonthBlock>



            <Separator className="my-1" />

            <CurrentMonthBlock
              title="Custos"
              isOpen={currentBlocksOpen.custos}
              onToggle={() => toggleCurrentBlock("custos")}
              summary={formatMoneyString(custoFixoTotalPreview + custoVariavelTotalPreview, 2)}
            >
            {/* Custos variáveis logo após receita */}
            <div className="grid grid-cols-1 gap-4">
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
                <CardContent className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Imposto sobre vendas (R$)</Label>
                    <DecimalInput
                      name="custoVariavelImpostosAmount"
                      defaultValue={custoVarImpostos}
                      fractionDigits={2}
                      className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                      onValueChange={setCustoVarImpostos}
                    />
                    {renderFieldDiff(lastClose?.custoVariavelImpostosAmount ?? 0, custoVarImpostos)}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Insumos (R$)</Label>
                    <DecimalInput
                      name="custoVariavelInsumosAmount"
                      defaultValue={custoVarInsumos}
                      fractionDigits={2}
                      className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                      onValueChange={setCustoVarInsumos}
                    />
                    {renderFieldDiff(lastClose?.custoVariavelInsumosAmount ?? 0, custoVarInsumos)}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Entrega (R$)</Label>
                    <DecimalInput
                      name="custoVariavelEntregaAmount"
                      defaultValue={custoVarEntrega}
                      fractionDigits={2}
                      className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                      onValueChange={setCustoVarEntrega}
                    />
                    {renderFieldDiff(lastClose?.custoVariavelEntregaAmount ?? 0, custoVarEntrega)}
                  </div>
                  <div>
                    <Separator className="my-1" />
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
                    {renderFieldDiff(lastCustoVariavelOutrosPreview, custoVariavelOutrosPreview)}
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
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Folha funcionários (R$)</Label>
                        <DecimalInput
                          name="custoFixoFolhaFuncionariosAmount"
                          defaultValue={custoFixoFolhaFuncionarios}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoFolhaFuncionarios}
                        />
                        {renderFieldDiff(lastClose?.custoFixoFolhaFuncionariosAmount ?? 0, custoFixoFolhaFuncionarios)}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Pró-labore (R$)</Label>
                        <DecimalInput
                          name="custoFixoProlaboreAmount"
                          defaultValue={custoFixoProlabore}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoProlabore}
                        />
                        {renderFieldDiff(lastClose?.custoFixoProlaboreAmount ?? 0, custoFixoProlabore)}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Retirada de lucro / pró-labore (R$)</Label>
                        <DecimalInput
                          name="custoFixoRetiradaProlaboreAmount"
                          defaultValue={custoFixoRetiradaProlabore}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoRetiradaProlabore}
                        />
                        {renderFieldDiff(lastClose?.custoFixoRetiradaProlaboreAmount ?? 0, custoFixoRetiradaProlabore)}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Retirada de lucro / resultado (R$)</Label>
                        <DecimalInput
                          name="custoFixoRetiradaResultadoAmount"
                          defaultValue={custoFixoRetiradaResultado}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoRetiradaResultado}
                        />
                        {renderFieldDiff(lastClose?.custoFixoRetiradaResultadoAmount ?? 0, custoFixoRetiradaResultado)}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Plano de saúde (R$)</Label>
                        <DecimalInput
                          name="custoFixoPlanoSaudeAmount"
                          defaultValue={custoFixoPlanoSaude}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoPlanoSaude}
                        />
                        {renderFieldDiff(lastClose?.custoFixoPlanoSaudeAmount ?? lastClose?.custoFixoFolhaAmount ?? 0, custoFixoPlanoSaude)}
                      </div>
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Marketing</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(marketingTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Assessoria (R$)</Label>
                        <DecimalInput
                          name="custoFixoAssessoriaMarketingAmount"
                          defaultValue={custoFixoMarketing}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoMarketing}
                        />
                        {renderFieldDiff(lastClose?.custoFixoAssessoriaMarketingAmount ?? 0, custoFixoMarketing)}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Tráfego pago (R$)</Label>
                        <DecimalInput
                          name="custoFixoTrafegoPagoAmount"
                          defaultValue={custoFixoTrafegoPago}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoTrafegoPago}
                        />
                        {renderFieldDiff(lastClose?.custoFixoTrafegoPagoAmount ?? lastClose?.custoVariavelMarketingAmount ?? 0, custoFixoTrafegoPago)}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-1" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Serviço da dívida</span>
                      <span className="font-mono font-semibold text-foreground">{formatMoneyString(servicoDividaTotal, 2)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Parcela financiamento (R$)</Label>
                        <DecimalInput
                          name="custoFixoParcelaFinanciamentoAmount"
                          defaultValue={custoFixoFinanciamento}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoFinanciamento}
                        />
                        {renderFieldDiff(lastClose?.custoFixoParcelaFinanciamentoAmount ?? 0, custoFixoFinanciamento)}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Fatura cartão crédito (R$)</Label>
                        <DecimalInput
                          name="custoFixoFaturaCartaoAmount"
                          defaultValue={custoFixoFaturaCartao}
                          fractionDigits={2}
                          className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                          onValueChange={setCustoFixoFaturaCartao}
                        />
                        {renderFieldDiff(lastClose?.custoFixoFaturaCartaoAmount ?? 0, custoFixoFaturaCartao)}
                      </div>
                    </div>
                  </div>

                  <Separator className="my-1" />

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
                    {renderFieldDiff(lastCustoFixoOutrosPreview, custoFixoOutrosPreview)}
                  </div>
                </CardContent>
              </Card>


            </div>
            </CurrentMonthBlock>

            <CurrentMonthBlock
              title="Movimentos não operacionais"
              isOpen={currentBlocksOpen.movimentos}
              onToggle={() => toggleCurrentBlock("movimentos")}
              summary={formatMoneyString(resultadoNaoOperacionalPreview, 2)}
            >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Movimentos não operacionais</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Entradas/saídas fora da operação do mês. Elas ajustam diretamente o resultado líquido.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 items-end">
                <div className="flex flex-col gap-2">
                  <Label>Entradas não operacionais (R$)</Label>
                  <DecimalInput
                    name="entradasNaoOperacionaisAmount"
                    defaultValue={entradasNaoOperacionais}
                    fractionDigits={2}
                    className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                    onValueChange={setEntradasNaoOperacionais}
                  />
                  {renderFieldDiff(lastTotals.entradasNaoOperacionais, entradasNaoOperacionais)}
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Saídas não operacionais (R$)</Label>
                  <DecimalInput
                    name="saidasNaoOperacionaisAmount"
                    defaultValue={saidasNaoOperacionais}
                    fractionDigits={2}
                    className="w-full text-right border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 hover:border-slate-300 font-mono"
                    onValueChange={setSaidasNaoOperacionais}
                  />
                  {renderFieldDiff(lastTotals.saidasNaoOperacionais, saidasNaoOperacionais)}
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
                  {renderFieldDiff(
                    lastTotals.entradasNaoOperacionais - lastTotals.saidasNaoOperacionais,
                    resultadoNaoOperacionalPreview,
                    { note: "Entradas menos saídas; somado ao lucro/prejuízo operacional." },
                  )}
                </div>
              </CardContent>
            </Card>
            </CurrentMonthBlock>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar fechamento"}
              </Button>
            </div>
          </>

          </div>

          <div className="space-y-4 xl:col-span-4 rounded-lg bg-slate-50 p-3">
            <div className="sticky top-20 z-20 bg-slate-50/95 backdrop-blur-sm shadow-sm rounded-xl border border-slate-200 px-4 py-3 -mx-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">3. Diferença</p>
              <p className="text-sm font-semibold">
                {hasLastClose ? `${currentPeriodLabel} vs ${lastCloseLabel}` : "Sem base para comparação"}
              </p>
              <p className="text-xs text-slate-500">Somente leitura de deltas.</p>
            </div>
            <CurrentMonthBlock
              title="Indicadores principais"
              isOpen={currentBlocksOpen.indicadores}
              onToggle={() => toggleCurrentBlock("indicadores")}
              summary={hasLastClose ? formatMoneyString(delta(totals.resultadoLiquido, lastTotals.resultadoLiquido), 2) : "0,00"}
              tone="slate"
            >
            <div className="grid grid-cols-1 gap-3">
              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                      % receita bruta
                    </CardTitle>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Custos fixos</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(custoFixoPercBruta, lastCustoFixoPercBruta))}`}>
                          {hasLastClose ? diffLabel(delta(custoFixoPercBruta, lastCustoFixoPercBruta), "%") : "0.00%"}
                        </p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Custos variáveis</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(custoVariavelPercBruta, lastCustoVariavelPercBruta))}`}>
                          {hasLastClose ? diffLabel(delta(custoVariavelPercBruta, lastCustoVariavelPercBruta), "%") : "0.00%"}
                        </p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Lucro</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(totals.resultadoLiquidoPercBruta, lastTotals.resultadoLiquidoPercBruta))}`}>
                          {hasLastClose ? diffLabel(delta(totals.resultadoLiquidoPercBruta, lastTotals.resultadoLiquidoPercBruta), "%") : "0.00%"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Percentuais de custos fixos e variáveis em relação à receita bruta.
                  </p>
                </CardHeader>
              </Card>

              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                        Margem de contribuição
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(rateDelta(delta(totals.margemContrib, lastTotals.margemContrib)).tone)}`}>
                        {badgeIcon(rateDelta(delta(totals.margemContrib, lastTotals.margemContrib)).tone)}
                        {rateDelta(delta(totals.margemContrib, lastTotals.margemContrib)).label}
                      </span>
                    </div>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(totals.margemContrib, lastTotals.margemContrib))}`}>
                          {hasLastClose ? formatMoneyString(delta(totals.margemContrib, lastTotals.margemContrib), 2) : "0,00"}
                        </p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">% Receita de caixa</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(totals.margemContribPerc, lastTotals.margemContribPerc))}`}>
                          {hasLastClose ? diffLabel(delta(totals.margemContribPerc, lastTotals.margemContribPerc), "%") : "0.00%"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receita de caixa menos custos variáveis. É o que sobra para pagar os fixos.
                  </p>
                </CardHeader>
              </Card>

              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                        Resultado líquido
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(rateDelta(delta(totals.resultadoLiquido, lastTotals.resultadoLiquido)).tone)}`}>
                        {badgeIcon(rateDelta(delta(totals.resultadoLiquido, lastTotals.resultadoLiquido)).tone)}
                        {rateDelta(delta(totals.resultadoLiquido, lastTotals.resultadoLiquido)).label}
                      </span>
                    </div>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(totals.resultadoLiquido, lastTotals.resultadoLiquido))}`}>
                          {hasLastClose ? formatMoneyString(delta(totals.resultadoLiquido, lastTotals.resultadoLiquido), 2) : "0,00"}
                        </p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Ajuste não operacional</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(resultadoNaoOperacionalPreview, lastResultadoNaoOperacional))}`}>
                          {hasLastClose ? formatMoneyString(delta(resultadoNaoOperacionalPreview, lastResultadoNaoOperacional), 2) : "0,00"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Margem de contribuição menos custos fixos. Lucro/prejuízo do mês.
                  </p>
                </CardHeader>
              </Card>

              <Card className="rounded-lg border border-slate-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className={summaryHeaderGridClass}>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xs uppercase tracking-wide text-slate-900">
                        Ponto de equilíbrio
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses(rateDelta(delta(coberturaPreview, lastCoberturaPerc)).tone)}`}>
                        {badgeIcon(rateDelta(delta(coberturaPreview, lastCoberturaPerc)).tone)}
                        {rateDelta(delta(coberturaPreview, lastCoberturaPerc)).label}
                      </span>
                    </div>
                    <div className={summaryMetricsColumnClass}>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(totals.pontoEquilibrio, lastTotals.pontoEquilibrio))}`}>
                          {hasLastClose ? formatMoneyString(delta(totals.pontoEquilibrio, lastTotals.pontoEquilibrio), 2) : "0,00"}
                        </p>
                      </div>
                      <div className="w-full">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cobertura</p>
                        <p className={`font-mono text-lg font-bold ${diffTone(delta(coberturaPreview, lastCoberturaPerc))}`}>
                          {hasLastClose ? diffLabel(delta(coberturaPreview, lastCoberturaPerc), "%") : "0.00%"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receita bruta mínima para zerar lucro. Cobertura mostra o quanto a receita atual alcança do PE.
                  </p>
                </CardHeader>
              </Card>
            </div>
            </CurrentMonthBlock>

            <CurrentMonthBlock
              title="Receitas"
              isOpen={currentBlocksOpen.receitas}
              onToggle={() => toggleCurrentBlock("receitas")}
              summary={hasLastClose
                ? `${formatMoneyString(delta(receitaBruta, lastTotals.receitaBruta), 2)} (${formatMoneyString(delta(receitaLiquidaPreview, lastTotals.receitaLiquida), 2)})`
                : "0,00 (0,00)"}
              tone="slate"
            >
            <Card>
              <CardHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Receita Bruta</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Total:</span>
                    <DecimalInput
                      defaultValue={delta(receitaBruta, lastTotals.receitaBruta)}
                      fractionDigits={2}
                      className={`w-48 font-mono text-lg font-semibold bg-muted ${diffTone(delta(receitaBruta, lastTotals.receitaBruta))}`}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4">
                <DeltaField label="Receita extrato banco (R$)" value={delta(receitaExtratoBanco, lastReceitaBase.extrato)} />
                <DeltaField label="Receita dinheiro (R$)" value={delta(receitaDinheiro, lastReceitaBase.dinheiro)} />
                <Separator className="my-1" />
                <DeltaField label="Faturamento mensal (informativo)" value={delta(faturamentoMensal, lastFaturamentoMensal)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-1">
                <div>
                  <CardTitle className="text-sm font-semibold">Receita Liquida (calculo)</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Esses valores alimentam o cálculo da receita líquida e ficam salvos para histórico.
                  </p>
                </div>
                <Separator className="my-1" />
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <DeltaField label="Taxa Cartão (%)" value={delta(taxaCartaoPerc, lastTaxaCartaoPerc)} percent />
                  <DeltaField label="Taxa marketplace (%)" value={delta(taxaMarketplacePerc, lastTaxaMarketplacePerc)} percent />
                  <DeltaField label="Imposto sobre vendas (%)" value={delta(impostoPercPreview, lastImpostoPercPreview)} percent />
                </div>
                <Separator className="my-1" />
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <DeltaField label="Venda no cartão (R$)" value={delta(vendaCartaoAmount, lastVendaCartaoAmount)} />
                  <DeltaField label="Taxa Cartão (R$)" value={delta(taxaCartaoAmountPreview, lastTaxaCartaoAmountPreview)} />
                </div>
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <DeltaField label="Venda marketplace (R$)" value={delta(vendaMarketplaceAmount, lastVendaMarketplaceAmount)} />
                  <DeltaField label="Taxa marketplace (R$)" value={delta(taxaMarketplaceAmountPreview, lastTaxaMarketplaceAmountPreview)} />
                </div>
                <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3">
                  <DeltaField label="Imposto sobre vendas (R$)" value={delta(impostoAmountPreview, lastImpostoAmountPreview)} />
                </div>
                <Separator className="my-1" />
                <DeltaField label="Receita líquida (R$)" value={delta(receitaLiquidaPreview, lastTotals.receitaLiquida)} />
              </CardContent>
            </Card>
            </CurrentMonthBlock>

            <CurrentMonthBlock
              title="Custos"
              isOpen={currentBlocksOpen.custos}
              onToggle={() => toggleCurrentBlock("custos")}
              summary={hasLastClose ? formatMoneyString(delta(custoFixoTotalEdit + custoVarTotalEdit, lastTotals.custoFixoTotal + lastTotals.custoVariavelTotal), 2) : "0,00"}
              tone="slate"
            >
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Custos variáveis (principais)</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total:</span>
                      <DecimalInput
                        defaultValue={delta(custoVarTotalEdit, lastTotals.custoVariavelTotal)}
                        fractionDigits={2}
                        className={`w-48 font-mono text-lg font-semibold bg-muted ${diffTone(delta(custoVarTotalEdit, lastTotals.custoVariavelTotal))}`}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4">
                  <DeltaField label="Imposto sobre vendas (R$)" value={delta(custoVarImpostos, lastCustoVarImpostos)} />
                  <DeltaField label="Insumos (R$)" value={delta(custoVarInsumos, lastCustoVarInsumos)} />
                  <DeltaField label="Entrega (R$)" value={delta(custoVarEntrega, lastCustoVarEntrega)} />
                  <Separator className="my-1" />
                  <DeltaField label="Outros variáveis (R$)" value={delta(custoVariavelOutrosPreview, lastCustoVariavelOutrosPreview)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Custos fixos (principais)</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Total:</span>
                      <DecimalInput
                        defaultValue={delta(custoFixoTotalEdit, lastTotals.custoFixoTotal)}
                        fractionDigits={2}
                        className={`w-48 font-mono text-lg font-semibold bg-muted ${diffTone(delta(custoFixoTotalEdit, lastTotals.custoFixoTotal))}`}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Despesas com pessoal</span>
                      <span className={`font-mono font-semibold ${diffTone(delta(despesasPessoalTotal, lastDespesasPessoalTotal))}`}>
                        {formatMoneyString(delta(despesasPessoalTotal, lastDespesasPessoalTotal), 2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <DeltaField label="Folha funcionários (R$)" value={delta(custoFixoFolhaFuncionarios, lastCustoFixoFolhaFuncionarios)} />
                      <DeltaField label="Pró-labore (R$)" value={delta(custoFixoProlabore, lastCustoFixoProlabore)} />
                      <DeltaField label="Retirada de lucro / pró-labore (R$)" value={delta(custoFixoRetiradaProlabore, lastCustoFixoRetiradaProlabore)} />
                      <DeltaField label="Retirada de lucro / resultado (R$)" value={delta(custoFixoRetiradaResultado, lastCustoFixoRetiradaResultado)} />
                      <DeltaField label="Plano de saúde (R$)" value={delta(custoFixoPlanoSaude, lastCustoFixoPlanoSaude)} />
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Marketing</span>
                      <span className={`font-mono font-semibold ${diffTone(delta(marketingTotal, lastMarketingTotal))}`}>
                        {formatMoneyString(delta(marketingTotal, lastMarketingTotal), 2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <DeltaField label="Assessoria (R$)" value={delta(custoFixoMarketing, lastCustoFixoMarketing)} />
                      <DeltaField label="Tráfego pago (R$)" value={delta(custoFixoTrafegoPago, lastCustoFixoTrafegoPago)} />
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                      <span className="uppercase">Serviço da dívida</span>
                      <span className={`font-mono font-semibold ${diffTone(delta(servicoDividaTotal, lastServicoDividaTotal))}`}>
                        {formatMoneyString(delta(servicoDividaTotal, lastServicoDividaTotal), 2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <DeltaField label="Parcela financiamento (R$)" value={delta(custoFixoFinanciamento, lastCustoFixoFinanciamento)} />
                      <DeltaField label="Fatura cartão crédito (R$)" value={delta(custoFixoFaturaCartao, lastCustoFixoFaturaCartao)} />
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <DeltaField label="Outros fixos (R$)" value={delta(custoFixoOutrosPreview, lastCustoFixoOutrosPreview)} />
                </CardContent>
              </Card>
            </div>
            </CurrentMonthBlock>

            <CurrentMonthBlock
              title="Movimentos não operacionais"
              isOpen={currentBlocksOpen.movimentos}
              onToggle={() => toggleCurrentBlock("movimentos")}
              summary={hasLastClose ? formatMoneyString(delta(resultadoNaoOperacionalPreview, lastResultadoNaoOperacional), 2) : "0,00"}
              tone="slate"
            >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Movimentos não operacionais</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Entradas/saídas fora da operação do mês. Elas ajustam diretamente o resultado líquido.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 items-end">
                <DeltaField label="Entradas não operacionais (R$)" value={delta(entradasNaoOperacionais, lastEntradasNaoOperacionais)} />
                <DeltaField label="Saídas não operacionais (R$)" value={delta(saidasNaoOperacionais, lastSaidasNaoOperacionais)} />
                <DeltaField label="Impacto no resultado (R$)" value={delta(resultadoNaoOperacionalPreview, lastResultadoNaoOperacional)} />
              </CardContent>
            </Card>
            </CurrentMonthBlock>
          </div>
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
      </Form>

      <Separator className="my-1" />

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
                    <p className="col-span-2 text-xs text-muted-foreground leading-relaxed">
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
