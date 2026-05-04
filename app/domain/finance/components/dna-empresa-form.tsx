import { useCallback, useEffect, useMemo, useState } from "react";
import { DecimalInput } from "~/components/inputs/inputs";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";

// Tipagens
export type DnaValues = {
  faturamentoBrutoAmount?: number | string | null;
  custoFixoAmount?: number | string | null;
  taxaCartaoPerc?: number | string | null;
  impostoPerc?: number | string | null;
  investimentoPerc?: number | string | null;
  wastePerc?: number | string | null;
  custoVariavelPerc?: number | string | null; // NOVO: só persistência
  dnaPerc?: number | string | null; // somente leitura na UI
};

export type DnaFieldHistorySummary = {
  latest?: number | null;
  avg3?: number | null;
  avg6?: number | null;
  latestReferenceLabel?: string | null;
  kind: "money" | "percent";
  note?: string | null;
};

export type DnaFieldHistory = Partial<Record<keyof DnaValues, DnaFieldHistorySummary>>;

type Errors = Partial<Record<keyof DnaValues, string>>;

type Props = {
  defaultValues: DnaValues;
  errors?: Errors;
  onAnyFieldChange?: () => void;
  readOnlyCalculated?: boolean; // controla o dnaPerc (readonly)
  className?: string;
  fieldHistory?: DnaFieldHistory;
};

export default function DnaEmpresaForm({
  defaultValues,
  errors,
  onAnyFieldChange,
  readOnlyCalculated = true,
  className,
  fieldHistory,
}: Props) {
  const [formValues, setFormValues] = useState<DnaValues>(defaultValues);

  useEffect(() => {
    setFormValues(defaultValues);
  }, [defaultValues]);

  const updateFieldValue = useCallback((field: keyof DnaValues, value: number) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    onAnyFieldChange?.();
  }, [onAnyFieldChange]);

  const fillOptions = useMemo(() => {
    return [
      {
        key: "latest" as const,
        label: fieldHistory?.faturamentoBrutoAmount?.latestReferenceLabel
          ? `Preencher com ultimo (${fieldHistory.faturamentoBrutoAmount.latestReferenceLabel})`
          : "Preencher com ultimo",
      },
      { key: "avg3" as const, label: "Preencher com medio 3m" },
      { key: "avg6" as const, label: "Preencher com medio 6m" },
    ];
  }, [fieldHistory]);

  const applyFillOption = useCallback((kind: "latest" | "avg3" | "avg6") => {
    setFormValues((current) => {
      const next = { ...current };
      const entries: Array<keyof DnaValues> = [
        "faturamentoBrutoAmount",
        "custoFixoAmount",
        "taxaCartaoPerc",
        "impostoPerc",
        "investimentoPerc",
        "wastePerc",
        "dnaPerc",
        "custoVariavelPerc",
      ];

      entries.forEach((field) => {
        const summary = fieldHistory?.[field];
        if (!summary) return;
        const candidate = summary[kind];
        if (candidate == null || Number.isNaN(candidate)) return;
        next[field] = candidate;
      });

      return next;
    });
    onAnyFieldChange?.();
  }, [fieldHistory, onAnyFieldChange]);

  return (
    <div className={"mx-auto w-full max-w-3xl " + (className ?? "")}>
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">DNA da Empresa</h3>
          <p className="text-sm text-muted-foreground">
            A percentagem do DNA (%) deve ser embutida no preço de venda do produto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {fillOptions.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant="outline"
              className="h-8 text-xs text-black"
              onClick={() => applyFillOption(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator className="my-4" />

      {/* --- BLOCO: Valores (R$) --- */}
      <div className="space-y-6">
        <FieldBlock history={fieldHistory?.faturamentoBrutoAmount}>
          <Row>
            <Label>
              <div className="flex items-center gap-2">
                <span>Faturamento Bruto (R$)</span>
              </div>
              <span className="block text-xs text-muted-foreground mt-1">Média (ex.: 4–6 meses)</span>
            </Label>
            <Field error={errors?.faturamentoBrutoAmount}>
              <DecimalInput
                key={`faturamentoBrutoAmount-${formValues.faturamentoBrutoAmount ?? 0}`}
                name="faturamentoBrutoAmount"
                defaultValue={formValues.faturamentoBrutoAmount ?? 0}
                fractionDigits={2}
                className="w-full"
                onValueChange={(value) => updateFieldValue("faturamentoBrutoAmount", value)}
              />
            </Field>
          </Row>
        </FieldBlock>

        <FieldBlock history={fieldHistory?.custoFixoAmount}>
          <Row>
            <Label>
              <span>Custos Fixos (R$)</span>
            </Label>
            <Field error={errors?.custoFixoAmount}>
              <DecimalInput
                key={`custoFixoAmount-${formValues.custoFixoAmount ?? 0}`}
                name="custoFixoAmount"
                defaultValue={formValues.custoFixoAmount ?? 0}
                fractionDigits={2}
                className="w-full"
                onValueChange={(value) => updateFieldValue("custoFixoAmount", value)}
              />
            </Field>
          </Row>
        </FieldBlock>
      </div>

      <Separator className="my-4" />

      {/* --- BLOCO: Percentuais (%) --- */}
      <div className="space-y-5">
        <FieldBlock history={fieldHistory?.taxaCartaoPerc}>
          <Row>
            <Label>
              <span>Taxa de Cartão (%)</span>
            </Label>
            <Field error={errors?.taxaCartaoPerc}>
              <DecimalInput
                key={`taxaCartaoPerc-${formValues.taxaCartaoPerc ?? 0}`}
                name="taxaCartaoPerc"
                defaultValue={formValues.taxaCartaoPerc ?? 0}
                fractionDigits={2}
                className="w-full"
                onValueChange={(value) => updateFieldValue("taxaCartaoPerc", value)}
              />
            </Field>
          </Row>
        </FieldBlock>

        <FieldBlock history={fieldHistory?.impostoPerc}>
          <Row>
            <Label>
              <span>Impostos (%)</span>
            </Label>
            <Field error={errors?.impostoPerc}>
              <DecimalInput
                key={`impostoPerc-${formValues.impostoPerc ?? 0}`}
                name="impostoPerc"
                defaultValue={formValues.impostoPerc ?? 0}
                fractionDigits={2}
                className="w-full"
                onValueChange={(value) => updateFieldValue("impostoPerc", value)}
              />
            </Field>
          </Row>
        </FieldBlock>

        <FieldBlock history={fieldHistory?.investimentoPerc}>
          <Row>
            <Label>
              <span>Investimentos (%)</span>
            </Label>
            <Field error={errors?.investimentoPerc}>
              <DecimalInput
                key={`investimentoPerc-${formValues.investimentoPerc ?? 0}`}
                name="investimentoPerc"
                defaultValue={formValues.investimentoPerc ?? 0}
                fractionDigits={2}
                className="w-full"
                onValueChange={(value) => updateFieldValue("investimentoPerc", value)}
              />
            </Field>
          </Row>
        </FieldBlock>

        <FieldBlock history={fieldHistory?.wastePerc}>
          <Row>
            <Label>
              <span>Perdas/Waste (%)</span>
            </Label>
            <Field error={errors?.wastePerc}>
              <DecimalInput
                key={`wastePerc-${formValues.wastePerc ?? 0}`}
                name="wastePerc"
                defaultValue={formValues.wastePerc ?? 0}
                fractionDigits={2}
                className="w-full"
                onValueChange={(value) => updateFieldValue("wastePerc", value)}
              />
            </Field>
          </Row>
        </FieldBlock>


      </div>

      <Separator className="my-4" />

      {/* --- BLOCO: DNA (%) calculado --- */}
      <div className="space-y-5">
        <FieldBlock history={fieldHistory?.dnaPerc}>
          <Row>
            <Label>
              <span className="font-semibold">DNA (%)</span>
            </Label>
            <Field error={errors?.dnaPerc}>
              <DecimalInput
                key={`dnaPerc-${formValues.dnaPerc ?? 0}`}
                name="dnaPerc"
                defaultValue={formValues.dnaPerc ?? 0}
                fractionDigits={2}
                className="w-full border-none bg-slate-100 font-semibold text-lg"
                readOnly={readOnlyCalculated}
                disabled={readOnlyCalculated}
                onValueChange={(value) => updateFieldValue("dnaPerc", value)}
              />
            </Field>
          </Row>
        </FieldBlock>
      </div>

      <Separator className="my-6" />

      <div className="space-y-5">

        <p>Os valores abaixos não inficiam no calculo do DNA</p>

        {/* NOVO: Custos Variável (%) — não participa do cálculo do DNA */}
        <FieldBlock history={fieldHistory?.custoVariavelPerc}>
          <Row>
            <Label>
              <span>Custos Variável (%)</span>
            </Label>
            <Field error={errors?.custoVariavelPerc}>
              <DecimalInput
                key={`custoVariavelPerc-${formValues.custoVariavelPerc ?? 0}`}
                name="custoVariavelPerc"
                defaultValue={formValues.custoVariavelPerc ?? 0}
                fractionDigits={2}
                className="w-full"
                onValueChange={(value) => updateFieldValue("custoVariavelPerc", value)}
              />
            </Field>
          </Row>
        </FieldBlock>
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

function FieldBlock({
  children,
  history,
}: {
  children: React.ReactNode;
  history?: DnaFieldHistorySummary;
}) {
  return (
    <div className="space-y-3">
      {children}
      <FieldHistoryHint summary={history} />
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

function FieldHistoryHint({
  summary,
}: {
  summary?: DnaFieldHistorySummary;
}) {
  if (!summary) return null;

  const parts = [
    {
      label: summary.latestReferenceLabel
        ? `Ultimo (${summary.latestReferenceLabel})`
        : "Ultimo",
      value: summary.latest,
    },
    { label: "Medio 3m", value: summary.avg3 },
    { label: "Medio 6m", value: summary.avg6 },
  ];
  const hasNumericValues = parts.some((part) => part.value != null && !Number.isNaN(part.value));

  return (
    <div className="space-y-2">

      {hasNumericValues ? (
        <div className="px-3 py-0 text-xs text-black">
          {parts.map((part) => `${part.label}: ${formatHistoryValue(part.value, summary.kind)}`).join(" · ")}
        </div>
      ) : null}
      {summary.note ? (
        <div className="px-3 py-0 text-xs text-black">
          <span className="block text-xs text-black">{summary.note}</span>
        </div>
      ) : null}

    </div>
  );
}

function formatHistoryValue(value: number | null | undefined, kind: DnaFieldHistorySummary["kind"]) {
  if (value == null || Number.isNaN(value)) return "—";

  if (kind === "money") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return `${value.toFixed(2)}%`;
}
