import {
  Category,
  MenuItem,
  MenuItemCostVariation,
  MenuItemImage,
  MenuItemLike,
  MenuItemNote,
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
import { CloudinaryUtils } from "~/lib/cloudinary";
import {
  MenuItemWithCostVariations,
  MenuItemWithSellPriceVariations,
  SellPriceVariation,
} from "./menu-item.types";
import {
  MenuItemCostVariationPrismaEntity,
  menuItemCostVariationPrismaEntity,
} from "./menu-item-cost-variation.entity.server";
import { CacheManager } from "../cache/cache-manager.server";
import { PizzaSizeKey } from "./menu-item-size.entity.server";
import { menuItemSellingPriceUtilityEntity } from "./menu-item-selling-price-utility.entity.server";
import { SellingChannelKey } from "./menu-item-selling-channel.entity.server";

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

interface MenuItemEntityFindAllProps {
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
  includeRecommendedPrice?: boolean;
}

interface FindManyWithSellPriceVariationsProps {
  where?: any; // Substitua por tipo gerado do Prisma se possível
  sizeKey?: string;
  channelKey?: string;
  includeRecommendedPrice?: boolean;
}

interface MenuItemEntityProps extends PrismaEntityProps {
  menuItemCostVariation: typeof menuItemCostVariationPrismaEntity;
  menuItemSellingPriceUtility: typeof menuItemSellingPriceUtilityEntity;
}

export class MenuItemPrismaEntity {
  client;
  // Simple in-memory cache
  private cacheManager: CacheManager;

  menuItemCostVariation: typeof menuItemCostVariationPrismaEntity;

  menuItemSellingPriceUtility: typeof menuItemSellingPriceUtilityEntity;

  constructor({
    client,
    menuItemCostVariation,
    menuItemSellingPriceUtility,
  }: MenuItemEntityProps) {
    this.client = client;
    this.cacheManager = new CacheManager();

    this.menuItemCostVariation = menuItemCostVariation;
    this.menuItemSellingPriceUtility = menuItemSellingPriceUtilityEntity;
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
        priceVariations: true,
        MenuItemCostVariation: true,
      },
      orderBy: { sortOrderIndex: "asc" },
    });

    const sizes = await this.client.menuItemSize.findMany({
      orderBy: { sortOrderIndex: "asc" },
    });

    // array of medium size cost variations for all items
    const allReferenceCostVariations =
      await this.menuItemCostVariation.findAllReferenceCost();

    return allMenuItems.map((item) => {
      const costVariations = sizes
        .sort((a, b) => a.sortOrderIndex - b.sortOrderIndex)
        .map((size) => {
          const variation = item.MenuItemCostVariation?.find(
            (cv) => cv.menuItemSizeId === size.id
          );

          let sizeKey: PizzaSizeKey = "pizza-medium"; // Default size key
          sizeKey = size.key as PizzaSizeKey;

          const itemReferenceCost = allReferenceCostVariations.find(
            (c) => c.menuItemId === item.id
          );

          const proposedCostAmount =
            MenuItemCostVariationPrismaEntity.calculateOneProposedCostVariation(
              sizeKey,
              itemReferenceCost?.costAmount ?? 0
            );

          return {
            menuItemCostVariationId: variation?.id,
            sizeId: size.id,
            sizeKey,
            sizeName: size.name,
            costAmount: variation?.costAmount ?? 0,
            proposedCostAmount: proposedCostAmount ?? 0,
            updatedBy: variation?.updatedBy,
            updatedAt: variation?.updatedAt,
            previousCostAmount: variation?.previousCostAmount ?? 0,
          };
        });

      return {
        menuItemId: item.id,
        name: item.name,
        ingredients: item.ingredients,
        costVariations,
      };
    });
  }

  async findOneWithCostVariations(
    menuItemId: string,
    options = {
      imageScaleWidth: 1280,
    }
  ): Promise<MenuItemWithCostVariations | null> {
    const item = await this.client.menuItem.findFirst({
      where: { id: menuItemId },
      include: {
        priceVariations: true,
        MenuItemCostVariation: true,
      },
    });

    if (!item) {
      return null;
    }

    const costVariations = await this.findManyWithCostVariations({
      where: { id: menuItemId },
    });

    return costVariations[0];
  }

  async findManyWithSellPriceVariations(
    params: FindManyWithSellPriceVariationsProps = {}
  ): Promise<MenuItemWithSellPriceVariations[]> {
    const [allMenuItems, sizes, channels] = await Promise.all([
      this.client.menuItem.findMany({
        where: params?.where,
        include: { MenuItemSellingPriceVariation: true },
        orderBy: { sortOrderIndex: "asc" },
      }),
      this.client.menuItemSize.findMany({ orderBy: { sortOrderIndex: "asc" } }),
      this.client.menuItemSellingChannel.findMany(),
    ]);

    const filterSizes = (size: any) =>
      !params.sizeKey || size.key === params.sizeKey;

    const filterChannels = (channel: any) =>
      !params.channelKey || channel.key === params.channelKey;

    const buildVariation = async (
      item: any,
      size: any,
      channel: any
    ): Promise<SellPriceVariation> => {
      const variation = item.MenuItemSellingPriceVariation?.find(
        (spv: any) =>
          spv.menuItemSizeId === size.id &&
          spv.menuItemSellingChannelId === channel.id
      );

      let computedSellingPriceBreakdown = null;

      if (params.includeRecommendedPrice) {
        computedSellingPriceBreakdown =
          await this.menuItemSellingPriceUtility.calculateSellingPriceByChannel(
            item.id,
            channel.key as SellingChannelKey,
            size.key as PizzaSizeKey
          );
      }

      return {
        menuItemSellPriceVariationId: variation?.id,
        sizeId: size.id,
        sizeKey: size.key as PizzaSizeKey,
        sizeName: size.name,
        channelId: channel.id,
        channelKey: channel.key,
        channelName: channel.name,
        priceAmount: variation?.priceAmount ?? 0,
        computedSellingPriceBreakdown,
        discountPercentage: variation?.discountPercentage ?? 0,
        updatedBy: variation?.updatedBy,
        updatedAt: variation?.updatedAt,
        previousPriceAmount: variation?.previousPriceAmount ?? 0,
      };
    };

    const results = await Promise.all(
      allMenuItems.map(async (item) => {
        const variations: SellPriceVariation[] = [];

        for (const size of sizes.filter(filterSizes)) {
          for (const channel of channels.filter(filterChannels)) {
            const variation = await buildVariation(item, size, channel);
            variations.push(variation);
          }
        }

        return {
          menuItemId: item.id,
          name: item.name,
          ingredients: item.ingredients,
          sellPriceVariations: variations,
        };
      })
    );

    return results;
  }

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

    await this.cacheManager.invalidate();

    return await this.client.menuItem.create({ data: nextItem });
  }

  async update(id: string, data: Prisma.MenuItemUpdateInput) {
    if (!data.updatedAt) {
      data.updatedAt = new Date().toISOString();
    }

    await this.cacheManager.invalidate();

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
});

export { menuItemPrismaEntity };

/**

 {
   "id":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
   "name":"Margherita",
   "description":"",
   "ingredients":"Molho de tomate, muçarela, manjericão fresco, azeite de oliva aromatizado com manjericão",
   "categoryId":"fc38088c-09ba-4d87-bbd1-4313251955d2",
   "basePriceAmount":69.9,
   "visible":true,
   "mogoId":"1",
   "createdAt":"2025-01-18T18:36:48.996Z",
   "updatedAt":"2025-01-18T18:36:48.996Z",
   "sortOrderIndex":0,
   "notesPublic":"",
   "imageId":"4d7574ac-010b-49cf-9804-adf7920b68df",
   "priceVariations":[
      {
         "id":"148f66ca-5496-4d3c-9957-5bafba516d1b",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "menuItemSizeId":null,
         "label":"fatia",
         "basePrice":69.9,
         "amount":0,
         "discountPercentage":0,
         "showOnCardapio":false,
         "showOnCardapioAt":null,
         "createdAt":"2024-07-21T15:48:18.028Z",
         "updatedAt":"2024-07-21T15:48:18.028Z",
         "updatedBy":null,
         "latestAmount":0
      },
      {
         "id":"58f671af-ef4a-41d6-8a9f-a17095bfc4da",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "menuItemSizeId":null,
         "label":"individual",
         "basePrice":69.9,
         "amount":0,
         "discountPercentage":0,
         "showOnCardapio":false,
         "showOnCardapioAt":null,
         "createdAt":"2024-07-21T15:48:18.028Z",
         "updatedAt":"2024-07-21T15:48:18.028Z",
         "updatedBy":null,
         "latestAmount":0
      },
      {
         "id":"ea5b4efd-e562-4dd5-9f67-5fbdaada9bac",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "menuItemSizeId":null,
         "label":"familia",
         "basePrice":69.9,
         "amount":159.9,
         "discountPercentage":0,
         "showOnCardapio":true,
         "showOnCardapioAt":null,
         "createdAt":"2024-07-21T15:48:18.028Z",
         "updatedAt":"2024-10-09T14:26:31.499Z",
         "updatedBy":null,
         "latestAmount":0
      },
      {
         "id":"1faa2aca-c2f0-4e40-ad1b-b008372666ad",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "menuItemSizeId":null,
         "label":"media",
         "basePrice":69.9,
         "amount":79.9,
         "discountPercentage":0,
         "showOnCardapio":true,
         "showOnCardapioAt":null,
         "createdAt":"2024-07-21T15:48:18.028Z",
         "updatedAt":"2024-10-09T14:26:23.595Z",
         "updatedBy":null,
         "latestAmount":0
      }
   ],
   "costVariations":[
      {
         "id":"0617a1e1-6ece-44d5-92ac-0cadd542419c",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "menuItemSizeId":"04da4a27-6e0d-46d1-a058-5d2beceaa4c3",
         "recipeCostAmount":2,
         "createdAt":"2024-11-09T18:54:51.635Z",
         "updatedAt":"2024-11-09T18:54:51.635Z",
         "updatedBy":"admin",
         "MenuItemSize":{
            "id":"04da4a27-6e0d-46d1-a058-5d2beceaa4c3",
            "name":"Tamanho Individual",
            "group":"pizza",
            "costBase":6.84,
            "slug":"pizza-small",
            "costScalingFactor":0.75,
            "sortOrderIndex":0,
            "createdAt":"2024-11-08T17:30:25.281Z",
            "updatedAt":"2024-11-08T17:30:25.281Z"
         }
      },
      {
         "id":"64ec5817-f226-4c02-917c-666a8cb92bf0",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "menuItemSizeId":"70f05239-565a-4cec-9716-4048e5417f66",
         "recipeCostAmount":11.1,
         "createdAt":"2024-11-15T16:04:00.355Z",
         "updatedAt":"2024-11-15T16:04:00.355Z",
         "updatedBy":"admin",
         "MenuItemSize":{
            "id":"70f05239-565a-4cec-9716-4048e5417f66",
            "name":"Tamanho Medio",
            "group":"pizza",
            "costBase":8.86,
            "slug":"pizza-medium",
            "costScalingFactor":1,
            "sortOrderIndex":1,
            "createdAt":"2024-11-08T17:30:25.281Z",
            "updatedAt":"2024-11-08T17:30:25.281Z"
         }
      }
   ],
   "Category":{
      "id":"fc38088c-09ba-4d87-bbd1-4313251955d2",
      "name":"Sabor Italiano",
      "sortOrder":1000,
      "type":"cardapio",
      "createdAt":"2024-07-21T00:00:00.000Z",
      "updatedAt":"2024-07-21T14:49:22.321Z"
   },
   "tags":{
      "all":[
         "vegetariana"
      ],
      "public":[
         "vegetariana"
      ],
      "models":[
         {
            "id":"fbf538f9-1a46-4aeb-84ad-a21d39908a3d",
            "name":"vegetariana",
            "public":true,
            "colorHEX":"#aec355",
            "deletedAt":null,
            "createdAt":"2024-08-03T00:00:00.000Z",
            "updatedAt":"2024-08-03T16:37:50.540Z"
         }
      ]
   },
   "MenuItemLike":[
      {
         "id":"4877d544-47fe-4b30-8c7a-34e9a0e89164",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-04T15:50:40.583Z",
         "updatedAt":"2024-08-04T15:50:40.772Z",
         "deletedAt":null
      },
      {
         "id":"6b3b53bb-8e70-4850-9ece-9685717a5e52",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-04T15:50:40.758Z",
         "updatedAt":"2024-08-04T15:50:41.010Z",
         "deletedAt":null
      },
      {
         "id":"d8dfb94c-4545-45a7-a880-ca99c6ded3de",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-04T15:50:40.924Z",
         "updatedAt":"2024-08-04T15:50:41.105Z",
         "deletedAt":null
      },
      {
         "id":"747bc0da-0285-4cb3-96b7-de61701ece5f",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-04T15:50:41.056Z",
         "updatedAt":"2024-08-04T15:50:41.224Z",
         "deletedAt":null
      },
      {
         "id":"87c906c6-ca55-4b24-b0b9-14866bd47100",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-04T15:50:41.223Z",
         "updatedAt":"2024-08-04T15:50:41.383Z",
         "deletedAt":null
      },
      {
         "id":"bfadaefd-3bc4-46c6-88da-6cdb94261bfa",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-05T16:50:55.420Z",
         "updatedAt":"2024-08-05T16:50:56.066Z",
         "deletedAt":null
      },
      {
         "id":"b3c7ff51-05b2-417a-bf62-ed17e3bb7d7b",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-13T13:54:41.687Z",
         "updatedAt":"2024-08-13T13:54:42.364Z",
         "deletedAt":null
      },
      {
         "id":"1839241d-3c2b-4c56-81f9-126a4e4f3fc1",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-08-13T13:54:47.583Z",
         "updatedAt":"2024-08-13T13:54:48.324Z",
         "deletedAt":null
      },
      {
         "id":"c0842a0a-8b65-4a7d-a352-945795d0779e",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-10-31T19:59:41.739Z",
         "updatedAt":"2024-10-31T19:59:41.744Z",
         "deletedAt":null
      },
      {
         "id":"6f5d29e0-88f2-4228-bc39-a7bed785fdb4",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-10-31T19:59:42.579Z",
         "updatedAt":"2024-10-31T19:59:42.580Z",
         "deletedAt":null
      },
      {
         "id":"43afb7ce-94f5-42b5-b5d4-97a183135810",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-10-31T19:59:43.601Z",
         "updatedAt":"2024-10-31T19:59:43.791Z",
         "deletedAt":null
      },
      {
         "id":"d99b54bb-f1a8-47fd-88ab-50d3b0914c5d",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-10-31T19:59:45.601Z",
         "updatedAt":"2024-10-31T19:59:45.897Z",
         "deletedAt":null
      },
      {
         "id":"8b8dd458-7259-4290-b6fb-da06ddbcba54",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-11-25T18:24:58.777Z",
         "updatedAt":"2024-11-25T18:24:58.779Z",
         "deletedAt":null
      },
      {
         "id":"005ec9ef-a6f2-4980-b64f-c4269489e478",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-11-25T18:25:01.804Z",
         "updatedAt":"2024-11-25T18:25:01.806Z",
         "deletedAt":null
      },
      {
         "id":"07344457-c0ee-4b32-8a7c-4da033d96cc0",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-11-25T18:25:03.963Z",
         "updatedAt":"2024-11-25T18:25:03.965Z",
         "deletedAt":null
      },
      {
         "id":"c8e3092c-3ee4-479a-a6dc-74135bff5918",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-12-06T22:26:33.331Z",
         "updatedAt":"2024-12-06T22:26:33.332Z",
         "deletedAt":null
      },
      {
         "id":"dbf5d147-45b9-4e92-9c1c-42cf709b151e",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-12-17T21:31:05.036Z",
         "updatedAt":"2024-12-17T21:31:05.038Z",
         "deletedAt":null
      },
      {
         "id":"86efc6d0-cecb-45e7-b873-592ddbdfaa24",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2024-12-21T23:38:48.038Z",
         "updatedAt":"2024-12-21T23:38:48.040Z",
         "deletedAt":null
      },
      {
         "id":"9f9345b0-37ed-4ff5-8d64-1ab14ea50560",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "amount":1,
         "createdAt":"2025-01-19T20:38:08.728Z",
         "updatedAt":"2025-01-19T20:38:08.840Z",
         "deletedAt":null
      }
   ],
   "MenuItemShare":[
      {
         "id":"2aa76bde-1627-4bb5-ae90-bcb80ff1707b",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "createdAt":"2024-08-04T17:05:38.074Z",
         "updatedAt":"2024-08-04T17:05:38.751Z"
      },
      {
         "id":"40128d07-fcb0-456c-90d7-9e3ef88f1da9",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "createdAt":"2024-08-04T17:09:50.817Z",
         "updatedAt":"2024-08-04T17:09:51.555Z"
      },
      {
         "id":"97ceb1ca-4bbf-4854-9c58-c0c4c115e316",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "createdAt":"2024-08-04T17:54:27.928Z",
         "updatedAt":"2024-08-04T17:54:28.854Z"
      },
      {
         "id":"27a64eb9-6c17-41bf-8637-d2b755c93097",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "createdAt":"2024-09-15T23:33:11.880Z",
         "updatedAt":"2024-09-15T23:33:11.882Z"
      },
      {
         "id":"4f61494a-8f00-4b3a-82da-24878d56b3e3",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "createdAt":"2024-11-06T16:30:18.994Z",
         "updatedAt":"2024-11-06T16:30:19.012Z"
      },
      {
         "id":"52f49b2c-1be6-4211-abb5-5f73d10d1757",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "createdAt":"2024-11-16T21:21:43.216Z",
         "updatedAt":"2024-11-16T21:21:43.503Z"
      },
      {
         "id":"47b0fee4-1445-4098-ad48-c8b0599d0281",
         "menuItemId":"bfde8bed-3f77-4d82-b836-c3d53969d87c",
         "sessionId":null,
         "createdAt":"2024-11-18T19:09:12.766Z",
         "updatedAt":"2024-11-18T19:09:12.776Z"
      }
   ],
   "MenuItemImage":{
      "id":"4d7574ac-010b-49cf-9804-adf7920b68df",
      "secureUrl":"https://res.cloudinary.com/dy8gw8ahl/image/upload/v1723220649/py5qmavfq71ovzovhobf.jpg",
      "assetFolder":"cardapio",
      "originalFileName":"margherita",
      "displayName":"margherita",
      "height":792,
      "width":1190,
      "thumbnailUrl":"https://res.cloudinary.com/dy8gw8ahl/image/upload/c_limit,h_60,w_90/v1723220649/py5qmavfq71ovzovhobf.jpg",
      "format":"jpg",
      "publicId":"py5qmavfq71ovzovhobf"
   },
   "imageTransformedURL":"https://res.cloudinary.com/dy8gw8ahl/image/upload/f_auto/c_scale,w_1280/py5qmavfq71ovzovhobf?_a=DATAfRDeZAA0",
   "likes":{
      "amount":19
   },
   "shares":7,
   "meta":{
      "isItalyProduct":false,
      "isBestSeller":false,
      "isMonthlyBestSeller":false,
      "isChefSpecial":false,
      "isMonthlySpecial":false
   }
}

 */
