import { prismaIt } from "../../lib/prisma/prisma-it.server";
import { settingPrismaEntity } from "./setting.prisma.entity.server";
import { jsonParse } from "../../utils/json-helper";

export class SettingOptionModel {
  #context: string;
  #name: string;
  #type: string;
  #value: string;

  // Static cache property
  private static cache = new Map<string, SettingOptionModel>();

  get context() {
    return this.#context;
  }

  get name() {
    return this.#name;
  }

  get type() {
    return this.#type;
  }

  get value() {
    if (this.#type === "number") return parseFloat(this.#value);

    if (this.#type === "boolean") {
      return this.#value === "true";
    }

    if (this.#type === "string") return this.#value;

    if (this.#type === "array") {
      return this.#value.split(",").map((item) => item.trim());
    }

    if (this.#type === "object") {
      return JSON.parse(this.#value);
    }

    return this.#value;
  }

  public static async factory(optionName: string, contextName: string) {
    const cacheKey = `${contextName}:${optionName}`;
    // Check if the option is in the cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(optionName);
    }

    const [err, record] = await prismaIt(
      settingPrismaEntity.findByContextAndName(contextName, optionName)
    );

    if (err) return null;

    if (!record || record === null) return null;

    const option = new SettingOptionModel(
      record.context,
      record.name,
      record.type,
      record.value
    );

    // Store the fetched option in the cache
    this.cache.set(cacheKey, option);

    return option;
  }

  constructor(context: string, name: string, type: string, value: string) {
    this.#context = context;
    this.#name = name;
    this.#type = type;
    this.#value = value;
  }
}
