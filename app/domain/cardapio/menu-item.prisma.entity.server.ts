import {
  Category,
  MenuItem,
  MenuItemGalleryImage,
  MenuItemGroup,
  MenuItemImage,
  MenuItemLike,
  MenuItemPriceVariation,
  MenuItemSellingChannel,
  MenuItemSellingPriceVariation,
  MenuItemSellingPriceVariationAudit,
  MenuItemShare,
  MenuItemSize,
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
} from "./menu-item.types";
import { menuItemCostVariationPrismaEntity } from "./menu-item-cost-variation.entity.server";
import { CacheManager } from "../cache/cache-manager.server";
import {
  PizzaSizeKey,
  menuItemSizePrismaEntity,
} from "./menu-item-size.entity.server";
import { menuItemSellingPriceUtilityEntity } from "./menu-item-selling-price-utility.entity";
import {
  menuItemSellingChannelPrismaEntity,
  SellingChannelKey,
} from "./menu-item-selling-channel.entity.server";
import { slugifyString } from "~/utils/slugify";
import { group } from "console";

export interface MenuItemWithAssociations extends MenuItem {
  priceVariations: MenuItemPriceVariation[];
  Category: Category;
  tags: {
    all: string[];
    public: string[];
    models: Tag[];
  };
  MenuItemLike: MenuItemLike[];
  MenuItemShare: MenuItemShare[];
  MenuItemImage: MenuItemImage | null;
  MenuItemGalleryImage: MenuItemGalleryImage[];
  MenuItemGroup: MenuItemGroup;
  MenuItemSellingPriceVariation: Array<
    MenuItemSellingPriceVariation & {
      MenuItemSellingChannel: MenuItemSellingChannel;
      MenuItemSize: MenuItemSize;
    }
  >;
  likes: {
    amount: number;
  };
  shares: {
    amount: number;
  };
  imageTransformedURL: string;
  imagePlaceholderURL?: string; // Opcional se for implementado
  meta: {
    isItalyProduct: boolean;
    isBestSeller: boolean;
    isMonthlyBestSeller: boolean;
    isChefSpecial: boolean;
    isMonthlySpecial: boolean;
  };
}

export interface MenuItemEntityFindAllParams {
  where?: Prisma.MenuItemWhereInput;
  mock?: boolean;
  sellingChannelKey?: SellingChannelKey; // Key of the selling channel to filter by
  option?: {
    sorted?: boolean;
    direction?: "asc" | "desc";
  };
}

export interface MenuItemEntityFindAllOptions {
  imageTransform?: boolean;
  imageScaleWidth?: number;
  sorted?: boolean;
  direction?: "asc" | "desc";
  cacheRevalidation?: boolean;
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
    params: MenuItemEntityFindAllParams = {
      where: {},
      mock: false,
      sellingChannelKey: "cardapio", // Default selling channel key
    },
    options: MenuItemEntityFindAllOptions = {
      imageTransform: false,
      imageScaleWidth: 1280,
      cacheRevalidation: false,
    }
  ) {
    if (process.env.NODE_ENV === "development") {
      const stack = new Error().stack?.split("\n").slice(1, 6).join("\n");
      console.log("[MenuItem.findAll] chamado", {
        when: new Date().toISOString(),
      });
      console.log(stack);
    }
    const cacheKey = `MenuItemPrismaEntity.findAll:${JSON.stringify(params)}`;
    let result = this.cacheManager.get<MenuItemWithAssociations[]>(cacheKey);

    const shouldUseCache = result && options?.cacheRevalidation === false;

    if (shouldUseCache) {
      return result;
    }

    if (params?.mock) {
      // fake to remove TS error. need to be fixed
      return [] as MenuItemWithAssociations[];
    }

    const recordsFounded = await this.client.menuItem.findMany({
      where: params?.where,
      include: {
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
        MenuItemGalleryImage: true,
        MenuItemGroup: true,
        MenuItemSellingPriceVariation: {
          where: {
            MenuItemSellingChannel: {
              key: params.sellingChannelKey || "cardapio", // Default to 'cardapio'
            },
          },
          orderBy: {
            priceAmount: "asc",
          },
          include: {
            MenuItemSellingChannel: true,
            MenuItemSize: true,
          },
        },
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
      shares: { amount: r.MenuItemShare.length },
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
    params: MenuItemEntityFindAllParams = {},
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

  async findAllGroupedByGroup(
    params: MenuItemEntityFindAllParams = {},
    options = {
      imageTransform: false,
      imageScaleWidth: 1280,
    }
  ) {
    // Use the existing findAll function to fetch records
    const allMenuItems = (await this.findAll(params, options)) || [];

    // Group records by category in memory
    const groupedByGroup = allMenuItems.reduce((acc, menuItem) => {
      const groupName = menuItem.MenuItemGroup?.name || "Sem grupo";

      if (!acc[groupName]) {
        acc[groupName] = [];
      }

      // @ts-ignore
      acc[groupName].push(menuItem);

      return acc;
    }, {} as Record<string, MenuItemWithAssociations[]>);

    // Convert to an ordered array of categories
    return Object.keys(groupedByGroup)
      .sort() // Sort categories alphabetically; customize as needed
      .map((groupName) => ({
        group: groupName,
        menuItems: groupedByGroup[groupName],
      }));
  }

  /**
   * Find all menu items with cost associated to each size
   */
  async findManyWithCostVariations(
    params: MenuItemEntityFindAllParams = {}
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

  async findOneWithCostVariations(id: MenuItem["id"]) {
    const result = await this.findManyWithCostVariations({
      where: { id },
    });

    return result[0];
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
    params?: MenuItemEntityFindAllParams,
    sellingChannelKey?: string,
    options?: { includeAuditRecords?: boolean }
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
        Category: true,
      },
      orderBy: { sortOrderIndex: "asc" },
    });

    const sizes = await this.client.menuItemSize.findMany({
      orderBy: { sortOrderIndex: "asc" },
    });

    // 🔎 Audits carregados somente se solicitado
    let auditMap = new Map<string, MenuItemSellingPriceVariationAudit[]>();

    if (options?.includeAuditRecords) {
      let audits: MenuItemSellingPriceVariationAudit[] = [];

      if (sellingChannelKey) {
        const channel = await this.client.menuItemSellingChannel.findFirst({
          where: { key: sellingChannelKey },
          select: { id: true },
        });

        const channelId = channel?.id;

        if (channelId) {
          audits =
            await this.client.menuItemSellingPriceVariationAudit.findMany({
              where: {
                menuItemSellingChannelId: channelId,
              },
            });
        }
      } else {
        audits = await this.client.menuItemSellingPriceVariationAudit.findMany(
          {}
        );
      }

      for (const audit of audits) {
        const key = `${audit.menuItemId}-${audit.menuItemSellingChannelId}-${audit.menuItemSizeId}`;
        if (!auditMap.has(key)) auditMap.set(key, []);
        auditMap.get(key)!.push(audit);
      }
    }

    return allMenuItems.map((item) => {
      const sellPriceVariations = sizes
        .map((size) => {
          const variation = item.MenuItemSellingPriceVariation?.find(
            (cv) =>
              cv.menuItemSizeId === size.id &&
              (!sellingChannelKey ||
                cv.MenuItemSellingChannel?.key === sellingChannelKey)
          );

          if (!variation) return null;

          const auditKey = `${item.id}-${variation.menuItemSellingChannelId}-${variation.menuItemSizeId}`;
          const variationAuditRecords = options?.includeAuditRecords
            ? auditMap.get(auditKey) ?? []
            : [];

          return {
            menuItemSellPriceVariationId: variation.id,
            sizeId: variation.MenuItemSize?.id!,
            sizeKey: variation.MenuItemSize?.key ?? null,
            sizeName: variation.MenuItemSize?.name!,
            channelId: variation.MenuItemSellingChannel?.id ?? null,
            channelKey: variation.MenuItemSellingChannel?.key ?? null,
            channelName: variation.MenuItemSellingChannel?.name ?? "",
            priceAmount: variation.priceAmount ?? 0,
            profitActualPerc: variation.profitActualPerc ?? 0,
            priceExpectedAmount: variation.priceExpectedAmount ?? 0,
            profitExpectedPerc: variation.profitExpectedPerc ?? 0,
            showOnCardapio: variation.showOnCardapio ?? false,
            showOnCardapioAt: variation.showOnCardapioAt ?? null,
            updatedBy: variation.updatedBy,
            updatedAt: variation.updatedAt,
            previousPriceAmount: variation.previousPriceAmount ?? 0,
            discountPercentage: variation.discountPercentage ?? 0,
            lastAuditRecord: variationAuditRecords.at(-1) ?? null,
          };
        })
        .filter(Boolean);

      return {
        menuItemId: item.id,
        group: item.MenuItemGroup,
        category: item.Category,
        name: item.name,
        ingredients: item.ingredients,
        visible: item.visible,
        active: item.active,
        sellPriceVariations,
      };
    });
  }

  async findOneWithSellPriceVariations(id: MenuItem["id"]) {
    const result = await this.findManyWithSellPriceVariations({
      where: { id },
    });

    return result[0];
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
        MenuItemGalleryImage: true,
        MenuItemNote: true,
        MenuItemCostVariation: true,
        MenuItemSellingPriceVariation: true,
        MenuItemGroup: true,
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
      shares: {
        amount: item.MenuItemShare.length,
      },
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
        MenuItemGalleryImage: true,
        MenuItemSellingPriceVariation: {
          include: {
            MenuItemSellingChannel: true,
            MenuItemSize: true,
          },
        },
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
      shares: {
        amount: item.MenuItemShare.length,
      },
    };
  }

  async create(data: Prisma.MenuItemCreateInput) {
    const newId = uuidv4();

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
      id: newId,
      sortOrderIndex: lastsortOrderIndex + 1,
      slug: slugifyString(data.name),
    };

    if (nextItem.upcoming === true) {
      // se lançamento futuro, não exibir
      nextItem.visible = false;

      // const lancamentoFuturoTag = await this.client.tag.findFirst({
      //   where: { name: "futuro-lancamento" },
      // });

      // if (lancamentoFuturoTag?.id) {
      //   this.associateTag(nextItem.id, lancamentoFuturoTag);
      // }
    }

    if (nextItem.MenuItemGroup) {
      // If the item belongs to a group, ensure the group exists
      const group = await this.client.menuItemGroup.findFirst({
        where: { name: "Pizzas Salgadas" },
      });

      nextItem.MenuItemGroup = {
        connect: { id: group.id },
      };
    }

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

  async softDelete(id: string, deletedBy: string = "undefined") {}

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
