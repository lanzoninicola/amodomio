export type BrazilSocioeconomicClassCode = "A+" | "A" | "B" | "C" | "D" | "E";

export type PriceSensitivityLevel =
  | "Muito baixa"
  | "Baixa"
  | "Média"
  | "Alta"
  | "Muito alta"
  | "Extremamente alta";

export type PurchaseMotivation =
  | "Exclusividade, luxo, status"
  | "Qualidade superior, marca"
  | "Qualidade com bom custo-benefício"
  | "Preço acessível, utilidade"
  | "Necessidade básica"
  | "Sobrevivência, preço mínimo";

export type BrazilSocioeconomicClass = {
  code: BrazilSocioeconomicClassCode;
  familyIncomeRangeLabel: string;
  familyIncomeMin: number | null;
  familyIncomeMax: number | null;
  priceSensitivity: PriceSensitivityLevel;
  purchaseMotivation: PurchaseMotivation;
};

export const BRAZIL_SOCIOECONOMIC_CLASSES: readonly BrazilSocioeconomicClass[] = [
  {
    code: "A+",
    familyIncomeRangeLabel: "acima de ~30.000",
    familyIncomeMin: 30000.01,
    familyIncomeMax: null,
    priceSensitivity: "Muito baixa",
    purchaseMotivation: "Exclusividade, luxo, status",
  },
  {
    code: "A",
    familyIncomeRangeLabel: "~15.000 - 30.000",
    familyIncomeMin: 15000.01,
    familyIncomeMax: 30000,
    priceSensitivity: "Baixa",
    purchaseMotivation: "Qualidade superior, marca",
  },
  {
    code: "B",
    familyIncomeRangeLabel: "~7.000 - 15.000",
    familyIncomeMin: 7000.01,
    familyIncomeMax: 15000,
    priceSensitivity: "Média",
    purchaseMotivation: "Qualidade com bom custo-benefício",
  },
  {
    code: "C",
    familyIncomeRangeLabel: "~3.000 - 7.000",
    familyIncomeMin: 3000.01,
    familyIncomeMax: 7000,
    priceSensitivity: "Alta",
    purchaseMotivation: "Preço acessível, utilidade",
  },
  {
    code: "D",
    familyIncomeRangeLabel: "~1.500 - 3.000",
    familyIncomeMin: 1500.01,
    familyIncomeMax: 3000,
    priceSensitivity: "Muito alta",
    purchaseMotivation: "Necessidade básica",
  },
  {
    code: "E",
    familyIncomeRangeLabel: "até ~1.500",
    familyIncomeMin: null,
    familyIncomeMax: 1500,
    priceSensitivity: "Extremamente alta",
    purchaseMotivation: "Sobrevivência, preço mínimo",
  },
] as const;

export function listBrazilSocioeconomicClasses() {
  return BRAZIL_SOCIOECONOMIC_CLASSES;
}

export function getBrazilSocioeconomicClass(
  code: BrazilSocioeconomicClassCode
) {
  return BRAZIL_SOCIOECONOMIC_CLASSES.find((item) => item.code === code) ?? null;
}

export function resolveBrazilSocioeconomicClassByFamilyIncome(
  familyIncome: number | null | undefined
) {
  if (familyIncome == null || Number.isNaN(familyIncome) || familyIncome < 0) {
    return null;
  }

  return (
    BRAZIL_SOCIOECONOMIC_CLASSES.find((item) => {
      const min = item.familyIncomeMin ?? Number.NEGATIVE_INFINITY;
      const max = item.familyIncomeMax ?? Number.POSITIVE_INFINITY;

      return familyIncome >= min && familyIncome <= max;
    }) ?? null
  );
}
