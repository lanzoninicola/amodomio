import type { whereCompoundConditions } from "~/lib/firestore-model/src";
import type { FirestoreModel } from "~/lib/firestore-model/src/lib/firestore-model.server";

import NodeCache from "node-cache";

export class BaseEntity<T> {
  protected model: FirestoreModel<T>;
  // Simple in-memory cache
  private cache: NodeCache;

  constructor(model: FirestoreModel<T>) {
    this.model = model;
    this.cache = new NodeCache({ stdTTL: 100, checkperiod: 120 }); // TTL in seconds
  }

  async findById(id: string): Promise<T | undefined> {
    const cacheKey = `findById:${id}`;
    // Try to get data from cache
    let result = this.cache.get<T>(cacheKey);
    if (result) {
      return result;
    }
    // Cache miss, fetch from Firestore
    result = await this.model.findById(id);
    // Update cache
    this.cache.set(cacheKey, result);
    return result;
  }

  async findOne(conditions: whereCompoundConditions): Promise<T | undefined> {
    const cacheKey = `findOne:${JSON.stringify(conditions)}`;
    let result = this.cache.get<T>(cacheKey);
    if (result) {
      return result;
    }
    result = await this.model.findOne(conditions);
    this.cache.set(cacheKey, result);
    return result;
  }

  async findAll(conditions?: whereCompoundConditions): Promise<T[]> {
    const cacheKey = `findAll:${
      conditions ? JSON.stringify(conditions) : "all"
    }`;
    let result = this.cache.get<T[]>(cacheKey);
    if (result) {
      return result;
    }
    result = conditions
      ? await this.model.whereCompound(conditions)
      : await this.model.findAll();
    this.cache.set(cacheKey, result);
    return result;
  }

  // Invalidate cache on write operations
  protected async save(record: T): Promise<T> {
    this.cache.flushAll(); // You might want to be more selective
    return await this.model.add(record as { [key: string]: any });
  }

  async create(record: T): Promise<T> {
    const result = await this.save(record);
    return result;
  }

  async update(id: string, updatedData: any) {
    const result = await this.model.update(id, updatedData);
    this.cache.del(`findById:${id}`); // Invalidate specific cache entry
    return result;
  }

  protected async _delete(id: string) {
    const result = await this.model.delete(id);
    this.cache.del(`findById:${id}`); // Invalidate specific cache entry
    return result;
  }

  protected validate(record: T) {}
}
