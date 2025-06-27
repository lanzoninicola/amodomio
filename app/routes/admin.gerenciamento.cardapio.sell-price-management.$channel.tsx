import { MenuItemSellingChannel } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData, defer, useActionData, Outlet } from "@remix-run/react";
import { Suspense, useState } from "react";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

import { MenuItemWithSellPriceVariations, SellPriceVariation } from "~/domain/cardapio/menu-item.types";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest } from "~/utils/http-response.server";
import { LoggedUser } from "~/domain/auth/types.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { MenuItemsFilters } from "~/domain/cardapio/components/menu-items-filters/menu-items-filters";

type SortOrderType = "default" | "alphabetical-asc" | "alphabetical-desc" | "price-asc" | "price-desc" | "profit-asc" | "profit-desc";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const sellingChannelKey = params.channel as string;
  const sellingChannel = await prismaClient.menuItemSellingChannel.findFirst({
    where: {
      key: sellingChannelKey,
    },
  })

  if (!sellingChannel) {
    return badRequest(`Can not find selling channel with key ${sellingChannelKey}`)
  }

  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadMany({
    channelKey: sellingChannel.key,
  })

  const user = authenticator.isAuthenticated(request);

  const dnaEmpresaSettings = prismaIt(prismaClient.dnaEmpresaSettings.findFirst())

  const menuItemGroups = prismaClient.menuItemGroup.findMany({
    where: {
      deletedAt: null,
      visible: true
    }
  })

  const menuItemCategories = prismaClient.category.findMany({
    where: {
      type: "menu"
    }
  })

  const sizes = menuItemSizePrismaEntity.findAll()

  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
    dnaEmpresaSettings,
    sellingChannel,
    menuItemGroups,
    menuItemCategories,
    sizes
  ]);

  return defer({
    returnedData
  })
}


export interface AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext {
  items: MenuItemWithSellPriceVariations[]
  sellingChannel: MenuItemSellingChannel
  user: LoggedUser
}

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutlet() {

  const { returnedData } = useLoaderData<typeof loader>();


  return (
    <div className="flex flex-col gap-4">

      <Suspense fallback={<Loading />}>
        <Await resolve={returnedData}>
          {/* @ts-ignore */}
          {([menuItemsWithSellPriceVariations, user, dnaEmpresaSettings, sellingChannel, groups, categories, sizes]) => {

            {/* @ts-ignore */ }
            const [items, setItems] = useState<MenuItemsWithSellPriceVariations[]>(menuItemsWithSellPriceVariations || [])

            const [sortOrderType, setSortOrderType] = useState<SortOrderType>("default")

            const handleSort = (type: SortOrderType) => {
              setSortOrderType(type)

              let sortedItems: MenuItemWithSellPriceVariations[] = []

              switch (type) {
                case "alphabetical-asc":
                  sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name))
                  break;
                case "alphabetical-desc":
                  sortedItems = [...items].sort((a, b) => b.name.localeCompare(a.name))
                  break;
                case "price-asc":
                  sortedItems = [...items].sort((a, b) => {

                    const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
                    const aPrice = a.sellPriceVariations.find(predicateFn)?.priceAmount || 0;
                    const bPrice = b.sellPriceVariations.find(predicateFn)?.priceAmount || 0
                    return aPrice - bPrice;
                  });
                  break;
                case "price-desc":
                  sortedItems = [...items].sort((a, b) => {
                    const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
                    const aPrice = a.sellPriceVariations.find(predicateFn)?.priceAmount || 0;
                    const bPrice = b.sellPriceVariations.find(predicateFn)?.priceAmount || 0
                    return bPrice - aPrice;
                  });
                  break;
                case "profit-asc":
                  sortedItems = [...items].sort((a, b) => {
                    const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
                    const aPrice = a.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0;
                    const bPrice = b.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0
                    return aPrice - bPrice;
                  });
                  break;
                case "profit-desc":
                  sortedItems = [...items].sort((a, b) => {
                    const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
                    const aPrice = a.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0;
                    const bPrice = b.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0
                    return bPrice - aPrice;
                  });
                  break;
                case "default":
                  sortedItems = items
                  break;
                default:
                  break;
              }

              setItems(sortedItems)
            }


            return (
              <div className="flex flex-col">

                <div className="flex flex-col gap-2 py-2 md:py-0 md:grid md:grid-cols-8 md:items-center mb-4 bg-slate-50 px-1">
                  <MenuItemsFilters
                    initialItems={menuItemsWithSellPriceVariations}
                    groups={groups}
                    categories={categories}
                    onItemsChange={(filtered) => setItems(filtered)}
                    cnContainer="col-span-7"
                  />
                  <AlertsCostsAndSellPrice items={items} cnContainer="col-span-1 flex justify-center md:justify-end w-full col-span-1" />
                </div>

                <div className="flex flex-row gap-x-4  items-center justify-end col-span-7 mb-4">
                  <span className="text-xs">Ordenamento:</span>
                  <div className="flex flex-row gap-x-4 ">

                    <SortOrderOption
                      label="Padrão"
                      sortOrderType="default"
                      handleSort={handleSort}
                    />
                    <Separator orientation="vertical" className="h-4" />


                    <SortOrderOption
                      label="A-Z"
                      sortOrderType="alphabetical-asc"
                      handleSort={handleSort}
                    />
                    <SortOrderOption
                      label="Z-A"
                      sortOrderType="alphabetical-desc"
                      handleSort={handleSort}
                    />

                    <Separator orientation="vertical" className="h-4" />

                    <SortOrderOption
                      label="Preço crescente (Tamanho Medio)"
                      sortOrderType="price-asc"
                      handleSort={handleSort}
                    />
                    <SortOrderOption
                      label="Preço decrescente (Tamanho Medio)"
                      sortOrderType="price-desc"
                      handleSort={handleSort}
                    />

                    <Separator orientation="vertical" className="h-4" />

                    <SortOrderOption
                      label="Profito crescente (Tamanho Medio)"
                      sortOrderType="profit-asc"
                      handleSort={handleSort}
                    />
                    <SortOrderOption
                      label="Profito decrescente (Tamanho Medio)"
                      sortOrderType="profit-desc"
                      handleSort={handleSort}
                    />
                  </div>
                </div>


                <Outlet context={{ items, sellingChannel, user, sizes }} />
              </div>
            )

          }}
        </Await>
      </Suspense>


    </div>
  )
}


const SortOrderOption = ({
  label,
  sortOrderType,
  handleSort,
}: {
  label: string;
  sortOrderType: SortOrderType;
  handleSort: (type: SortOrderType) => void;
}) => {
  return (
    <span
      className="text-xs text-muted-foreground hover:underline hover:cursor-pointer"
      onClick={() => handleSort(sortOrderType)}
    >
      {label}
    </span>
  );
}

