import { useOutletContext } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import randomReactKey from "~/utils/random-react-key";
import { AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext } from "./admin.gerenciamento.cardapio.sell-price-management.$channel";

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelList() {
  const { items, sellingChannel, user } = useOutletContext<AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext>()

  return (
    <div className="h-[500px] overflow-y-scroll">
      <ul>
        {
          // @ts-ignore
          items.map((menuItem: MenuItemWithSellPriceVariations) => {

            return (
              <li key={menuItem.menuItemId}>

                <div className="grid grid-cols-8">
                  <span className="col-span-1">{menuItem.name}</span>

                  <ul className="grid grid-cols-4  mb-4 gap-x-2 col-span-7">
                    {menuItem.sellPriceVariations.map((record) => {

                      const minimumPriceAmountWithProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withProfit ?? 0
                      const minimumPriceAmountWithoutProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0

                      return (
                        <li key={randomReactKey()} >

                          <div className="flex flex-col justify-center items-center">
                            <p className="text-[11px] uppercase ">{record.sizeName}
                              <span className="text-[12px] uppercase text-muted-foreground font-mono "> ({`BE R$${formatDecimalPlaces(minimumPriceAmountWithoutProfit)}`})</span>
                            </p>


                            <div className="flex flex-col gap-0">
                              <div className="grid grid-cols-2 gap-2 justify-center">
                                <div className="flex flex-col text-center">
                                  <p className="text-[11px] text-muted-foreground">Valor de venda:</p>
                                  <p className={
                                    cn(
                                      "text-[12px] font-mono",
                                    )
                                  }
                                  >{formatDecimalPlaces(record.priceAmount)}</p>
                                </div>
                                <div className="flex flex-col text-center">
                                  <p className="text-[11px] text-muted-foreground">Profito real:</p>
                                  <div className="flex justify-center">
                                    <span className={
                                      cn(
                                        "text-xs text-muted-foreground",
                                        record.profitActualPerc > 10 && record.profitActualPerc < sellingChannel.targetMarginPerc && "text-orange-500 font-semibold",
                                        record.profitActualPerc > 0 && record.profitActualPerc < 10 && "text-red-500 font-semibold",
                                        record.profitActualPerc >= sellingChannel.targetMarginPerc && "text-green-500 font-semibold",
                                        record.profitActualPerc < 0 && "text-red-500 font-semibold"
                                      )
                                    }>{record?.profitActualPerc ?? 0}%</span>
                                  </div>
                                </div>


                              </div>

                            </div>

                            {(record.computedSellingPriceBreakdown?.custoFichaTecnica ?? 0) === 0 && (
                              <div className="flex gap-2 items-center mt-2">
                                <AlertCircleIcon className="h-4 w-4 text-red-500" />
                                <span className="text-red-500 text-xs font font-semibold">Custo ficha tecnica não definido</span>
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <Separator className="my-2" />
              </li>

            )
          })
        }
      </ul>
    </div>
  )

}






