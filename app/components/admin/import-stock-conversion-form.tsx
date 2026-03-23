import { Form } from "@remix-run/react";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { DecimalInput } from "~/components/inputs/inputs";
import { Button } from "~/components/ui/button";

type PendingConversionFormProps = {
  batchId: string;
  line: any;
  mobile?: boolean;
};

function formatMoney(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatFactorLabel(amount: number | null) {
  if (amount == null) return "...";
  return amount.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function PendingConversionForm({ batchId, line, mobile = false }: PendingConversionFormProps) {
  const [factor, setFactor] = useState<number>(0);
  const originUnit = String(line?.movementUnit || line?.unitEntry || "origem").trim() || "origem";
  const targetUnit = String(line?.targetUnit || line?.unitConsumption || "destino").trim() || "destino";
  const factorAmount = useMemo(() => (Number.isFinite(factor) && factor > 0 ? factor : null), [factor]);
  const factorLabel = formatFactorLabel(factorAmount);
  const convertedCost =
    factorAmount && Number(line?.costAmount) > 0 ? Number(line.costAmount) / factorAmount : null;
  const hintText = factorAmount
    ? `1 ${originUnit} = ${factorLabel} ${targetUnit}`
    : `Digite quantas ${targetUnit} existem em 1 ${originUnit}.`;
  const costPreview =
    convertedCost != null
      ? `${formatMoney(line?.costAmount)} / ${originUnit} = ${formatMoney(convertedCost)} / ${targetUnit}`
      : null;

  return (
    <Form method="post" className={mobile ? "mt-2 space-y-2" : "space-y-1"}>
      <input type="hidden" name="_action" value="batch-set-manual-conversion" />
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="lineId" value={line.id} />
      <div className={mobile ? "space-y-2" : "flex items-center gap-2"}>
        <DecimalInput
          name="factor"
          defaultValue={0}
          fractionDigits={3}
          onValueChange={(value) => setFactor(Number(value || 0))}
          placeholder={`Ex.: 1 ${originUnit} = 25 ${targetUnit}`}
          className={mobile ? "h-11 w-full rounded-xl" : "h-8 w-32"}
        />
        <Button
          type="submit"
          variant="outline"
          size={mobile ? undefined : "icon"}
          className={mobile ? "h-11 w-full rounded-xl" : "h-8 w-8"}
          disabled={!factorAmount}
        >
          {mobile ? "Salvar conversão" : <Save className="h-4 w-4" />}
        </Button>
      </div>
      <div className={mobile ? "space-y-1 text-xs text-slate-500" : "space-y-1 text-[11px] text-slate-500"}>
        <div>{hintText}</div>
        <div>{`Fator de ${targetUnit} por 1 ${originUnit}.`}</div>
        {costPreview ? <div>{costPreview}</div> : null}
      </div>
    </Form>
  );
}
