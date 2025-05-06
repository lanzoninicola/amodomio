// CacheManager.ts
import NodeCache from "node-cache";

export class CacheManager {
  private cache: NodeCache;

  constructor(ttlSeconds = 60, checkPeriodSeconds = 30) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: checkPeriodSeconds,
    });
  }

  get<T>(key: string): T | undefined {
    let result = this.cache.get<T>(key);

    if (result === undefined) {
      console.log(`Cache miss for key: ${key}`);
    }

    console.log("cache hit", key);
    return result;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
    console.log("Cache set", key);
  }

  invalidate(): void {
    this.cache.flushAll();
    console.log("Cache invalidated");
  }

  delete(key: string): void {
    this.cache.del(key);
  }
}
