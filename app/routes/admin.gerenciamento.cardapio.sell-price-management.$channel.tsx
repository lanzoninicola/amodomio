import { MenuItemGroup, MenuItemSellingChannel, MenuItemSellingPriceVariationAudit } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData, defer, useActionData, Outlet } from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

import { ComputedSellingPriceBreakdown, menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { MenuItemSellingPriceVariationUpsertParams, menuItemSellingPriceVariationPrismaEntity } from "~/domain/cardapio/menu-item-selling-price-variation.entity.server";
import { MenuItemWithSellPriceVariations, SellPriceVariation } from "~/domain/cardapio/menu-item.types";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import toFixedNumber from "~/utils/to-fixed-number";
import createUUID from "~/utils/uuid";
import { MenuItemVisibilityFilterOption } from "./admin.gerenciamento.cardapio.main.list";
import { Category } from "~/domain/category/category.model.server";
import { jsonParse } from "~/utils/json-helper";
import { LoggedUser } from "~/domain/auth/types.server";

type SortOrderType = "default" | "alphabetical-asc" | "alphabetical-desc" | "price-asc" | "price-desc";

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

  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
    dnaEmpresaSettings,
    sellingChannel,
    menuItemGroups,
    menuItemCategories
  ]);

  return defer({
    returnedData
  })
}

export async function action({ request }: ActionFunctionArgs) {

  let formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);



  if (_action === "upsert-by-user-input") {

    const menuItemSellPriceVariationId = values?.menuItemSellPriceVariationId as string
    const menuItemSellingChannelId = values?.menuItemSellingChannelId as string
    const menuItemSizeId = values?.menuItemSizeId as string
    const menuItemId = values?.menuItemId as string
    const priceAmount = toFixedNumber(values?.priceAmount, 2) || 0

    const recipeCostAmount = toFixedNumber(values?.recipeCostAmount, 2) || 0
    const packagingCostAmount = toFixedNumber(values?.packagingCostAmount, 2) || 0
    const doughCostAmount = toFixedNumber(values?.doughCostAmount, 2) || 0
    const wasteCostAmount = toFixedNumber(values?.wasteCostAmount, 2) || 0
    const sellingPriceExpectedAmount = toFixedNumber(values?.sellingPriceExpectedAmount, 2) || 0
    const profitExpectedPerc = toFixedNumber(values?.profitExpectedPerc, 2) || 0

    // at the moment we are not using the discount percentage
    const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)

    // at the moment we are not using the showOnCardapioAt
    const showOnCardapio = values?.showOnCardapio === "on" ? true : false

    const updatedBy = values?.updatedBy as string

    const dnaPerc = (await menuItemSellingPriceUtilityEntity.getSellingPriceConfig()).dnaPercentage || 0
    const profitActualPerc = menuItemSellingPriceUtilityEntity.calculateProfitPercFromSellingPrice(
      priceAmount,
      {
        fichaTecnicaCostAmount: recipeCostAmount,
        packagingCostAmount,
        doughCostAmount,
        wasteCostAmount,
      },
      dnaPerc
    )

    const nextPrice: MenuItemSellingPriceVariationUpsertParams = {
      menuItemId,
      menuItemSellingChannelId,
      menuItemSizeId,
      priceAmount: priceAmount,
      priceExpectedAmount: sellingPriceExpectedAmount,
      profitActualPerc,
      profitExpectedPerc,
      discountPercentage,
      showOnCardapio,
      updatedBy,
      showOnCardapioAt: null,
    }

    const [err, result] = await prismaIt(menuItemSellingPriceVariationPrismaEntity.upsert(menuItemSellPriceVariationId, nextPrice))

    if (!result) {
      return badRequest(`Não foi possível atualizar o preço de venda`)
    }

    // start audit
    // in the future we should move this inside the class that handle the mutation of selling price for the item
    const nextPriceAudit: MenuItemSellingPriceVariationAudit = {
      id: createUUID(),
      menuItemId,
      menuItemSellingChannelId,
      menuItemSizeId,
      doughCostAmount,
      packagingCostAmount,
      recipeCostAmount,
      wasteCostAmount,
      sellingPriceExpectedAmount,
      profitExpectedPerc,
      sellingPriceActualAmount: priceAmount,
      profitActualPerc,
      dnaPerc,
      updatedBy,
      createdAt: new Date(),
      updatedAt: new Date(),

    }

    const [errAudit, auditResult] = await prismaIt(prismaClient.menuItemSellingPriceVariationAudit.create({
      data: nextPriceAudit
    }))

    if (err || errAudit) {
      return badRequest(err || errAudit || `Não foi possível atualizar o preço de venda`)
    }

    return ok(`O preço de venda foi atualizado com sucesso`)
  }





  return ok("Elemento atualizado com successo")
}
export interface AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext {
  items: MenuItemWithSellPriceVariations[]
  sellingChannel: MenuItemSellingChannel
  user: LoggedUser
}

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutlet() {

  const { returnedData } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();


  if (actionData && actionData.status > 399) {
    toast({
      title: "Erro",
      description: actionData.message,
    });
  }

  if (actionData && actionData.status === 200) {
    toast({
      title: "Ok",
      description: actionData.message,
    });
  }

  return (
    <div className="flex flex-col gap-4">

      <Suspense fallback={<Loading />}>
        <Await resolve={returnedData}>
          {/* @ts-ignore */}
          {([menuItemsWithSellPriceVariations, user, dnaEmpresaSettings, sellingChannel, groups, categories]) => {

            {/* @ts-ignore */ }
            const [items, setItems] = useState<MenuItemsWithSellPriceVariations[]>(menuItemsWithSellPriceVariations || [])

            const [search, setSearch] = useState("");
            const [currentGroup, setCurrentGroup] = useState<MenuItemGroup["key"] | null>(null);
            const [currentCategory, setCurrentCategory] = useState<Category | null>(null)
            const [currentFilter, setCurrentFilter] = useState<MenuItemVisibilityFilterOption | null>("active");

            // 🔥 Função que combina todos os filtros
            const applyFilters = (
              groupKey: MenuItemGroup["key"] | null,
              category: Category | null,
              visibility: MenuItemVisibilityFilterOption | null,
              searchValue: string
            ) => {

              console.log({ groupKey, category, visibility, searchValue })
              let filtered = items;

              // Filtro por grupo
              if (groupKey) {
                filtered = filtered.filter(item => item.group?.key === groupKey);
              }

              // Filtro por categoria
              if (category) {
                filtered = filtered.filter(i => i.category?.id === category?.id);
              }

              // Filtro por visibilidade
              if (visibility === "active") {
                filtered = filtered.filter(item => item.active === true);
              }
              if (visibility === "venda-pausada") {
                filtered = filtered.filter(item => item.active === true && item.visible === false);
              }

              // Filtro por busca
              if (searchValue) {
                filtered = filtered.filter(item =>
                  item.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
                  item.ingredients?.toLowerCase().includes(searchValue.toLowerCase())
                );
              }

              setItems(filtered);
            };

            const handleVisibilityChange = (visibility: MenuItemVisibilityFilterOption) => {
              setCurrentFilter(visibility);
              applyFilters(currentGroup, currentCategory, visibility, search);
            };

            const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value;
              setSearch(value);
              applyFilters(currentGroup, currentCategory, currentFilter, value);
            };


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
                case "default":
                  sortedItems = menuItemsWithSellPriceVariations
                  break;
                default:
                  break;
              }

              setItems(sortedItems)
            }

            // Handlers
            const handleGroupChange = (groupKey: MenuItemGroup["key"] | null) => {
              setCurrentGroup(groupKey);
              applyFilters(groupKey, currentCategory, currentFilter, search);
            };

            const handleCategoryChange = (category: Category | null) => {
              setCurrentCategory(category);
              applyFilters(currentGroup, currentCategory, currentFilter, search);
            };

            // Primeira renderização
            useEffect(() => {
              applyFilters(currentGroup, currentCategory, currentFilter, search);
            }, []);


            return (
              <div className="flex flex-col">

                <div className="grid grid-cols-8 gap-4 items-center bg-slate-50 py-2 px-4 mb-4">

                  {/* Select de grupo */}
                  <Select name="group"
                    onValueChange={(value) => {
                      const parsed = value ? jsonParse(value) : null;
                      handleGroupChange(parsed?.key || null);
                    }}
                  >
                    <SelectTrigger className="w-full md:col-span-1">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os grupos</SelectItem>
                      {groups.sort((a, b) => a.sortOrderIndex - b.sortOrderIndex).map(g => (
                        <SelectItem key={g.id} value={JSON.stringify(g)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>


                  {/* Select de categorias */}
                  <Select name="category"
                    onValueChange={(value) => {
                      handleCategoryChange(jsonParse(value) || null);
                    }}
                    disabled={currentGroup === null}
                  >
                    <SelectTrigger className="w-full md:col-span-1">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as categorias</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={JSON.stringify(c)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>


                  {/* Select de Visibilidade */}
                  <Select
                    onValueChange={(value) => handleVisibilityChange(value as MenuItemVisibilityFilterOption)}
                    defaultValue={"active"}
                  >
                    <SelectTrigger className="w-full bg-white md:col-span-1">
                      <SelectValue placeholder="Filtrar vendas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Venda ativa</SelectItem>
                      <SelectItem value="venda-pausada">Venda pausada</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="grid place-items-center rounded-sm col-span-4">
                    <Input name="search" className="w-full py-4 text-lg bg-white " placeholder="Pesquisar o sabor..." onChange={(e) => handleSearch(e)} value={search} />
                  </div>

                  <AlertsCostsAndSellPrice items={items} cnContainer="col-span-1 flex justify-end w-full" />
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
                  </div>
                </div>
                <Outlet context={{ items, sellingChannel, user }} />
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
