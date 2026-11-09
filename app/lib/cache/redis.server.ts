import Redis from "ioredis";

declare global {
  var __redisClient__: Redis | undefined;
  var __redisUnavailableUntil__: number | undefined;
}

const REDIS_COMMAND_TIMEOUT_MS = Number(
  process.env.REDIS_COMMAND_TIMEOUT_MS ?? 250
);
const REDIS_UNAVAILABLE_COOLDOWN_MS = Number(
  process.env.REDIS_UNAVAILABLE_COOLDOWN_MS ?? 30_000
);

function markRedisUnavailable(error: unknown) {
  const cooldownMs = Number.isFinite(REDIS_UNAVAILABLE_COOLDOWN_MS)
    ? Math.max(1_000, REDIS_UNAVAILABLE_COOLDOWN_MS)
    : 30_000;
  globalThis.__redisUnavailableUntil__ = Date.now() + cooldownMs;

  if (globalThis.__redisClient__) {
    globalThis.__redisClient__.disconnect();
    globalThis.__redisClient__ = undefined;
  }

  console.error("[redis] unavailable, using source fallback", error);
}

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined;

  if (
    globalThis.__redisUnavailableUntil__ &&
    globalThis.__redisUnavailableUntil__ > Date.now()
  ) {
    return undefined;
  }

  globalThis.__redisUnavailableUntil__ = undefined;

  if (globalThis.__redisClient__?.status === "end") {
    globalThis.__redisClient__ = undefined;
  }

  if (!globalThis.__redisClient__) {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1200,
      commandTimeout: Number.isFinite(REDIS_COMMAND_TIMEOUT_MS)
        ? Math.max(50, REDIS_COMMAND_TIMEOUT_MS)
        : 250,
      keepAlive: 10_000,
      enableAutoPipelining: true,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(100 * times, 300);
      },
    });

    client.on("error", (error) => {
      markRedisUnavailable(error);
    });

    client.once("end", () => {
      if (globalThis.__redisClient__ === client) {
        globalThis.__redisClient__ = undefined;
      }
    });

    globalThis.__redisClient__ = client;
  }

  return globalThis.__redisClient__;
}

export async function redisGetJson<T>(key: string): Promise<T | undefined> {
  const client = getRedisClient();
  if (!client) return undefined;

  let result: string | null;
  try {
    result = await client.get(key);
  } catch (error) {
    markRedisUnavailable({ key, error });
    return undefined;
  }

  if (!result) return undefined;

  try {
    return JSON.parse(result) as T;
  } catch (error) {
    console.error("[redis] invalid JSON payload", { key, error });
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
  const ttl = Number.isFinite(ttlSeconds)
    ? Math.max(1, Math.floor(ttlSeconds))
    : 60;
  try {
    await client.set(key, serialized, "EX", ttl);
  } catch (error) {
    markRedisUnavailable({ key, error });
  }
}

export async function redisDel(key: string) {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    markRedisUnavailable({ key, error });
  }
}

export async function redisGetString(key: string): Promise<string | undefined> {
  const client = getRedisClient();
  if (!client) return undefined;

  try {
    const result = await client.get(key);
    return result ?? undefined;
  } catch (error) {
    markRedisUnavailable({ key, error });
    return undefined;
  }
}

export async function redisSetString(key: string, value: string) {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(key, value);
  } catch (error) {
    markRedisUnavailable({ key, error });
  }
}

export async function redisSetStringEx(
  key: string,
  value: string,
  ttlSeconds: number
) {
  const client = getRedisClient();
  if (!client) return;

  const ttl = Number.isFinite(ttlSeconds)
    ? Math.max(1, Math.floor(ttlSeconds))
    : 60;

  try {
    await client.set(key, value, "EX", ttl);
  } catch (error) {
    markRedisUnavailable({ key, error });
  }
}
