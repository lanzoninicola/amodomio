import { Form, Link } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import type { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { DnaHelpLink } from "~/components/admin/dna-help-link";
import { calculateBreakEvenComposition } from "~/domain/item/item-selling-price-review";
import formatDecimalPlaces from "~/utils/format-decimal-places";

const PROFIT_CALCULATOR_PRESETS = [5, 10, 15, 20, 25];

function detailRow(label: string, value: number) {
  return (
    <>
      <span>{label}</span>
      <span className="font-mono text-right">{formatDecimalPlaces(value)}</span>
    </>
  );
}

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

function ProfitPriceCalculatorDialog(props: {
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
              <div className="grid grid-cols-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
                <span>Lucro</span>
                <span className="text-right">Preço de venda</span>
              </div>
              {presetRows.map((row) => (
                <div
                  key={row.profitPerc}
                  className="grid grid-cols-2 border-t border-slate-100 px-3 py-2 text-sm"
                >
                  <span className="text-slate-600">{row.profitPerc}%</span>
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
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  const custoFT = Number(breakdown.custoFichaTecnica || 0);
  const custoDesperdicio = Number(breakdown.wasteCost || 0);
  const custoMassa = Number(breakdown.doughCostAmount || 0);
  const custoEmbalagem = Number(breakdown.packagingCostAmount || 0);
  const breakEvenComposition = calculateBreakEvenComposition({ breakdown });
  const custoTotal = breakEvenComposition.baseCostAmount;
  const dnaPerc = Number(breakdown.dnaPercentage || 0);
  const dnaValor = (actualPrice * dnaPerc) / 100;
  const custoComDna = custoTotal + dnaValor;
  const channelTaxPerc = Number(breakdown.channel?.taxPerc || 0);
  const isMarketplace = Boolean(breakdown.channel?.isMarketplace);
  const taxaCanal = isMarketplace ? (actualPrice * channelTaxPerc) / 100 : 0;
  const lucroValor = actualPrice - custoComDna - taxaCanal;
  const lucroPerc = actualPrice > 0 ? (lucroValor / actualPrice) * 100 : 0;
  const recommendedPrice = Number(
    breakdown.minimumPrice?.priceAmount?.withProfit || 0
  );
  const breakEvenPrice = Number(
    breakdown.minimumPrice?.priceAmount?.breakEven || 0
  );
  const dnaBreakEvenValue = breakEvenComposition.dnaAmount;
  const custoComDnaBreakEven = breakEvenComposition.totalAmount;
  const targetMarginPerc = Number(breakdown.channel?.targetMarginPerc || 0);
  const hasActiveSheet = custoFT > 0 || Boolean(props.activeSheetName);
  const inputName = props.priceInputName || "priceAmount";
  const showSingleSubmitButton = props.showSingleSubmitButton ?? true;
  const showPublishedToggle = props.showPublishedToggle ?? true;
  const recommendedPriceMode = props.recommendedPriceMode || "submit";

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

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <MoneyInput
          name={inputName}
          form={props.formId}
          defaultValue={actualPrice}
          className="h-10 w-full font-mono"
        />
        {showSingleSubmitButton ? (
          <button
            type="submit"
            className="h-10 rounded border border-slate-200 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-800 transition hover:bg-slate-50"
          >
            Salvar
          </button>
        ) : null}
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

      {lucroPerc < 0 ? (
        <div className="rounded-md bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white">
          Lucro negativo:{" "}
          <span className="font-mono">
            {formatDecimalPlaces(lucroPerc)}% | R${" "}
            {formatDecimalPlaces(lucroValor)}
          </span>
        </div>
      ) : (
        <div
          className={`text-[11px] ${
            lucroPerc < targetMarginPerc ? "text-orange-400" : "text-slate-500"
          }`}
        >
          Lucro atual:{" "}
          <span className="font-mono">
            {formatDecimalPlaces(lucroPerc)}% | R${" "}
            {formatDecimalPlaces(lucroValor)}
          </span>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between text-[11px]">
        <DnaHelpLink
          label={`PV com lucro ${targetMarginPerc}%`}
          url={props.profitPriceHelpUrl}
          className="text-slate-500"
        />
        <div className="flex items-center gap-1">
          <ProfitPriceCalculatorDialog
            baseCostAmount={custoTotal}
            dnaPerc={dnaPerc}
            channelTaxPerc={channelTaxPerc}
            isMarketplace={isMarketplace}
          />
          {recommendedPriceMode === "submit" ? (
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
          )}
        </div>
      </div>

      {!hasActiveSheet ? (
        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Sem ficha técnica ativa vinculada para esta variação.
        </div>
      ) : null}
      <Separator />

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Mínimo (Break-even):</span>
        <span className="font-mono">
          R$ {formatDecimalPlaces(breakEvenPrice)}
        </span>
      </div>

      <Separator />

      <Dialog>
        <div className="flex items-center justify-between text-[11px]">
          <DialogTrigger asChild>
            <button type="button" className="text-slate-500 underline">
              Custo base (detalhes)
            </button>
          </DialogTrigger>
          <span className="font-mono">
            R$ {formatDecimalPlaces(custoTotal)}
          </span>
        </div>

        <DialogContent className="sm:max-w-[420px]">
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Detalhamento de custos</h4>
            {props.activeSheetName ? (
              <div className="text-[11px] text-slate-500">
                Ficha ativa: {props.activeSheetName}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-y-1 text-[12px]">
              <span>
                {props.activeSheetId ? (
                  <Link
                    to={`/admin/item-cost-sheets/${props.activeSheetId}`}
                    className="underline hover:text-slate-900"
                  >
                    Ficha Técnica
                  </Link>
                ) : (
                  "Ficha Técnica"
                )}
              </span>
              <span className="font-mono text-right">
                {formatDecimalPlaces(custoFT)}
              </span>
              {detailRow("Desperdício", custoDesperdicio)}
              {detailRow("Custo Massa", custoMassa)}
              {detailRow("Custo Embalagem", custoEmbalagem)}
            </div>

            <Separator className="my-2" />

            <div className="grid grid-cols-2 gap-y-1 text-[12px]">
              {detailRow("Custo total", custoTotal)}
            </div>

            <Separator className="my-2" />

            <div className="grid grid-cols-2 gap-y-1 text-[12px]">
              <DnaHelpLink
                label={`DNA (${formatDecimalPlaces(dnaPerc)}%)`}
                url={props.dnaHelpUrl}
              />
              <span className="font-mono text-right">
                {formatDecimalPlaces(dnaBreakEvenValue)}
              </span>
              {detailRow("Custo base + DNA", custoComDnaBreakEven)}
            </div>

            <Separator className="my-2" />

            <div className="grid grid-cols-2 gap-y-1 text-[12px]">
              <span className="font-semibold">Preço de venda</span>
              <span />
              {detailRow(
                `Com lucro recomendado (${targetMarginPerc}%)`,
                recommendedPrice
              )}
              {detailRow("Break-even (lucro R$ 0)", breakEvenPrice)}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-y-1 text-[11px]">
        <DnaHelpLink
          label={`DNA (${formatDecimalPlaces(dnaPerc)}%)`}
          url={props.dnaHelpUrl}
          className="text-slate-500"
        />
        <span className="text-right font-mono">
          R$ {formatDecimalPlaces(dnaBreakEvenValue)}
        </span>
        <span className="text-slate-500">Custo base + DNA</span>
        <span className="text-right font-mono">
          R$ {formatDecimalPlaces(custoComDnaBreakEven)}
        </span>
        <span className="text-slate-500">Anterior</span>
        <span className="text-right font-mono">
          R$ {formatDecimalPlaces(previousPrice)}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={`rounded-lg border p-3 ${
        lucroPerc < 0 ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
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
