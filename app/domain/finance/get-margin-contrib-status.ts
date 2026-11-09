export type MarginContribTier = "excellent" | "healthy" | "sensitive" | "belowIdeal";

export type MarginContribStatus = {
  tier: MarginContribTier;
  label: string;
  note: string;
  valueTone: string;
  noteTone: string;
  badgeTone: "good" | "warn" | "bad";
  kpiTone: "positive" | "neutral" | "negative";
};

export function getMarginContribStatus(percent: number | null | undefined): MarginContribStatus | null {
  if (percent == null || Number.isNaN(percent)) return null;

  if (percent > 60) {
    return {
      tier: "excellent",
      label: "Excelente",
      note: "Excelente",
      valueTone: "text-emerald-800",
      noteTone: "text-emerald-800",
      badgeTone: "good",
      kpiTone: "positive",
    };
  }

  if (percent >= 50) {
    return {
      tier: "healthy",
      label: "Zona saudável",
      note: "Zona saudável",
      valueTone: "text-foreground",
      noteTone: "text-foreground",
      badgeTone: "good",
      kpiTone: "positive",
    };
  }

  if (percent >= 45) {
    return {
      tier: "sensitive",
      label: "Operação sensível",
      note: "Operação sensível - promoções e descontos são arriscados",
      valueTone: "text-amber-700",
      noteTone: "text-amber-700",
      badgeTone: "warn",
      kpiTone: "neutral",
    };
  }

  return {
    tier: "belowIdeal",
    label: "Abaixo do ideal",
    note: "Abaixo do ideal",
    valueTone: "text-red-700",
    noteTone: "text-red-700",
    badgeTone: "bad",
    kpiTone: "negative",
  };
}
