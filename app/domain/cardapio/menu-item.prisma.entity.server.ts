import {
  Category,
  MenuItem,
  MenuItemCostVariation,
  MenuItemImage,
  MenuItemLike,
  MenuItemNote,
  MenuItemPriceVariation,
  MenuItemSellingChannel,
  MenuItemShare,
  MenuItemSize,
  MenuItemTag,
  Prisma,
  Tag,
} from "@prisma/client";
import prismaClient from "~/lib/prisma/client.server";
import { PrismaEntityProps } from "~/lib/prisma/types.server";
import { menuItemTagPrismaEntity } from "./menu-item-tags.prisma.entity.server";
import MenuItemPriceVariationUtility from "./menu-item-price-variations-utility";
import { v4 as uuidv4 } from "uuid";
import { CloudinaryUtils } from "~/lib/cloudinary";
import {
  MenuItemCostVariationBySize,
  MenuItemWithCostVariations,
  MenuItemWithSellPriceVariations,
  SellPriceVariation,
} from "./menu-item.types";
import {
  MenuItemCostVariationBaseInput,
  MenuItemCostVariationPrismaEntity,
  menuItemCostVariationPrismaEntity,
} from "./menu-item-cost-variation.entity.server";
import { CacheManager } from "../cache/cache-manager.server";
import {
  PizzaSizeKey,
  menuItemSizePrismaEntity,
} from "./menu-item-size.entity.server";
import {
  ComputedSellingPriceBreakdown,
  menuItemSellingPriceUtilityEntity,
} from "./menu-item-selling-price-utility.entity.server";
import {
  SellingChannelKey,
  menuItemSellingChannelPrismaEntity,
} from "./menu-item-selling-channel.entity.server";
import { slugifyString } from "~/utils/slugify";

export interface MenuItemWithAssociations extends MenuItem {
  priceVariations: MenuItemPriceVariation[];
  costVariations: MenuItemCostVariation[];
  categoryId: string;
  Category: Category;
  tags: {
    all: Tag["name"][]; // Array of all tag names
    public: Tag["name"][]; // Array of public tag names
    models: Tag[]; // Array of full tag objects
  };
  MenuItemLike: MenuItemLike[];
  MenuItemTag: MenuItemTag[];
  MenuItemShare: MenuItemShare[];
  MenuItemImage: MenuItemImage | null; // Handle cases where image may not exist
  MenuItemNote: MenuItemNote[];
  likes: {
    amount: number; // Number of likes
  };
  shares: number; // Number of shares
  imageTransformedURL: string; // Transformed image URL from Cloudinary
  imagePlaceholderURL: string; // Placeholder image URL from Cloudinary
  meta: {
    isItalyProduct: boolean; // Whether the product is marked as an Italy product
    isBestSeller: boolean; // Whether the product is marked as a best seller
    isMonthlySpecial: boolean; // Whether the product is marked as a monthly special
    isMonthlyBestSeller: boolean; // Whether the product is marked as a monthly best seller
    isChefSpecial: boolean; // Whether the product is marked as a chef special
  };
}

export interface MenuItemEntityFindAllProps {
  where?: Prisma.MenuItemWhereInput;
  option?: {
    sorted?: boolean;
    direction?: "asc" | "desc";
  };
  mock?: boolean;
}

interface FindManyWithSellPriceVariationsProps
  extends MenuItemEntityFindAllProps {
  channelKey?: string;
  sizeKey?: string;
  includeMinimumPrice?: boolean;
}

interface FindManyWithSellPriceVariationsProps {
  where?: any; // Substitua por tipo gerado do Prisma se possível
  sizeKey?: string;
  channelKey?: string;
}

interface MenuItemEntityProps extends PrismaEntityProps {
  menuItemCostVariation: typeof menuItemCostVariationPrismaEntity;
  menuItemSellingPriceUtility: typeof menuItemSellingPriceUtilityEntity;
  menuItemSize: typeof menuItemSizePrismaEntity;
  menuItemSellingChannel: typeof menuItemSellingChannelPrismaEntity;
}

export class MenuItemPrismaEntity {
  client;
  // Simple in-memory cache
  private cacheManager: CacheManager;

  menuItemCostVariation: typeof menuItemCostVariationPrismaEntity;

  menuItemSellingChannel: typeof menuItemSellingChannelPrismaEntity;

  menuItemSize: typeof menuItemSizePrismaEntity;

  constructor({
    client,
    menuItemCostVariation,

    menuItemSize,
    menuItemSellingChannel,
  }: MenuItemEntityProps) {
    this.client = client;
    this.cacheManager = new CacheManager();

    this.menuItemCostVariation = menuItemCostVariation;

    this.menuItemSize = menuItemSize;
    this.menuItemSellingChannel = menuItemSellingChannel;
  }

  async findAll(
    params: MenuItemEntityFindAllProps = {},
    options = {
      imageTransform: false,
      imageScaleWidth: 1280,
    }
  ) {
    const cacheKey = `MenuItemPrismaEntity.findAll:${JSON.stringify(params)}`;
    let result = this.cacheManager.get<MenuItemWithAssociations[]>(cacheKey);

    if (result) {
      return result;
    }

    if (params?.mock) {
      // fake to remove TS error. need to be fixed
      return [] as MenuItemWithAssociations[];
    }

    const recordsFounded = await this.client.menuItem.findMany({
      where: params?.where,
      include: {
        priceVariations: true,
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
      },
    });

    const records = recordsFounded.map((r) => ({
      ...r,
      imageTransformedURL: CloudinaryUtils.scaleWidth(
        r.MenuItemImage?.publicId || "",
        { width: options.imageScaleWidth }
      ),
      tags: {
        all: r.tags.map((t) => t.Tag?.name ?? ""),
        public: r.tags
          .filter((t) => t.Tag?.public === true)
          .map((t) => t.Tag?.name ?? ""),
        models: r.tags.map((t) => t.Tag),
      },
      likes: { amount: r.MenuItemLike.length },
      shares: r.MenuItemShare.length,
      meta: {
        isItalyProduct: r.tags.some(
          (t) => t.Tag?.name.toLowerCase() === "produtos-italiano"
        ),
        isBestSeller: r.tags.some(
          (t) => t.Tag?.name.toLowerCase() === "mais-vendido"
        ),
        isMonthlyBestSeller: r.tags.some(
          (t) => t.Tag?.name.toLowerCase() === "mais-vendido-mes"
        ),
        isChefSpecial: r.tags.some(
          (t) => t.Tag?.name.toLowerCase() === "especial-chef"
        ),
        isMonthlySpecial: r.tags.some(
          (t) => t.Tag?.name.toLowerCase() === "especial-mes"
        ),
      },
    }));

    const returnedRecords = params?.option?.sorted
      ? records.sort((a, b) => {
          const direction = params.option?.direction === "asc" ? 1 : -1;
          return (a.sortOrderIndex - b.sortOrderIndex) * direction;
        })
      : [...records];

    this.cacheManager.set(cacheKey, returnedRecords);

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

  /**
   * Find all menu items with cost associated to each size
   */
  async findManyWithCostVariations(
    params: MenuItemEntityFindAllProps = {}
  ): Promise<MenuItemWithCostVariations[]> {
    const allMenuItems = await this.client.menuItem.findMany({
      where: params?.where,
      include: {
        MenuItemCostVariation: true,
      },
      orderBy: { sortOrderIndex: "asc" },
    });

    const sizes = await this.client.menuItemSize.findMany({
      orderBy: { sortOrderIndex: "asc" },
    });

    // array of medium size cost variations for all items
    return allMenuItems.map((item) => {
      const costVariations = sizes
        .sort((a, b) => a.sortOrderIndex - b.sortOrderIndex)
        .map((size) => {
          const variation = item.MenuItemCostVariation?.find(
            (cv) => cv.menuItemSizeId === size.id
          );

          let sizeKey: PizzaSizeKey = "pizza-medium"; // Default size key
          sizeKey = size.key as PizzaSizeKey;

          return {
            menuItemCostVariationId: variation?.id,
            sizeId: size.id,
            sizeKey,
            sizeName: size.name,
            costAmount: variation?.costAmount ?? 0,
            updatedBy: variation?.updatedBy,
            updatedAt: variation?.updatedAt,
            previousCostAmount: variation?.previousCostAmount ?? 0,
          };
        });

      return {
        menuItemId: item.id,
        name: item.name,
        ingredients: item.ingredients,
        visible: item.visible,
        active: item.active,
        costVariations,
      };
    });
  }

  async findWithCostVariationsByItem(
    menuItemId: string
  ): Promise<MenuItemWithCostVariations | null> {
    const costVariations = await this.findManyWithCostVariations({
      where: { id: menuItemId },
    });

    return costVariations[0];
  }

  async findManyWithSellPriceVariations(
    params: MenuItemEntityFindAllProps = {}
  ): Promise<MenuItemWithSellPriceVariations[]> {
    const allMenuItems = await this.client.menuItem.findMany({
      where: params?.where,
      include: {
        MenuItemSellingPriceVariation: {
          include: {
            MenuItemSellingChannel: true,
            MenuItemSize: true,
          },
        },
        MenuItemGroup: true,
      },
      orderBy: { sortOrderIndex: "asc" },
    });

    const sizes = await this.client.menuItemSize.findMany({
      orderBy: { sortOrderIndex: "asc" },
    });

    // array of medium size cost variations for all items
    return allMenuItems.map((item) => {
      const sellPriceVariations = sizes
        .sort((a, b) => a.sortOrderIndex - b.sortOrderIndex)
        .map((size) => {
          const variation = item.MenuItemSellingPriceVariation?.find(
            (cv) => cv.menuItemSizeId === size.id
          );

          let sizeKey: PizzaSizeKey = "pizza-medium"; // Default size key
          sizeKey = size.key as PizzaSizeKey;

          return {
            menuItemSellPriceVariationId: variation?.id,
            sizeId: variation?.MenuItemSize?.id,
            sizeKey: variation?.MenuItemSize?.key,
            sizeName: variation?.MenuItemSize?.name,
            channelId: variation?.MenuItemSellingChannel?.id,
            channelKey: variation?.MenuItemSellingChannel?.key,
            channelName: variation?.MenuItemSellingChannel?.name,
            priceAmount: variation?.priceAmount ?? 0,
            updatedBy: variation?.updatedBy,
            updatedAt: variation?.updatedAt,
            previousPriceAmount: variation?.previousPriceAmount ?? 0,
            discountPercentage: variation?.discountPercentage ?? 0,
          };
        });

      return {
        menuItemId: item.id,
        group: item.MenuItemGroup,
        name: item.name,
        ingredients: item.ingredients,
        visible: item.visible,
        active: item.active,
        sellPriceVariations,
      };
    });
  }

  async findManyWithCostAndSellPriceVariations() {}

  async findById(
    id: string,
    options = {
      imageScaleWidth: 1280,
    }
  ) {
    const item = await this.client.menuItem.findFirst({
      where: { id },
      include: {
        priceVariations: true,
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
        MenuItemCostVariation: true,
        MenuItemSellingPriceVariation: true,
      },
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
      imagePlaceholderURL: CloudinaryUtils.scaleWidth(
        item.MenuItemImage?.publicId || "",
        { width: 20, quality: 1, blur: 1000 }
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

  async findBySlug(
    slug: string,
    options = {
      imageScaleWidth: 1280,
    }
  ) {
    const item = await this.client.menuItem.findFirst({
      where: { slug },
      include: {
        priceVariations: true,
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
      },
    });

    if (!item) {
      return null;
    }

    return {
      ...item,
      imageTransformedURL: CloudinaryUtils.scaleWidth(
        item.MenuItemImage?.publicId || "",
        {
          width: options.imageScaleWidth,
        }
      ),
      imagePlaceholderURL: CloudinaryUtils.scaleWidth(
        item.MenuItemImage?.publicId || "",
        { width: 20, quality: 1, blur: 1000 }
      ),
      tags: {
        all: item.tags.map((t) => t.Tag?.name),
        public: item.tags
          .filter((t) => t.Tag?.public === true)
          .map((t) => t.Tag?.name),
        models: item.tags.map((t) => t.Tag),
      },
      likes: { amount: item.MenuItemLike.length },
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
      slug: slugifyString(data.name),
    };

    await this.cacheManager.invalidate();

    return await this.client.menuItem.create({ data: nextItem });
  }

  async update(id: string, data: Prisma.MenuItemUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    await this.cacheManager.invalidate();

    data.slug = slugifyString(data.name as string);

    return await this.client.menuItem.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy: string = "undefined") {
    await this.cacheManager.invalidate();

    return await this.client.menuItem.update({
      where: { id },
      data: {
        visible: false,
        active: false,
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBy,
      },
    });
  }

  async delete(id: string) {
    await this.cacheManager.invalidate();

    return await this.client.menuItem.delete({ where: { id } });
  }

  async associateTag(itemId: string, tag: Tag) {
    await this.cacheManager.invalidate();

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
    await this.cacheManager.invalidate();

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
  menuItemCostVariation: menuItemCostVariationPrismaEntity,
  menuItemSellingPriceUtility: menuItemSellingPriceUtilityEntity,
  menuItemSize: menuItemSizePrismaEntity,
  menuItemSellingChannel: menuItemSellingChannelPrismaEntity,
});

export { menuItemPrismaEntity };
