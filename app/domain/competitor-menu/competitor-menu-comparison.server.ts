import prismaClient from "~/lib/prisma/client.server";
import {
  type CompetitorMenuSearchResult,
  type OwnMenuComparison,
  type OwnMenuPricePosition,
  normalizeCompetitorMenuText,
} from "./competitor-menu-analysis";

const parsePrice = (value: string) => {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const canonicalSize = (value: string) => {
  const normalized = normalizeCompetitorMenuText(value);
  if (/\b(broto|mini|individual|pequena|pequeno|small)\b/.test(normalized)) return "small";
  if (/\b(media|medio|medium)\b/.test(normalized)) return "medium";
  if (/\b(familia|familiar|gigante|extra grande|extra large)\b/.test(normalized)) return "family";
  if (/\b(grande|big|large)\b/.test(normalized)) return "big";
  return normalized;
};

const getPosition = (ownPrice: number, marketAverage: number | null): OwnMenuPricePosition => {
  if (!marketAverage) return "no-market-data";
  if (ownPrice < marketAverage * 0.95) return "below-market";
  if (ownPrice > marketAverage * 1.05) return "above-market";
  return "market";
};

export async function buildOwnMenuComparison(results: CompetitorMenuSearchResult[]): Promise<OwnMenuComparison> {
  const db = prismaClient as any;
  const ownItems = await db.item.findMany({
    where: {
      active: true,
      canSell: true,
      ItemSellingChannelItem: {
        some: {
          visible: true,
          ItemSellingChannel: { key: "cardapio" },
        },
      },
      ItemSellingPriceVariation: {
        some: {
          priceAmount: { gt: 0 },
          ItemSellingChannel: { key: "cardapio" },
        },
      },
    },
    select: {
      id: true,
      name: true,
      ItemSellingInfo: {
        select: { upcoming: true },
      },
      ItemSellingPriceVariation: {
        where: {
          priceAmount: { gt: 0 },
          ItemSellingChannel: { key: "cardapio" },
        },
        select: {
          id: true,
          priceAmount: true,
          ItemVariation: {
            select: {
              id: true,
              Variation: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const resultsByName = new Map<string, CompetitorMenuSearchResult[]>();

  for (const result of results) {
    const key = normalizeCompetitorMenuText(result.item);
    const current = resultsByName.get(key) ?? [];
    current.push(result);
    resultsByName.set(key, current);
  }

  const matchedNames = new Set<string>();
  const items = ownItems
    .filter((item: any) => item.ItemSellingInfo?.upcoming !== true)
    .flatMap((item: any) => {
      const normalizedName = normalizeCompetitorMenuText(item.name);
      const competitorProducts = resultsByName.get(normalizedName) ?? [];
      if (!competitorProducts.length) return [];
      matchedNames.add(normalizedName);

      const marketPricesBySize = new Map<string, number[]>();
      for (const product of competitorProducts) {
        for (const price of product.prices) {
          const amount = parsePrice(price.price);
          if (amount === null) continue;
          const size = canonicalSize(price.size);
          const current = marketPricesBySize.get(size) ?? [];
          current.push(amount);
          marketPricesBySize.set(size, current);
        }
      }

      const variations = item.ItemSellingPriceVariation.map((variation: any) => {
        const sizeKey = String(variation.ItemVariation?.Variation?.code || variation.ItemVariation?.id || "");
        const sizeName = String(variation.ItemVariation?.Variation?.name || sizeKey || "Tamanho");
        const marketPrices = marketPricesBySize.get(canonicalSize(`${sizeKey} ${sizeName}`)) ?? [];
        const marketMinimum = marketPrices.length ? Math.min(...marketPrices) : null;
        const marketMaximum = marketPrices.length ? Math.max(...marketPrices) : null;
        const marketAverage = marketPrices.length
          ? marketPrices.reduce((sum, price) => sum + price, 0) / marketPrices.length
          : null;
        const position = getPosition(variation.priceAmount, marketAverage);

        return {
          sizeKey,
          sizeName,
          ownPrice: variation.priceAmount,
          marketOfferCount: marketPrices.length,
          marketMinimum,
          marketAverage,
          marketMaximum,
          differenceFromAveragePerc: marketAverage
            ? ((variation.priceAmount - marketAverage) / marketAverage) * 100
            : null,
          position,
        };
      });

      return [
        {
          ownItemId: item.id,
          ownItemName: item.name,
          competitorProductCount: competitorProducts.length,
          competitorCount: new Set(competitorProducts.map((product) => product.restaurant)).size,
          variations,
        },
      ];
    })
    .sort((a, b) => b.competitorCount - a.competitorCount || a.ownItemName.localeCompare(b.ownItemName, "pt-BR"));

  const positionCounts = items
    .flatMap((item) => item.variations)
    .reduce(
      (counts, variation) => {
        counts[variation.position] += 1;
        return counts;
      },
      {
        "below-market": 0,
        market: 0,
        "above-market": 0,
        "no-market-data": 0,
      } satisfies Record<OwnMenuPricePosition, number>
    );

  const unmatchedProducts = [...resultsByName.entries()].filter(([name]) => !matchedNames.has(name));
  const opportunities = unmatchedProducts
    .map(([name, products]) => ({
      productName: products[0]?.item ?? name,
      competitorCount: new Set(products.map((product) => product.restaurant)).size,
      offerCount: products.length,
    }))
    .sort((a, b) => b.competitorCount - a.competitorCount || b.offerCount - a.offerCount)
    .slice(0, 20);

  return {
    matchedOwnItemCount: items.length,
    unmatchedCompetitorProductCount: unmatchedProducts.length,
    belowMarketCount: positionCounts["below-market"],
    marketCount: positionCounts.market,
    aboveMarketCount: positionCounts["above-market"],
    items,
    opportunities,
  };
}
