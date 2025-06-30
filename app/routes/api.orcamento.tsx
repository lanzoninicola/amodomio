import { MenuItemSize } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { cache } from "~/domain/cache/cache-manager.server";

import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { bairroEntity, BairroWithFeeAndDistance } from "~/domain/delivery/bairro.entity.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import getSearchParam from "~/utils/get-search-param";
import { badRequest, noContent, ok } from "~/utils/http-response.server";

type MenuItemPriceSummary = {
  menuItemId: string;
  name: string;
  ingredients: string;
  groupName?: string;
  priceAmount: number;
  previousPriceAmount: number;
  discountPercentage: number;
  profitActualPerc: number;
  profitExpectedPerc: number;
  priceExpectedAmount: number;
};


export async function loader({ request, params }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return noContent(undefined, {
      cors: true,
      corsOrigin: "*"
    });
  }

  const { success, retryIn } = await restApi.rateLimitCheck(request);

  if (!success) {
    const seconds = retryIn ? Math.ceil(retryIn / 1000) : 60;
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(seconds) },
    });
  }

  const invalidateCacheSearchParam = getSearchParam({ request, paramName: "invalidate-cache" })

  if (invalidateCacheSearchParam === "true") {
    cache.invalidate();
  }

  const apiKey = request.headers.get("x-api-key");
  const authResp = restApi.authorize(apiKey);
  if (authResp.status >= 399) {
    return badRequest(authResp.message);
  }

  const mapKey = "menu-item-price-summary";
  const sizesKey = "menu-item-sizes";
  const bairrosKey = "delivery-bairros";

  const cachedMap = cache.get<Record<string, MenuItemPriceSummary[]>>(mapKey);
  const cachedSizes = cache.get<MenuItemSize[]>(sizesKey);
  const cachedBairros = cache.get<BairroWithFeeAndDistance[]>(bairrosKey);

  // Se tudo estiver em cache, retorna direto
  if (cachedMap && cachedSizes && cachedBairros) {
    return ok({
      options: cachedMap,
      sizes: cachedSizes.filter(size => size.key !== "pizza-slice"),
      bairros: cachedBairros,
    }, {
      cors: true,
      corsOrigin: "*",
    });
  }

  // Processa apenas o que não está em cache
  const items = await menuItemPrismaEntity.findManyWithSellPriceVariations(
    { where: { active: true } },
    "cardapio",
    { includeAuditRecords: false }
  );

  const map: Record<string, MenuItemPriceSummary[]> = {};

  for (const item of items) {
    for (const variation of item.sellPriceVariations) {
      const sizeKey = variation.sizeKey;
      if (!sizeKey) continue;

      const entry: MenuItemPriceSummary = {
        menuItemId: item.menuItemId,
        name: item.name,
        ingredients: item.ingredients || "",
        groupName: item.group?.name ?? undefined,
        priceAmount: variation.priceAmount,
        previousPriceAmount: variation.previousPriceAmount,
        discountPercentage: variation.discountPercentage,
        profitActualPerc: variation.profitActualPerc,
        profitExpectedPerc: variation.profitExpectedPerc,
        priceExpectedAmount: variation.priceExpectedAmount,
      };

      if (!map[sizeKey]) map[sizeKey] = [];
      map[sizeKey].push(entry);
    }
  }

  delete map["pizza-slice"];

  const sizesRaw = cachedSizes ?? await menuItemSizePrismaEntity.findAll();
  const bairros = cachedBairros ?? await bairroEntity.findManyWithFees();

  // Armazena em cache
  cache.set(mapKey, map);
  if (!cachedSizes) cache.set(sizesKey, sizesRaw);
  if (!cachedBairros) cache.set(bairrosKey, bairros);

  return ok({
    options: map,
    sizes: sizesRaw.filter(size => size.key !== "pizza-slice"),
    bairros,
  }, {
    cors: true,
    corsOrigin: "*",
  });
}