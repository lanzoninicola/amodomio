import {
  Category,
  MenuItem,
  MenuItemCost,
  MenuItemLike,
  MenuItemPriceVariation,
  MenuItemTag,
  Prisma,
  Tag,
} from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { menuItemTagPrismaEntity } from "./menu-item-tags.prisma.entity.server";
import MenuItemPriceVariationUtility from "./menu-item-price-variations-utility";
import { v4 as uuidv4 } from "uuid";
import items from "./db-mock/items";
import NodeCache from "node-cache";
import { menuItemLikePrismaEntity } from "./menu-item-like.prisma.entity.server";

export interface MenuItemWithAssociations extends MenuItem {
  priceVariations: MenuItemPriceVariation[];
  categoryId: string;
  Category: Category;
  tags?: Tag[];
  MenuItemCost: MenuItemCost[];
  MenuItemLike: MenuItemLike[];
  likes?: {
    amount: number;
  };
}

interface MenuItemEntityFindAllProps {
  where?: Prisma.MenuItemWhereInput;
  option?: {
    sorted?: boolean;
    direction?: "asc" | "desc";
  };
  mock?: boolean;
}

export class MenuItemPrismaEntity {
  #menuItemQueryIncludes = {
    priceVariations: true,
    Category: true,
    tags: true,
    MenuItemCost: true,
    MenuItemLike: true,
  };

  client;
  // Simple in-memory cache
  private cache: NodeCache;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
    this.cache = new NodeCache({ stdTTL: 100, checkperiod: 120 }); // TTL in seconds
  }

  async findAll(params: MenuItemEntityFindAllProps = {}) {
    const cacheKey = `findAll:${JSON.stringify(params)}`;
    let result = this.cache.get<MenuItemWithAssociations[]>(cacheKey);

    if (result) {
      if (typeof result === "string") {
        result = JSON.parse(result);
      }

      // console.log("cache hit", cacheKey);

      return result;
    }

    // console.log("cache miss", cacheKey);

    if (params?.mock) {
      return items;
    }

    const recordsFounded = await this.client.menuItem.findMany({
      where: params?.where,
      include: this.#menuItemQueryIncludes,
    });

    const tags = await this.client.tag.findMany();

    const records = await Promise.all(
      recordsFounded.map(async (r) => {
        const likesAmount = await menuItemLikePrismaEntity.countByMenuItemId(
          r.id
        );

        return {
          ...r,
          tags:
            r?.tags?.map((tag) => tags.find((t) => t.id === tag.tagId)) ||
            ([] as Tag[]),
          likes: {
            amount: likesAmount,
          },
        };
      })
    );

    let returnedRecords: MenuItemWithAssociations[] = [];

    if (records.length === 0) {
      return returnedRecords;
    }

    if (!params?.option?.sorted) {
      // @ts-ignore
      returnedRecords = [...records];
    }

    // @ts-ignore
    returnedRecords = records.sort((a, b) => {
      if (params?.option && params?.option.direction === "asc") {
        return a.sortOrderIndex - b.sortOrderIndex;
      }

      return b.sortOrderIndex - a.sortOrderIndex;
    });

    // this.cache.set(cacheKey, JSON.stringify(returnedRecords));

    // console.log("cache set", cacheKey);
    return returnedRecords;
  }

  async findById(id: string) {
    const items = await this.client.menuItem.findUnique({
      where: { id },
      include: this.#menuItemQueryIncludes,
    });

    const tags = await this.client.tag.findMany();

    return {
      ...items,
      tags: items?.tags?.map((tag) => tags.find((t) => t.id === tag.tagId)),
    };
  }

  async create(data: Prisma.MenuItemCreateInput) {
    const newId = uuidv4();
    data.id = newId;

    const priceVariations =
      MenuItemPriceVariationUtility.calculatePriceVariations(
        data.basePriceAmount,
        newId
      );

    data.priceVariations = {
      createMany: {
        data: priceVariations,
      },
    };

    const lastItem = await this.client.menuItem.findFirst({
      orderBy: { sortOrderIndex: "desc" },
    });

    const lastsortOrderIndex = lastItem?.sortOrderIndex || 0;

    const nextItem = {
      ...data,
      sortOrderIndex: lastsortOrderIndex + 1,
    };

    return await this.client.menuItem.create({ data: nextItem });
  }

  async update(id: string, data: Prisma.MenuItemUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    return await this.client.menuItem.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await this.client.menuItem.delete({ where: { id } });
  }

  async addTag(itemId: string, tag: Tag) {
    return await menuItemTagPrismaEntity.create({
      createdAt: new Date().toISOString(),
      MenuItem: {
        connect: {
          id: itemId,
        },
      },
      Tag: {
        connectOrCreate: {
          where: {
            id: tag.id,
          },
          create: {
            ...tag,
          },
        },
      },
    });
  }

  async hasTag(itemId: string, tagId: string) {
    const tag = await this.client.menuItemTag.findFirst({
      where: {
        tagId,
        menuItemId: itemId,
      },
    });

    return !!tag;
  }

  async removeTag(itemId: string, tagId: string) {
    const tag = await this.client.menuItemTag.findFirst({
      where: {
        tagId,
        menuItemId: itemId,
      },
    });

    if (!tag) {
      return;
    }

    return await this.client.menuItemTag.delete({
      where: {
        id: tag.id,
      },
    });
  }

  async findByTagId(tagId: string) {
    return await this.client.menuItem.findMany({
      where: {
        tags: {
          some: {
            tagId,
          },
        },
      },
    });
  }
}

const menuItemPrismaEntity = new MenuItemPrismaEntity({
  client: prismaClient,
});

export { menuItemPrismaEntity };
