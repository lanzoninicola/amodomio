import Redis from "ioredis";

declare global {
  var __redisClient__: Redis | undefined;
}

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined;

  if (!globalThis.__redisClient__) {
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1200,
      keepAlive: 10_000,
      enableAutoPipelining: true,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(100 * times, 300);
      },
    });

    client.on("error", (error) => {
      console.error("[redis] client error", error);
    });

    globalThis.__redisClient__ = client;
  }

  return globalThis.__redisClient__;
}

export async function redisGetJson<T>(key: string): Promise<T | undefined> {
  const client = getRedisClient();
  if (!client) return undefined;

  try {
    const result = await client.get(key);
    if (!result) return undefined;
    return JSON.parse(result) as T;
  } catch (error) {
    console.error("[redis] GET failed", { key, error });
    return undefined;
  }
}

export async function redisSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number
) {
  const client = getRedisClient();
  if (!client) return;

  const serialized = JSON.stringify(value);
  const ttl = Number.isFinite(ttlSeconds) ? Math.max(1, Math.floor(ttlSeconds)) : 60;
  try {
    await client.set(key, serialized, "EX", ttl);
  } catch (error) {
    console.error("[redis] SETEX failed", { key, error });
  }
}

export async function redisDel(key: string) {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    console.error("[redis] DEL failed", { key, error });
  }
}

export async function redisGetString(key: string): Promise<string | undefined> {
  const client = getRedisClient();
  if (!client) return undefined;

  try {
    const result = await client.get(key);
    return result ?? undefined;
  } catch (error) {
    console.error("[redis] GET(string) failed", { key, error });
    return undefined;
  }
}

export async function redisSetString(key: string, value: string) {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, value);
  } catch (error) {
    console.error("[redis] SET(string) failed", { key, error });
  }
}
