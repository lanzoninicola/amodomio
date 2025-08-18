import { Separator } from "~/components/ui/separator";
import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import { Size } from "~/domain/size/size.model.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/react";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

import prismaClient from "~/lib/prisma/client.server";
import { badRequest } from "~/utils/http-response.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { MenuItemsFilters } from "~/domain/cardapio/components/menu-items-filters/menu-items-filters";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import { Button } from "~/components/ui/button";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const sellingChannelKey = params.channel as string;
  const currentSellingChannel = await prismaClient.menuItemSellingChannel.findFirst({
    where: {
      key: sellingChannelKey,
    },
  })

  if (!currentSellingChannel) {
    return badRequest(`Can not find selling channel with key ${sellingChannelKey}`)
  }

  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadMany({
    channelKey: currentSellingChannel.key,
  })

  const user = authenticator.isAuthenticated(request);


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
    currentSellingChannel,
    menuItemGroups,
    menuItemCategories,
    sizes
  ]);

  return defer({
    returnedData
  })
}

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelList() {
  const { returnedData } = useLoaderData<typeof loader>();

  return (

    <Suspense fallback={<Loading />}>
      <Await resolve={returnedData}>
        {/* @ts-ignore */}
        {([menuItemsWithSellPriceVariations, user, currentSellingChannel, groups, categories, sizes]) => {
          const [items, setItems] = useState<MenuItemWithSellPriceVariations[]>(menuItemsWithSellPriceVariations || [])

          const BreakEvenAmount = ({ amount }: { amount: number }) => {
            return (
              <span className="text-[12px] uppercase text-muted-foreground font-mono ">{`R$${formatDecimalPlaces(amount)}`}</span>
            )

          }

          const ProfitPerc = ({ profitPerc }: { profitPerc: number }) => {
            return (
              <span className={
                cn(
                  "text-xs text-muted-foreground",
                  profitPerc > 10 && profitPerc < currentSellingChannel.targetMarginPerc && "text-orange-500 font-semibold",
                  profitPerc > 0 && profitPerc < 10 && "text-red-500 font-semibold",
                  profitPerc >= currentSellingChannel.targetMarginPerc && "text-green-500 font-semibold",
                  profitPerc < 0 && "text-red-500 font-semibold"
                )
              }>{profitPerc}%</span>
            )
          }

          const PriceInfo = ({ priceAmount, breakEvenAmount, profitPerc, sizeName, cnContainer }:
            { priceAmount: number, breakEvenAmount: number, profitPerc: number, sizeName: Size["name"], cnContainer: string }) => {

            const OtherChars = ({ children, ...props }: { children: React.ReactNode }) => {
              return (
                <span className="text-[12px] font-mono text-muted-foreground">{children}</span>
              )
            }

            return (
              <div className={cn("flex flex-col w-full", cnContainer)} >
                <span className="uppercase text-center md:hidden text-[11px] font-semibold">{sizeName}</span>
                <div className="flex flex-row gap-1 items-center md:grid md:grid-cols-2 md:gap-x-2">
                  <p className="text-sm font-mono text-center md:text-right ">{formatDecimalPlaces(priceAmount)}</p>
                  <div className="flex items-center">
                    <OtherChars>{`(`}</OtherChars>
                    <BreakEvenAmount amount={breakEvenAmount} />
                    <OtherChars>{`|`}</OtherChars>
                    <ProfitPerc profitPerc={profitPerc} />
                    <OtherChars>{`)`}</OtherChars>
                  </div>
                </div>
              </div>
            );
          }

          const exportRenderedToCSV = () => {
            // 1) Cabeçalhos dinâmicos por tamanho
            const sizeNames = sizes.map((s: { name: string }) => s.name);
            const headers = [
              "Sabor",
              ...sizeNames.flatMap((n: string) => [
                `${n} Preco`,
                `${n} BreakEven`,
                `${n} Lucro%`,
              ]),
            ];

            // 2) Linhas: percorre os itens filtrados/renderizados
            const rows = items.map((mi) => {
              // mapeia por nome do tamanho para acesso O(1)
              const bySize: Record<string, any> = {};
              mi.sellPriceVariations.forEach((r: any) => {
                bySize[r.sizeName] = r;
              });

              const row: (string | number)[] = [mi.name];

              sizeNames.forEach((sn) => {
                const r = bySize[sn];
                const price = r?.priceAmount ?? "";
                const be =
                  r?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount?.breakEven ??
                  "";
                const perc = r?.profitActualPerc ?? "";
                row.push(price, be, perc);
              });

              return row;
            });

            // 3) Monta CSV (separador ;) e dispara download
            const csv =
              headers.join(";") + "\n" + rows.map((r) => r.join(";")).join("\n");

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
            const a = document.createElement("a");
            a.href = url;
            a.download = `sell-price-${currentSellingChannel.key}-${ts}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          };

          return (

            <div className="flex flex-col" >
              <div className="flex flex-col gap-2 py-2 md:py-0 md:grid md:grid-cols-8 md:items-center mb-4 bg-slate-50 px-1">
                <MenuItemsFilters
                  initialItems={menuItemsWithSellPriceVariations}
                  groups={groups}
                  categories={categories}
                  onItemsChange={(filtered) => setItems(filtered)}
                  cnContainer="col-span-6 md:col-span-6"
                />

                {/* Botão de Exportar */}
                <div className="col-span-1 flex justify-center md:justify-end">
                  <Button variant="outline" size="sm" onClick={exportRenderedToCSV}>
                    Exportar CSV
                  </Button>
                </div>

                <AlertsCostsAndSellPrice items={items} cnContainer="col-span-1 flex justify-center md:justify-end w-full col-span-1" />
              </div>


              <div className="md:h-[500px] overflow-y-scroll">
                <ul className="hidden md:grid md:grid-cols-6 md:mb-4 md:gap-x-2">
                  <li className="text-[11px] uppercase flex items-center">Sabor</li>
                  {sizes.map((s, i) => (
                    <li key={s.id} className={cn("flex flex-col items-center gap-[2px] text-[11px] uppercase",
                      i % 2 === 0 && "border-x"
                    )}>
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-muted-foreground">R$ VV (BE - PR)</span>
                    </li>
                  ))}
                </ul>
                <Separator className="my-1" />
                <Separator className="mb-6" />
                <ul className="flex flex-col gap-2">
                  {items.map((menuItem: MenuItemWithSellPriceVariations) => (
                    <li key={menuItem.menuItemId} className="px-1 py-2 hover:bg-blue-100 hover:font-semibold">
                      <div className="flex flex-col w-full  items-center md:grid md:grid-cols-6 gap-x-4 md:items-start">
                        {/* Coluna 1: Nome do item */}
                        <span className="text-xs mb-2 md:mb-0 uppercase ">{menuItem.name}</span>

                        {/* Colunas 2 a 5: Preço por tamanho */}
                        {menuItem.sellPriceVariations.map((record, i) => {
                          const minimumPriceAmountWithoutProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0

                          return (
                            <div key={record.id ?? i} className={
                              cn(
                                "flex flex-col items-center text-xs mb-2 md:mb-0",

                              )
                            }>
                              <PriceInfo
                                priceAmount={record.priceAmount}
                                breakEvenAmount={minimumPriceAmountWithoutProfit}
                                profitPerc={record?.profitActualPerc ?? 0}
                                sizeName={record.sizeName}
                                cnContainer={cn(i % 2 === 0 && "border-x")}
                              />

                              {/* {(record.computedSellingPriceBreakdown?.custoFichaTecnica ?? 0) === 0 && (
                      <div className="flex items-center mt-1 gap-1">
                        <AlertCircleIcon className="h-4 w-4 text-red-500" />
                        <span className="text-red-500 text-[10px] font-semibold leading-tight">
                          Custo não definido
                        </span>
                      </div>
                    )} */}
                            </div>
                          )
                        })}

                      </div>
                      {/* <Separator /> */}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )

        }}
      </Await>
    </Suspense>

  )

}






