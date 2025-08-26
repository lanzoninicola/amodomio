import { useCallback } from "react";
import { DecimalInput } from "~/components/inputs/inputs";
import { Separator } from "~/components/ui/separator";
// Ajuste este import conforme seu projeto:

type DnaValues = {
  faturamentoBrutoAmount?: number | string | null;
  custoFixoAmount?: number | string | null;
  taxaCartaoPerc?: number | string | null;
  impostoPerc?: number | string | null;
  wastePerc?: number | string | null;
  dnaPerc?: number | string | null; // somente leitura na UI
};

type Errors = Partial<Record<keyof DnaValues, string>>;

type Props = {
  defaultValues: DnaValues;
  errors?: Errors;
  onAnyFieldChange?: () => void;
  readOnlyCalculated?: boolean; // controla o dnaPerc (readonly)
};

export default function DnaEmpresaForm({
  defaultValues,
  errors,
  onAnyFieldChange,
  readOnlyCalculated = true,
}: Props) {
  const handleChange = useCallback(() => {
    onAnyFieldChange?.();
  }, [onAnyFieldChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold">DNA da Empresa</h3>
        <p className="text-sm text-muted-foreground">
          A percentagem do DNA (%) deve ser embutida no preço de venda do produto.
        </p>
      </div>

      <Separator />

      {/* Valores (R$) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Faturamento Bruto (R$)</span>
            <span className="text-xs">Média (ex.: 4–6 meses)</span>
          </div>
          <DecimalInput
            name="faturamentoBrutoAmount"
            defaultValue={defaultValues.faturamentoBrutoAmount ?? 0}
            fractionDigits={2}
            className="w-full"
            onChange={handleChange}
          />
          {errors?.faturamentoBrutoAmount && (
            <span className="text-red-500 text-xs">{errors.faturamentoBrutoAmount}</span>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground">Custos Fixos (R$)</span>
          <DecimalInput
            name="custoFixoAmount"
            defaultValue={defaultValues.custoFixoAmount ?? 0}
            fractionDigits={2}
            className="w-full"
            onChange={handleChange}
          />
          {errors?.custoFixoAmount && (
            <span className="text-red-500 text-xs">{errors.custoFixoAmount}</span>
          )}
        </div>
      </div>

      <Separator />

      {/* Percentuais (%) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <span className="text-muted-foreground">Taxa de Cartão (%)</span>
          <DecimalInput
            name="taxaCartaoPerc"
            defaultValue={defaultValues.taxaCartaoPerc ?? 0}
            fractionDigits={2}
            className="w-full"
            onChange={handleChange}
          />
          {errors?.taxaCartaoPerc && (
            <span className="text-red-500 text-xs">{errors.taxaCartaoPerc}</span>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground">Impostos (%)</span>
          <DecimalInput
            name="impostoPerc"
            defaultValue={defaultValues.impostoPerc ?? 0}
            fractionDigits={2}
            className="w-full"
            onChange={handleChange}
          />
          {errors?.impostoPerc && (
            <span className="text-red-500 text-xs">{errors.impostoPerc}</span>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground">Perdas/Waste (%)</span>
          <DecimalInput
            name="wastePerc"
            defaultValue={defaultValues.wastePerc ?? 0}
            fractionDigits={2}
            className="w-full"
            onChange={handleChange}
          />
          {errors?.wastePerc && (
            <span className="text-red-500 text-xs">{errors.wastePerc}</span>
          )}
        </div>
      </div>

      <Separator />

      {/* DNA (%) calculado - somente leitura por padrão */}
      <div className="space-y-1">
        <span className="text-muted-foreground font-semibold">DNA (%)</span>
        <DecimalInput
          name="dnaPerc"
          defaultValue={defaultValues.dnaPerc ?? 0}
          fractionDigits={2}
          className="w-full border-none bg-slate-100 font-semibold text-lg"
          readOnly={readOnlyCalculated}
          disabled={readOnlyCalculated}
          onChange={handleChange}
        />
        {errors?.dnaPerc && (
          <span className="text-red-500 text-xs">{errors.dnaPerc}</span>
        )}
      </div>
    </div>
  );
}
