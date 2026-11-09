export type MenuEngineeringQuadrant =
  | "champions"
  | "volume"
  | "potential"
  | "lowPriority";

export type MenuEngineeringTagDisplay = {
  title: string;
  tagName: string;
  colorHEX: string;
};

export const MENU_ENGINEERING_TAG_PREFIX = "Menu Engineering:";

export const MENU_ENGINEERING_QUADRANT_TAGS: Record<
  MenuEngineeringQuadrant,
  MenuEngineeringTagDisplay & {
    note: string;
    sortOrderIndex: number;
    badgeClassName: string;
    fill: string;
    stroke: string;
  }
> = {
  champions: {
    title: "Campeoes",
    tagName: `${MENU_ENGINEERING_TAG_PREFIX} Campeoes`,
    note: "Alta venda + Alto faturamento",
    colorHEX: "#2B8C5F",
    sortOrderIndex: 10,
    badgeClassName: "text-emerald-700 bg-emerald-100",
    fill: "#5AC48B",
    stroke: "#2B8C5F",
  },
  potential: {
    title: "Potenciais",
    tagName: `${MENU_ENGINEERING_TAG_PREFIX} Potenciais`,
    note: "Baixa venda + Alto faturamento",
    colorHEX: "#2563EB",
    sortOrderIndex: 20,
    badgeClassName: "text-blue-700 bg-blue-100",
    fill: "#60A5FA",
    stroke: "#2563EB",
  },
  volume: {
    title: "Volume",
    tagName: `${MENU_ENGINEERING_TAG_PREFIX} Volume`,
    note: "Alta venda + Baixo faturamento",
    colorHEX: "#D97706",
    sortOrderIndex: 30,
    badgeClassName: "text-amber-700 bg-amber-100",
    fill: "#F59E0B",
    stroke: "#D97706",
  },
  lowPriority: {
    title: "Baixa prioridade",
    tagName: `${MENU_ENGINEERING_TAG_PREFIX} Baixa prioridade`,
    note: "Baixa venda + Baixo faturamento",
    colorHEX: "#DC2626",
    sortOrderIndex: 40,
    badgeClassName: "text-rose-700 bg-rose-100",
    fill: "#F87171",
    stroke: "#DC2626",
  },
};

export const MENU_ENGINEERING_TAG_NAMES = Object.values(
  MENU_ENGINEERING_QUADRANT_TAGS
).map((tag) => tag.tagName);

export function resolveMenuEngineeringTag(
  tagName?: string | null,
  colorHEX?: string | null
): MenuEngineeringTagDisplay | null {
  if (!tagName) return null;
  const tag = Object.values(MENU_ENGINEERING_QUADRANT_TAGS).find(
    (candidate) => candidate.tagName === tagName
  );
  if (!tag) return null;
  return {
    title: tag.title,
    tagName: tag.tagName,
    colorHEX: colorHEX || tag.colorHEX,
  };
}
