import { Form, Link } from "@remix-run/react";
import { useMemo, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import type { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { DnaHelpLink } from "~/components/admin/dna-help-link";
import { calculateSellingPriceProfit } from "~/domain/item/item-selling-price-review";
import formatDecimalPlaces from "~/utils/format-decimal-places";

const PROFIT_CALCULATOR_PRESETS = [5, 10, 15, 20, 25];

function roundPriceUpToFiveCents(value: number) {
  return formatDecimalPlaces(Math.ceil(value / 0.05) * 0.05);
}

function calculatePriceForProfit(params: {
  baseCostAmount: number;
  dnaPerc: number;
  channelTaxPerc: number;
  isMarketplace: boolean;
  targetProfitPerc: number;
}) {
  const costDivisor =
    1 -
    (Number(params.dnaPerc || 0) + Number(params.targetProfitPerc || 0)) / 100;
  const channelDivisor = params.isMarketplace
    ? 1 - Number(params.channelTaxPerc || 0) / 100
    : 1;

  if (costDivisor <= 0 || channelDivisor <= 0) return null;

  return roundPriceUpToFiveCents(
    Number(params.baseCostAmount || 0) / costDivisor / channelDivisor
  );
}

function calculateProfitAmountForPrice(priceAmount: number | null, profitPerc: number) {
  if (priceAmount == null) return null;
  return (Number(priceAmount || 0) * Number(profitPerc || 0)) / 100;
}

export function ProfitPriceCalculatorDialog(props: {
  baseCostAmount: number;
  dnaPerc: number;
  channelTaxPerc: number;
  isMarketplace: boolean;
}) {
  const [view, setView] = useState<"presets" | "custom">("presets");
  const [customProfitPerc, setCustomProfitPerc] = useState("15");

  const presetRows = useMemo(
    () =>
      PROFIT_CALCULATOR_PRESETS.map((profitPerc) => ({
        profitPerc,
        priceAmount: calculatePriceForProfit({
          ...props,
          targetProfitPerc: profitPerc,
        }),
      })),
    [
      props.baseCostAmount,
      props.channelTaxPerc,
      props.dnaPerc,
      props.isMarketplace,
    ]
  );
  const customProfitNumber = Number(customProfitPerc.replace(",", "."));
  const customPriceAmount = Number.isFinite(customProfitNumber)
    ? calculatePriceForProfit({
        ...props,
        targetProfitPerc: customProfitNumber,
      })
    : null;
  const customProfitAmount = calculateProfitAmountForPrice(
    customPriceAmount,
    customProfitNumber
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          Calculador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-950">
              Calculador de preço de venda
            </h4>
            <div className="mt-1 text-[11px] text-slate-500">
              Base: R$ {formatDecimalPlaces(props.baseCostAmount)} · DNA{" "}
              {formatDecimalPlaces(props.dnaPerc)}%
              {props.isMarketplace
                ? ` · taxa canal ${formatDecimalPlaces(props.channelTaxPerc)}%`
                : ""}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1 text-[11px] font-semibold">
            <button
              type="button"
              className={`rounded px-2 py-1.5 ${
                view === "presets"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => setView("presets")}
            >
              Margens padrão
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1.5 ${
                view === "custom"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => setView("custom")}
            >
              Margem livre
            </button>
          </div>

          {view === "presets" ? (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                <span>Lucro</span>
                <span className="text-right">Lucro R$</span>
                <span className="text-right">Preço de venda</span>
              </div>
              {presetRows.map((row) => (
                <div
                  key={row.profitPerc}
                  className="grid grid-cols-3 border-t border-slate-100 px-3 py-2 text-sm"
                >
                  <span className="text-slate-600">{row.profitPerc}%</span>
                  <span className="text-right font-mono text-slate-950">
                    {row.priceAmount == null
                      ? "Indisponível"
                      : `R$ ${formatDecimalPlaces(
                          calculateProfitAmountForPrice(row.priceAmount, row.profitPerc) || 0
                        )}`}
                  </span>
                  <span className="text-right font-mono text-slate-950">
                    {row.priceAmount == null
                      ? "Indisponível"
                      : `R$ ${formatDecimalPlaces(row.priceAmount)}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold uppercase text-slate-500">
                Percentual de lucro
              </label>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customProfitPerc}
                  onChange={(event) => setCustomProfitPerc(event.target.value)}
                  className="h-10 font-mono"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Preço de venda
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-slate-950">
                  {customPriceAmount == null
                    ? "Indisponível"
                    : `R$ ${formatDecimalPlaces(customPriceAmount)}`}
                </div>
                <div className="mt-2 grid grid-cols-2 text-xs">
                  <span className="text-slate-500">Lucro em reais</span>
                  <span className="text-right font-mono font-semibold text-slate-950">
                    {customProfitAmount == null
                      ? "Indisponível"
                      : `R$ ${formatDecimalPlaces(customProfitAmount)}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfitMathDialog(props: {
  priceAmount: number;
  baseCostAmount: number;
  dnaAmount: number;
  channelTaxAmount: number;
  operationalCostAmount: number;
  profitAmount: number;
  profitPerc: number;
  isMarketplace: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-current opacity-70 transition hover:bg-white/20 hover:opacity-100"
          aria-label="Ver cálculo do lucro atual"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cálculo do lucro atual</DialogTitle>
          <DialogDescription>
            Breakdown da operação usada para chegar no lucro em reais e na margem percentual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-slate-500">Preço de venda atual</span>
            <span className="text-right font-mono text-slate-900">R$ {formatDecimalPlaces(props.priceAmount)}</span>
            <span className="text-slate-500">(-) Custo operacional</span>
            <span className="text-right font-mono text-slate-900">R$ {formatDecimalPlaces(props.operationalCostAmount)}</span>
            <span className="font-medium text-slate-700">(=) Lucro atual</span>
            <span className="text-right font-mono font-semibold text-slate-900">R$ {formatDecimalPlaces(props.profitAmount)}</span>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-slate-500">Custo da ficha técnica</span>
            <span className="text-right font-mono">R$ {formatDecimalPlaces(props.baseCostAmount)}</span>
            <span className="text-slate-500">(+) DNA</span>
            <span className="text-right font-mono">R$ {formatDecimalPlaces(props.dnaAmount)}</span>
            {props.isMarketplace ? (
              <>
                <span className="text-slate-500">(+) Taxa canal</span>
                <span className="text-right font-mono">R$ {formatDecimalPlaces(props.channelTaxAmount)}</span>
              </>
            ) : null}
            <span className="font-medium text-slate-700">(=) Custo operacional</span>
            <span className="text-right font-mono font-semibold">R$ {formatDecimalPlaces(props.operationalCostAmount)}</span>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-slate-500">Margem</span>
            <span className="text-right font-mono">
              R$ {formatDecimalPlaces(props.profitAmount)} / R$ {formatDecimalPlaces(props.priceAmount)}
            </span>
            <span className="font-medium text-slate-700">(=) Lucro percentual</span>
            <span className="text-right font-mono font-semibold">{formatDecimalPlaces(props.profitPerc)}%</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OperationalCostHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Entender valor reservado para custos"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Valor reservado para custos</DialogTitle>
          <DialogDescription>
            Este valor representa a parte do preço de venda já comprometida com custos, antes de sobrar qualquer lucro.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function BreakEvenHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Entender break even"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Break even</DialogTitle>
          <DialogDescription>
            Preço mínimo para não ter prejuízo.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export function NativeSellingPriceSchema(props: {
  priceAmount: number;
  computedSellingPriceBreakdown: ComputedSellingPriceBreakdown;
  activeSheetId?: string | null;
  activeSheetName?: string | null;
  dnaHelpUrl?: string | null;
  profitPriceHelpUrl?: string | null;
  showBreakEvenLine?: boolean;
  showMissingSheetWarning?: boolean;
  recommendedPriceControl: ReactNode;
}) {
  const breakdown = props.computedSellingPriceBreakdown;
  const custoFT = Number(breakdown.custoFichaTecnica || 0);
  const profitSummary = calculateSellingPriceProfit({
    priceAmount: props.priceAmount,
    breakdown,
  });
  const custoTotal = profitSummary.baseCostAmount;
  const dnaPerc = profitSummary.dnaPerc;
  const dnaValor = profitSummary.dnaAmount;
  const channelTaxPerc = profitSummary.channelTaxPerc;
  const isMarketplace = Boolean(breakdown.channel?.isMarketplace);
  const taxaCanal = profitSummary.channelTaxAmount;
  const lucroValor = profitSummary.profitAmount;
  const lucroPerc = profitSummary.profitPerc;
  const operationalCostAmount = profitSummary.operationalCostAmount;
  const breakEvenPrice = Number(
    breakdown.minimumPrice?.priceAmount?.breakEven || 0
  );
  const targetMarginPerc = Number(breakdown.channel?.targetMarginPerc || 0);
  const hasActiveSheet = custoFT > 0 || Boolean(props.activeSheetName);
  const showBreakEvenLine = props.showBreakEvenLine ?? true;
  const showMissingSheetWarning = props.showMissingSheetWarning ?? true;
  const profitMathDialog = (
    <ProfitMathDialog
      priceAmount={props.priceAmount}
      baseCostAmount={custoTotal}
      dnaAmount={dnaValor}
      channelTaxAmount={taxaCanal}
      operationalCostAmount={operationalCostAmount}
      profitAmount={lucroValor}
      profitPerc={lucroPerc}
      isMarketplace={isMarketplace}
    />
  );

  return (
    <>
      {showBreakEvenLine ? (
        <>
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center font-medium text-slate-700">
              Break even
              <BreakEvenHelpDialog />
            </span>
            <span className="font-mono font-semibold text-slate-900">
              R$ {formatDecimalPlaces(breakEvenPrice)}
            </span>
          </div>

          <Separator />
        </>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <DnaHelpLink
          label={`PV com lucro ${targetMarginPerc}%`}
          url={props.profitPriceHelpUrl}
          className="font-medium text-slate-700"
        />
        <div className="flex items-center gap-1">
          <ProfitPriceCalculatorDialog
            baseCostAmount={custoTotal}
            dnaPerc={dnaPerc}
            channelTaxPerc={channelTaxPerc}
            isMarketplace={isMarketplace}
          />
          {props.recommendedPriceControl}
        </div>
      </div>

      <Separator />

      {lucroPerc < 0 ? (
        <div className="rounded-md bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white">
          Preço atual com prejuízo:{" "}
          <span className="inline-flex items-center font-mono">
            {formatDecimalPlaces(lucroPerc)}% | R${" "}
            {formatDecimalPlaces(lucroValor)}
            {profitMathDialog}
          </span>
        </div>
      ) : lucroPerc <= 5 ? (
        <div className="rounded-md bg-orange-500 px-2 py-1.5 text-[11px] font-semibold text-white">
          Preço atual com lucro baixo:{" "}
          <span className="inline-flex items-center font-mono">
            {formatDecimalPlaces(lucroPerc)}% | R${" "}
            {formatDecimalPlaces(lucroValor)}
            {profitMathDialog}
          </span>
        </div>
      ) : (
        <div
          className={`text-[11px] ${
            lucroPerc < targetMarginPerc ? "text-orange-400" : "text-slate-500"
          }`}
        >
          Preço atual:{" "}
          <span className="inline-flex items-center font-mono">
            {formatDecimalPlaces(lucroPerc)}% | R${" "}
            {formatDecimalPlaces(lucroValor)}
            {profitMathDialog}
          </span>
        </div>
      )}

      <Separator />

      <div className="grid grid-cols-2 gap-y-1 text-[11px]">
        <span className="inline-flex items-center text-slate-500">
          Custo da ficha técnica
          {props.activeSheetId ? (
            <Link
              to={`/admin/item-cost-sheets/${props.activeSheetId}/custos`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Abrir ficha técnica"
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </span>
        <span className="text-right font-mono">
          R$ {formatDecimalPlaces(custoTotal)}
        </span>
        <DnaHelpLink
          label={`(+) DNA (${formatDecimalPlaces(dnaPerc)}%)`}
          url={props.dnaHelpUrl}
          className="text-slate-500"
        />
        <span className="text-right font-mono">
          R$ {formatDecimalPlaces(dnaValor)}
        </span>
        {isMarketplace ? (
          <>
            <span className="text-slate-500">{`(+) Taxa canal (${formatDecimalPlaces(
              channelTaxPerc
            )}%)`}</span>
            <span className="text-right font-mono">
              R$ {formatDecimalPlaces(taxaCanal)}
            </span>
          </>
        ) : null}
        <span className="inline-flex items-center leading-tight font-medium text-slate-700">
          Valor reservado para custos
          <OperationalCostHelpDialog />
        </span>
        <span className="inline-flex items-center justify-end font-mono font-semibold text-slate-900">
          R$ {formatDecimalPlaces(operationalCostAmount)}
        </span>
      </div>

      {showMissingSheetWarning && !hasActiveSheet ? (
        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Sem ficha técnica ativa vinculada para esta variação.
        </div>
      ) : null}
    </>
  );
}

export function NativeItemSellingPriceCard(props: {
  action?: string;
  formId?: string;
  itemId: string;
  itemVariationId: string;
  itemSellingChannelId: string;
  variationLabel: string;
  channelLabel?: string | null;
  currentRow?: {
    priceAmount?: number | null;
    previousPriceAmount?: number | null;
    published?: boolean | null;
    updatedBy?: string | null;
  } | null;
  computedSellingPriceBreakdown: ComputedSellingPriceBreakdown;
  activeSheetId?: string | null;
  activeSheetName?: string | null;
  updatedBy?: string | null;
  dnaHelpUrl?: string | null;
  profitPriceHelpUrl?: string | null;
  priceInputName?: string;
  showSingleSubmitButton?: boolean;
  showPublishedToggle?: boolean;
  recommendedPriceMode?: "submit" | "display";
}) {
  const actualPrice = Number(props.currentRow?.priceAmount || 0);
  const previousPrice = Number(props.currentRow?.previousPriceAmount || 0);
  const breakdown = props.computedSellingPriceBreakdown;
  const cardProfitPerc = calculateSellingPriceProfit({
    priceAmount: actualPrice,
    breakdown,
  }).profitPerc;
  const recommendedPrice = Number(
    breakdown.minimumPrice?.priceAmount?.withProfit || 0
  );
  const inputName = props.priceInputName || "priceAmount";
  const showSingleSubmitButton = props.showSingleSubmitButton ?? true;
  const showPublishedToggle = props.showPublishedToggle ?? true;
  const recommendedPriceMode = props.recommendedPriceMode || "submit";
  const recommendedPriceControl =
    recommendedPriceMode === "submit" ? (
      <button
        type="submit"
        name="_intent"
        value="apply-recommended"
        className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-900 transition hover:bg-slate-200"
      >
        R$ {formatDecimalPlaces(recommendedPrice)}
      </button>
    ) : (
      <span className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-900">
        R$ {formatDecimalPlaces(recommendedPrice)}
      </span>
    );

  const content = (
    <div className="space-y-2">
      {showSingleSubmitButton ? (
        <>
          <input type="hidden" name="_action" value="upsert-native-price" />
          <input type="hidden" name="itemId" value={props.itemId} />
          <input
            type="hidden"
            name="itemVariationId"
            value={props.itemVariationId}
          />
          <input
            type="hidden"
            name="itemSellingChannelId"
            value={props.itemSellingChannelId}
          />
          <input
            type="hidden"
            name="updatedBy"
            value={props.updatedBy || props.currentRow?.updatedBy || ""}
          />
          <input
            type="hidden"
            name="recommendedPriceAmount"
            value={recommendedPrice}
          />
        </>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] items-start gap-2">
        <div className="flex flex-col justify-center">
          <span className="text-[9px] uppercase tracking-wide text-slate-400">
            PV anterior
          </span>
          <span className="font-mono text-xs text-slate-600">
            R$ {formatDecimalPlaces(previousPrice)}
          </span>
        </div>
        <div className="flex items-center justify-end gap-1">
          <MoneyInput
            name={inputName}
            form={props.formId}
            defaultValue={actualPrice}
            className="h-8 w-28 font-mono text-sm"
          />
          {showSingleSubmitButton ? (
            <button
              type="submit"
              className="h-8 rounded border border-slate-200 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
            >
              Salvar
            </button>
          ) : null}
        </div>
      </div>

      {showPublishedToggle ? (
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            name="published"
            defaultChecked={Boolean(props.currentRow?.published)}
          />
          Publicado no canal
        </label>
      ) : null}

      <Separator />

      <NativeSellingPriceSchema
        priceAmount={actualPrice}
        computedSellingPriceBreakdown={breakdown}
        activeSheetId={props.activeSheetId}
        activeSheetName={props.activeSheetName}
        dnaHelpUrl={props.dnaHelpUrl}
        profitPriceHelpUrl={props.profitPriceHelpUrl}
        showBreakEvenLine
        recommendedPriceControl={recommendedPriceControl}
      />

    </div>
  );

  return (
    <div
      className={`rounded-lg border p-3 ${
        cardProfitPerc < 0 ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {props.variationLabel}
          </div>
          {props.channelLabel ? (
            <div className="text-[11px] text-slate-400">
              {props.channelLabel}
            </div>
          ) : null}
        </div>
        <div className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-900">
          R$ {formatDecimalPlaces(actualPrice)}
        </div>
      </div>

      {showSingleSubmitButton ? (
        <Form method="post" action={props.action} className="space-y-2">
          {content}
        </Form>
      ) : (
        content
      )}
    </div>
  );
}
