import { useOutletContext } from "@remix-run/react";
import { Calculator, Copy, HelpCircle, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  formatMoney,
  formatPercent,
  formatStatus,
  MetricRow,
} from "~/domain/sell-price/components/combo-generator-shared";
import type { AdminVendasGeradorCombosOutletContext } from "./admin.vendas.combos.simulador";

export default function AdminVendasGeradorCombosPrecificacaoPage() {
  const {
    selectedLines,
    totals,
    pricingMode,
    discountPercentage,
    discountAmount,
    fixedPriceAmount,
    copySimulationMessage,
    copySimulation,
    clearLines,
  } = useOutletContext<AdminVendasGeradorCombosOutletContext>();
  const marginClassName =
    (totals.profitPerc || 0) >= totals.targetMarginPerc
      ? "text-emerald-700"
      : "text-amber-700";
  const statusClassName =
    totals.status === "HEALTHY"
      ? "text-emerald-700"
      : totals.status === "BELOW_BREAK_EVEN"
      ? "text-red-700"
      : "text-amber-700";

  return (
    <section className="space-y-4 ">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Calculator className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">Resultado</h2>
          <p className="text-xs text-slate-500">
            Simulacao local, sem gravar combo.
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <ResultHighlight
            label="Preco pleno"
            value={formatMoney(totals.individualTotalPrice)}
          />
          <ResultHighlight
            label="Preco simulado"
            value={formatMoney(totals.comboPrice)}
            helpTitle="De onde sai o preco simulado?"
          >
            <SimulatedPriceHelp
              pricingMode={pricingMode}
              discountPercentage={discountPercentage}
              discountAmount={discountAmount}
              fixedPriceAmount={fixedPriceAmount}
              individualTotalPrice={totals.individualTotalPrice}
              comboPrice={totals.comboPrice}
            />
          </ResultHighlight>
          <ResultHighlight
            label="Preco recomendado"
            value={formatMoney(totals.recommendedPrice)}
            tone="emerald"
            helpTitle="De onde sai o preco recomendado?"
          >
            <RecommendedPriceHelp
              comboTotalCost={totals.comboTotalCost}
              dnaPerc={totals.dnaPerc}
              targetMarginPerc={totals.targetMarginPerc}
              recommendedPrice={totals.recommendedPrice}
            />
          </ResultHighlight>
        </div>

        <MetricGroup title="Desconto">
          <MetricRow
            label="Desconto real"
            value={`${formatMoney(
              totals.equivalentDiscountAmount
            )} (${formatPercent(totals.equivalentDiscountPercentage)})`}
          />
        </MetricGroup>

        <MetricGroup title="Custos">
          <MetricRow
            label="Custo total da ficha"
            value={formatMoney(totals.comboTotalCost)}
          />
          <MetricRow
            label="DNA aplicado"
            value={`${formatPercent(totals.dnaPerc)} / ${formatMoney(
              totals.dnaAmount
            )}`}
          />
          <MetricRow
            label="Custo operacional"
            value={formatMoney(totals.operationalCost)}
            strong
          />
        </MetricGroup>

        <MetricGroup title="Margem">
          <MetricRow
            label="Lucro estimado"
            value={formatMoney(totals.profitAmount)}
          />
          <MetricRow
            label="Margem real"
            value={formatPercent(totals.profitPerc)}
            valueClassName={marginClassName}
          />
          <MetricRow
            label="Preco de equilibrio"
            value={formatMoney(totals.breakEvenPrice)}
          />
          <MetricRow
            label="Margem alvo"
            value={formatPercent(totals.targetMarginPerc)}
          />
          <MetricRow
            label="Status"
            value={formatStatus(totals.status)}
            valueClassName={statusClassName}
          />
        </MetricGroup>
      </div>

      {!totals.isValidForSale && selectedLines.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Combo invalido para venda.</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {totals.invalidReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        <Button
          type="button"
          size="sm"
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          onClick={copySimulationMessage}
          disabled={selectedLines.length === 0}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          copiar mensagem
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={copySimulation}
          disabled={selectedLines.length === 0}
        >
          <Copy className="h-3.5 w-3.5" />
          copiar resumo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-slate-500"
          onClick={clearLines}
          disabled={selectedLines.length === 0}
        >
          limpar combo
        </Button>
      </div>
    </section>
  );
}

function ResultHighlight({
  label,
  value,
  tone = "slate",
  helpTitle,
  children,
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald";
  helpTitle?: string;
  children?: ReactNode;
}) {
  const toneClassName =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-slate-200 bg-slate-50 text-slate-950";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClassName}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {helpTitle && children ? (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/70 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label={helpTitle}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{helpTitle}</DialogTitle>
                <DialogDescription>
                  Explicacao do calculo com os valores atuais da simulacao.
                </DialogDescription>
              </DialogHeader>
              {children}
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SimulatedPriceHelp({
  pricingMode,
  discountPercentage,
  discountAmount,
  fixedPriceAmount,
  individualTotalPrice,
  comboPrice,
}: {
  pricingMode: AdminVendasGeradorCombosOutletContext["pricingMode"];
  discountPercentage: number;
  discountAmount: number;
  fixedPriceAmount: number;
  individualTotalPrice: number;
  comboPrice: number;
}) {
  const modeExplanation =
    pricingMode === "PERCENTAGE_DISCOUNT"
      ? {
          title: "Desconto percentual",
          formula: `Preço pleno x (1 - ${formatPercent(discountPercentage)})`,
          input: `Desconto informado: ${formatPercent(discountPercentage)}`,
        }
      : pricingMode === "FIXED_DISCOUNT"
      ? {
          title: "Desconto em valor",
          formula: `Soma individual - ${formatMoney(discountAmount)}`,
          input: `Desconto informado: ${formatMoney(discountAmount)}`,
        }
      : {
          title: "Preco fixo",
          formula: "Valor informado manualmente",
          input: `Preco fixo informado: ${formatMoney(fixedPriceAmount)}`,
        };

  return (
    <div className="space-y-4 text-sm text-slate-600">
      <p>
        O preco simulado e o preco de venda do combo nesta tela. Ele muda
        conforme o modo escolhido no formulario.
      </p>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="font-semibold text-slate-900">{modeExplanation.title}</p>
        <p className="mt-1">{modeExplanation.formula}</p>
        <p className="mt-1 text-xs text-slate-500">{modeExplanation.input}</p>
      </div>
      <div className="space-y-1">
        <MetricRow
          label="Soma individual"
          value={formatMoney(individualTotalPrice)}
        />
        <MetricRow label="Preco simulado" value={formatMoney(comboPrice)} />
      </div>
    </div>
  );
}

function RecommendedPriceHelp({
  comboTotalCost,
  dnaPerc,
  targetMarginPerc,
  recommendedPrice,
}: {
  comboTotalCost: number;
  dnaPerc: number;
  targetMarginPerc: number;
  recommendedPrice: number;
}) {
  const protectedRatePerc = dnaPerc + targetMarginPerc;

  return (
    <div className="space-y-4 text-sm text-slate-600">
      <p>
        O preco recomendado e o menor preco que cobre o custo total da ficha, o
        DNA do canal e ainda preserva a margem alvo configurada.
      </p>
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
        <p className="font-semibold">Formula</p>
        <p className="mt-1">
          Custo total da ficha / (1 - DNA - margem alvo), arredondado para cima
          em passos de R$ 0,05.
        </p>
      </div>
      <div className="space-y-1">
        <MetricRow
          label="Custo total da ficha"
          value={formatMoney(comboTotalCost)}
        />
        <MetricRow label="DNA" value={formatPercent(dnaPerc)} />
        <MetricRow
          label="Margem alvo"
          value={formatPercent(targetMarginPerc)}
        />
        <MetricRow
          label="Percentual protegido"
          value={formatPercent(protectedRatePerc)}
        />
        <MetricRow
          label="Preco recomendado"
          value={formatMoney(recommendedPrice)}
          strong
        />
      </div>
    </div>
  );
}

function MetricGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-2 space-y-1.5 text-sm">{children}</div>
    </div>
  );
}
