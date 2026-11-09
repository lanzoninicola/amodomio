export interface AiqfomePrice {
  preco: string;
  preco_original: string | null;
}

export interface AiqfomeItem {
  nome: string;
  descricao: string | null;
  precos_por_tamanho: Record<string, AiqfomePrice>;
}

export interface AiqfomeSection {
  categoria: string;
  itens: AiqfomeItem[];
}

export interface AiqfomeRestaurant {
  nome: string;
  url: string;
  categorias: AiqfomeSection[];
  combos: AiqfomeSection[];
}

export interface AiqfomeResult {
  metadata: {
    cidade: string;
    fonte: string;
    data_coleta: string;
    total_incluidos: number;
    total_excluidos: number;
    filtro_categorias_alvo: string[];
  };
  restaurantes: AiqfomeRestaurant[];
  excluidos: unknown[];
}

export type CompetitorMenuSearchResult = {
  restaurant: string;
  restaurantUrl: string;
  section: string;
  sectionType: "Cardápio" | "Combo";
  item: string;
  description: string | null;
  prices: { size: string; price: string; originalPrice: string | null }[];
};

export type CompetitorMenuDashboard = {
  totalProducts: number;
  competitorCount: number;
  priceOfferCount: number;
  promotionCount: number;
  averagePrice: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  topCompetitors: Array<{ name: string; count: number }>;
  topSizes: Array<{ name: string; count: number }>;
  topSections: Array<{ name: string; count: number }>;
};

export type OwnMenuPricePosition = "below-market" | "market" | "above-market" | "no-market-data";

export type OwnMenuComparison = {
  matchedOwnItemCount: number;
  unmatchedCompetitorProductCount: number;
  belowMarketCount: number;
  marketCount: number;
  aboveMarketCount: number;
  items: Array<{
    ownItemId: string;
    ownItemName: string;
    competitorProductCount: number;
    competitorCount: number;
    variations: Array<{
      sizeKey: string;
      sizeName: string;
      ownPrice: number;
      marketOfferCount: number;
      marketMinimum: number | null;
      marketAverage: number | null;
      marketMaximum: number | null;
      differenceFromAveragePerc: number | null;
      position: OwnMenuPricePosition;
    }>;
  }>;
  opportunities: Array<{
    productName: string;
    competitorCount: number;
    offerCount: number;
  }>;
};

export const normalizeCompetitorMenuText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const formatCompetitorMenuDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

export function isAiqfomeResult(value: unknown): value is AiqfomeResult {
  const payload = value as Partial<AiqfomeResult> | null;
  const metadata = payload?.metadata;
  return Boolean(
    metadata &&
      typeof metadata.cidade === "string" &&
      typeof metadata.fonte === "string" &&
      typeof metadata.data_coleta === "string" &&
      Array.isArray(metadata.filtro_categorias_alvo) &&
      Array.isArray(payload?.restaurantes) &&
      Array.isArray(payload?.excluidos)
  );
}

export function searchCompetitorMenuSnapshot(
  payload: AiqfomeResult,
  query: string,
  competitor = "",
  includeAll = false
): CompetitorMenuSearchResult[] {
  if (!query && !competitor && !includeAll) return [];
  const normalizedQuery = normalizeCompetitorMenuText(query);
  const results: CompetitorMenuSearchResult[] = [];

  for (const restaurant of payload.restaurantes) {
    if (competitor && restaurant.nome !== competitor) continue;

    const sectionGroups: Array<{
      type: CompetitorMenuSearchResult["sectionType"];
      sections: AiqfomeSection[];
    }> = [
      {
        type: "Cardápio",
        sections: Array.isArray(restaurant.categorias) ? restaurant.categorias : [],
      },
      {
        type: "Combo",
        sections: Array.isArray(restaurant.combos) ? restaurant.combos : [],
      },
    ];

    for (const group of sectionGroups) {
      for (const section of group.sections) {
        for (const item of Array.isArray(section.itens) ? section.itens : []) {
          const searchable = normalizeCompetitorMenuText(`${item.nome ?? ""} ${item.descricao ?? ""}`);
          if (normalizedQuery && !searchable.includes(normalizedQuery)) continue;

          results.push({
            restaurant: restaurant.nome,
            restaurantUrl: restaurant.url,
            section: section.categoria,
            sectionType: group.type,
            item: item.nome,
            description: item.descricao,
            prices: Object.entries(item.precos_por_tamanho ?? {}).map(([size, price]) => ({
              size,
              price: price?.preco ?? "Preço não informado",
              originalPrice: price?.preco_original ?? null,
            })),
          });
        }
      }
    }
  }

  return results;
}

const parsePrice = (value: string) => {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const rankCounts = (values: string[], limit = 8) =>
  [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>())]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limit);

export function buildCompetitorMenuDashboard(results: CompetitorMenuSearchResult[]): CompetitorMenuDashboard {
  const priceOffers = results.flatMap((result) => result.prices);
  const prices = priceOffers.map((price) => parsePrice(price.price)).filter((price): price is number => price !== null);

  return {
    totalProducts: results.length,
    competitorCount: new Set(results.map((result) => result.restaurant)).size,
    priceOfferCount: priceOffers.length,
    promotionCount: priceOffers.filter((price) => price.originalPrice).length,
    averagePrice: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null,
    minimumPrice: prices.length ? Math.min(...prices) : null,
    maximumPrice: prices.length ? Math.max(...prices) : null,
    topCompetitors: rankCounts(results.map((result) => result.restaurant)),
    topSizes: rankCounts(priceOffers.map((price) => price.size)),
    topSections: rankCounts(results.map((result) => result.section)),
  };
}
