import { Form, Link } from "@remix-run/react";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import type { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import formatDecimalPlaces from "~/utils/format-decimal-places";

function detailRow(label: string, value: number) {
  return (
    <>
      <span>{label}</span>
      <span className="font-mono text-right">{formatDecimalPlaces(value)}</span>
    </>
  );
}

export function NativeItemSellingPriceCard(props: {
  action?: string;
  itemId: string;
  itemVariationId: string;
  itemSellingChannelId: string;
  variationLabel: string;
  channelLabel?: string | null;
  currentRow?: {
    priceAmount?: number | null;
    previousPriceAmount?: number | null;
    profitActualPerc?: number | null;
    published?: boolean | null;
    updatedBy?: string | null;
  } | null;
  computedSellingPriceBreakdown: ComputedSellingPriceBreakdown;
  activeSheetId?: string | null;
  activeSheetName?: string | null;
  updatedBy?: string | null;
}) {
  const actualPrice = Number(props.currentRow?.priceAmount || 0);
  const previousPrice = Number(props.currentRow?.previousPriceAmount || 0);
  const breakdown = props.computedSellingPriceBreakdown;
  const custoFT = Number(breakdown.custoFichaTecnica || 0);
  const custoDesperdicio = Number(breakdown.wasteCost || 0);
  const custoMassa = Number(breakdown.doughCostAmount || 0);
  const custoTotal = custoFT + custoDesperdicio + custoMassa;
  const dnaPerc = Number(breakdown.dnaPercentage || 0);
  const dnaValor = (actualPrice * dnaPerc) / 100;
  const custoComDna = custoTotal + dnaValor;
  const lucroValor = actualPrice - custoComDna;
  const lucroPerc = actualPrice > 0 ? (lucroValor / actualPrice) * 100 : 0;
  const recommendedPrice = Number(
    breakdown.minimumPrice?.priceAmount?.withProfit || 0
  );
  const breakEvenPrice = Number(
    breakdown.minimumPrice?.priceAmount?.breakEven || 0
  );
  const targetMarginPerc = Number(
    breakdown.channel?.targetMarginPerc || 0
  );
  const hasActiveSheet = custoFT > 0 || Boolean(props.activeSheetName);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {props.variationLabel}
          </div>
          {props.channelLabel ? (
            <div className="text-[11px] text-slate-400">{props.channelLabel}</div>
          ) : null}
        </div>
        <div className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-900">
          R$ {formatDecimalPlaces(actualPrice)}
        </div>
      </div>

      {!hasActiveSheet ? (
        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Sem ficha técnica ativa vinculada para esta variação.
        </div>
      ) : null}

      <Form method="post" action={props.action} className="space-y-2">
        <input type="hidden" name="_action" value="upsert-native-price" />
        <input type="hidden" name="itemId" value={props.itemId} />
        <input type="hidden" name="itemVariationId" value={props.itemVariationId} />
        <input type="hidden" name="itemSellingChannelId" value={props.itemSellingChannelId} />
        <input type="hidden" name="updatedBy" value={props.updatedBy || props.currentRow?.updatedBy || ""} />
        <input type="hidden" name="recommendedPriceAmount" value={recommendedPrice} />

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <MoneyInput
            name="priceAmount"
            defaultValue={actualPrice}
            className="h-10 font-mono"
          />
          <button
            type="submit"
            className="h-10 rounded border border-slate-200 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-800 transition hover:bg-slate-50"
          >
            Salvar
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            name="published"
            defaultChecked={Boolean(props.currentRow?.published)}
          />
          Publicado no canal
        </label>

        <div className={`text-[11px] ${lucroPerc < 0 ? "text-red-400" : lucroPerc < targetMarginPerc ? "text-orange-400" : "text-slate-500"}`}>
          Lucro atual: <span className="font-mono">{formatDecimalPlaces(lucroPerc)}% | R$ {formatDecimalPlaces(lucroValor)}</span>
        </div>

        <Separator />

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{`PV com lucro ${targetMarginPerc}%`}</span>
          <button
            type="submit"
            name="_intent"
            value="apply-recommended"
            className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-900 transition hover:bg-slate-200"
          >
            R$ {formatDecimalPlaces(recommendedPrice)}
          </button>
        </div>

        <Separator />

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Mínimo (Break-even):</span>
          <span className="font-mono">R$ {formatDecimalPlaces(breakEvenPrice)}</span>
        </div>

        <Separator />

        <Dialog>
          <div className="flex items-center justify-between text-[11px]">
            <DialogTrigger asChild>
              <button type="button" className="text-slate-500 underline">
                Custo base (detalhes)
              </button>
            </DialogTrigger>
            <span className="font-mono">R$ {formatDecimalPlaces(custoTotal)}</span>
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
                <span className="font-mono text-right">{formatDecimalPlaces(custoFT)}</span>
                {detailRow("Desperdício", custoDesperdicio)}
                {detailRow("Custo Massa", custoMassa)}
              </div>

              <Separator className="my-2" />

              <div className="grid grid-cols-2 gap-y-1 text-[12px]">
                {detailRow("Custo total", custoTotal)}
              </div>

              <Separator className="my-2" />

              <div className="grid grid-cols-2 gap-y-1 text-[12px]">
                {detailRow(`DNA (${formatDecimalPlaces(dnaPerc)}%)`, dnaValor)}
                {detailRow("Custo base + DNA", custoComDna)}
              </div>

              <Separator className="my-2" />

              <div className="grid grid-cols-2 gap-y-1 text-[12px]">
                <span className="font-semibold">Preço de venda</span>
                <span />
                {detailRow(`Com lucro recomendado (${targetMarginPerc}%)`, recommendedPrice)}
                {detailRow("Break-even (lucro R$ 0)", breakEvenPrice)}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-2 gap-y-1 text-[11px]">
          <span className="text-slate-500">{`DNA (${formatDecimalPlaces(dnaPerc)}%)`}</span>
          <span className="text-right font-mono">R$ {formatDecimalPlaces(dnaValor)}</span>
          <span className="text-slate-500">Custo base + DNA</span>
          <span className="text-right font-mono">R$ {formatDecimalPlaces(custoComDna)}</span>
          <span className="text-slate-500">Anterior</span>
          <span className="text-right font-mono">R$ {formatDecimalPlaces(previousPrice)}</span>
        </div>
      </Form>
    </div>
  );
}
