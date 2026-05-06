import { redisDel, redisGetString, redisSetString } from "~/lib/cache/redis.server";

export const CARDAPIO_INDEX_CACHE_KEY = "cardapio:index:v1";
const SELLING_PRICE_HANDLER_CACHE_VERSION_KEY =
  "cardapio:selling-price-handler:version";

export async function invalidateCardapioIndexCache() {
  await redisDel(CARDAPIO_INDEX_CACHE_KEY);
}

export async function getSellingPriceHandlerCacheVersion() {
  const version = await redisGetString(SELLING_PRICE_HANDLER_CACHE_VERSION_KEY);
  return version ?? "1";
}

export async function invalidateSellingPriceHandlerCache() {
  await redisSetString(
    SELLING_PRICE_HANDLER_CACHE_VERSION_KEY,
    `${Date.now()}`
  );
}
