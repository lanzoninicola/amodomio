import {
  Category,
  MenuItem,
  MenuItemCostVariation,
  MenuItemImage,
  MenuItemLike,
  MenuItemPriceVariation,
  MenuItemShare,
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
import { CloudinaryUtils } from "~/lib/cloudinary";
import { scale } from "@cloudinary/url-gen/actions/resize";

export interface MenuItemWithAssociations extends MenuItem {
  priceVariations: MenuItemPriceVariation[];
  costVariations: MenuItemCostVariation[];
  categoryId: string;
  Category: Category;
  tags?: {
    all: Tag["name"][];
    public: Tag["name"][];
    models: Tag[];
  };
  MenuItemLike: MenuItemLike[];
  MenuItemTag: MenuItemTag[];
  MenuItemShare: MenuItemShare[];
  MenuItemImage: MenuItemImage;
  likes?: {
    amount: number;
  };
  shares?: number;
  imageTransformedURL: string;
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
    costVariations: {
      include: {
        MenuItemSize: true,
      },
    },
    Category: true,
    tags: {
      include: {
        Tag: true,
      },
    },
    MenuItemLike: {
      where: {
        deletedAt: null,
      },
    },
    MenuItemShare: true,
    MenuItemImage: true,
  };

  client;
  // Simple in-memory cache
  private cache: NodeCache;

  constructor({ client }: PrismaEntityProps) {
    this.client = client;
    this.cache = new NodeCache({ stdTTL: 100, checkperiod: 120 }); // TTL in seconds
  }

  async findAll(
    params: MenuItemEntityFindAllProps = {},
    options = {
      imageTransform: false,
      imageScaleWidth: 1280,
    }
  ) {
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

    const records = recordsFounded.map((r) => {
      return {
        ...r,
        imageTransformedURL: CloudinaryUtils.scaleWidth(
          r.MenuItemImage?.publicId || "",
          {
            width: options.imageScaleWidth,
          }
        ),
        tags: {
          all: r.tags.map((t) => t.Tag?.name),
          public: r.tags
            .filter((t) => t.Tag?.public === true)
            .map((t) => t.Tag?.name),
          models: r.tags.map((t) => t.Tag),
        },
        likes: {
          amount: r.MenuItemLike.length,
        },
        shares: r.MenuItemShare.length,
      };
    });

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

  async findAllGroupedByCategory(
    params: MenuItemEntityFindAllProps = {},
    options = {
      imageTransform: false,
      imageScaleWidth: 1280,
    }
  ) {
    // Use the existing findAll function to fetch records
    const allMenuItems = (await this.findAll(params, options)) || [];

    // Group records by category in memory
    const groupedByCategory = allMenuItems.reduce((acc, menuItem) => {
      const categoryName = menuItem.Category?.name || "Sem categoria";

      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }

      // @ts-ignore
      acc[categoryName].push(menuItem);

      return acc;
    }, {} as Record<string, MenuItemWithAssociations[]>);

    // Convert to an ordered array of categories
    return Object.keys(groupedByCategory)
      .sort() // Sort categories alphabetically; customize as needed
      .map((categoryName) => ({
        category: categoryName,
        menuItems: groupedByCategory[categoryName],
      }));
  }

  async findById(
    id: string,
    options = {
      imageScaleWidth: 1280,
    }
  ) {
    const item = await this.client.menuItem.findFirst({
      where: { id },
      include: this.#menuItemQueryIncludes,
    });

    if (!item) {
      return null;
    }

    return {
      ...item,
      // imageURL: CloudinaryUtils.scaleWidth("livhax0d1aiiszxqgpc6", {
      //   width: options.imageScaleWidth,
      // }),
      imageTransformedURL: CloudinaryUtils.scaleWidth(
        item.MenuItemImage?.publicId || "",
        {
          width: options.imageScaleWidth,
        }
      ),
      tags: {
        all: item.tags.map((t) => t.Tag?.name),
        public: item.tags
          .filter((t) => t.Tag?.public === true)
          .map((t) => t.Tag?.name),
        models: item.tags.map((t) => t.Tag),
      },
      likes: {
        amount: item.MenuItemLike.length,
      },
      shares: item.MenuItemShare.length,
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

  async associateTag(itemId: string, tag: Tag) {
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
