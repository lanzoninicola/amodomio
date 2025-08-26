import { useCallback } from "react";
import { DecimalInput } from "~/components/inputs/inputs";
import { Separator } from "~/components/ui/separator";

// Tipagens
export type DnaValues = {
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
  className?: string;
};

export default function DnaEmpresaForm({
  defaultValues,
  errors,
  onAnyFieldChange,
  readOnlyCalculated = true,
  className,
}: Props) {
  const handleChange = useCallback(() => {
    onAnyFieldChange?.();
  }, [onAnyFieldChange]);

  return (
    <div className={"mx-auto w-full max-w-3xl " + (className ?? "")}> {/* NÃO full-width */}
      <div className="space-y-1">
        <h3 className="font-semibold">DNA da Empresa</h3>
        <p className="text-sm text-muted-foreground">
          A percentagem do DNA (%) deve ser embutida no preço de venda do produto.
        </p>
      </div>

      <Separator className="my-4" />

      {/* --- BLOCO: Valores (R$) --- */}
      <div className="space-y-3">
        <Row>
          <Label>
            <div className="flex items-center gap-2">
              <span>Faturamento Bruto (R$)</span>
            </div>
            <span className="block text-xs text-muted-foreground mt-1">Média (ex.: 4–6 meses)</span>
          </Label>
          <Field error={errors?.faturamentoBrutoAmount}>
            <DecimalInput
              name="faturamentoBrutoAmount"
              defaultValue={defaultValues.faturamentoBrutoAmount ?? 0}
              fractionDigits={2}
              className="w-full"
              onChange={handleChange}
            />
          </Field>
        </Row>

        <Row>
          <Label>Custos Fixos (R$)</Label>
          <Field error={errors?.custoFixoAmount}>
            <DecimalInput
              name="custoFixoAmount"
              defaultValue={defaultValues.custoFixoAmount ?? 0}
              fractionDigits={2}
              className="w-full"
              onChange={handleChange}
            />
          </Field>
        </Row>
      </div>

      <Separator className="my-4" />

      {/* --- BLOCO: Percentuais (%) --- */}
      <div className="space-y-3">
        <Row>
          <Label>Taxa de Cartão (%)</Label>
          <Field error={errors?.taxaCartaoPerc}>
            <DecimalInput
              name="taxaCartaoPerc"
              defaultValue={defaultValues.taxaCartaoPerc ?? 0}
              fractionDigits={2}
              className="w-full"
              onChange={handleChange}
            />
          </Field>
        </Row>

        <Row>
          <Label>Impostos (%)</Label>
          <Field error={errors?.impostoPerc}>
            <DecimalInput
              name="impostoPerc"
              defaultValue={defaultValues.impostoPerc ?? 0}
              fractionDigits={2}
              className="w-full"
              onChange={handleChange}
            />
          </Field>
        </Row>

        <Row>
          <Label>Perdas/Waste (%)</Label>
          <Field error={errors?.wastePerc}>
            <DecimalInput
              name="wastePerc"
              defaultValue={defaultValues.wastePerc ?? 0}
              fractionDigits={2}
              className="w-full"
              onChange={handleChange}
            />
          </Field>
        </Row>
      </div>

      <Separator className="my-4" />

      {/* --- BLOCO: DNA (%) calculado --- */}
      <div className="space-y-3">
        <Row>
          <Label>
            <span className="font-semibold">DNA (%)</span>
          </Label>
          <Field error={errors?.dnaPerc}>
            <DecimalInput
              name="dnaPerc"
              defaultValue={defaultValues.dnaPerc ?? 0}
              fractionDigits={2}
              className="w-full border-none bg-slate-100 font-semibold text-lg"
              readOnly={readOnlyCalculated}
              disabled={readOnlyCalculated}
              onChange={handleChange}
            />
          </Field>
        </Row>
      </div>
    </div>
  );
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

function Field({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div>
      {children}
      {error && <span className="text-red-500 text-xs mt-1 block">{error}</span>}
    </div>
  );
}
