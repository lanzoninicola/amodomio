import { useOutletContext } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import randomReactKey from "~/utils/random-react-key";
import { AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext } from "./admin.gerenciamento.cardapio.sell-price-management.$channel";
import { sl } from "date-fns/locale";

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelList() {
  const { items, sellingChannel, user, sizes } = useOutletContext<AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext>()

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
          profitPerc > 10 && profitPerc < sellingChannel.targetMarginPerc && "text-orange-500 font-semibold",
          profitPerc > 0 && profitPerc < 10 && "text-red-500 font-semibold",
          profitPerc >= sellingChannel.targetMarginPerc && "text-green-500 font-semibold",
          profitPerc < 0 && "text-red-500 font-semibold"
        )
      }>{profitPerc}%</span>
    )
  }

  const PriceInfo = ({ priceAmount, breakEvenAmount, profitPerc }: { priceAmount: number, breakEvenAmount: number, profitPerc: number }) => {

    const OtherChars = ({ children }: { children: React.ReactNode }) => {
      return (
        <span className="text-[12px] font-mono text-muted-foreground">{children}</span>
      )
    }

    return (
      <div className="grid grid-cols-2 w-full gap-x-2" >
        <p className="text-sm font-mono text-right">{formatDecimalPlaces(priceAmount)}</p>
        <div className="flex items-center">
          <OtherChars>{`(`}</OtherChars>
          <BreakEvenAmount amount={breakEvenAmount} />
          <OtherChars>{`-`}</OtherChars>
          <ProfitPerc profitPerc={profitPerc} />
          <OtherChars>{`)`}</OtherChars>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[500px] overflow-y-scroll">
      <ul className="grid grid-cols-5 mb-4 gap-x-2">
        <li className="text-[11px] uppercase flex items-center">Sabor</li>
        {sizes.map(s => (
          <li key={s.id} className="flex flex-col items-center gap-[2px] text-[11px] uppercase">
            <span>{s.name}</span>
            <span className="text-muted-foreground">R$ VV (BE - PR)</span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2">
        {items.map((menuItem: MenuItemWithSellPriceVariations) => (
          <>
            <li key={menuItem.menuItemId} className="grid grid-cols-5 gap-x-4 items-start">
              {/* Coluna 1: Nome do item */}
              <span className="text-sm">{menuItem.name}</span>

              {/* Colunas 2 a 5: Preço por tamanho */}
              {menuItem.sellPriceVariations.map((record, i) => {
                const minimumPriceAmountWithoutProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0

                return (
                  <div key={record.id ?? i} className="flex flex-col items-center text-xs">
                    <PriceInfo
                      priceAmount={record.priceAmount}
                      breakEvenAmount={minimumPriceAmountWithoutProfit}
                      profitPerc={record?.profitActualPerc ?? 0}
                    />

                    {(record.computedSellingPriceBreakdown?.custoFichaTecnica ?? 0) === 0 && (
                      <div className="flex items-center mt-1 gap-1">
                        <AlertCircleIcon className="h-4 w-4 text-red-500" />
                        <span className="text-red-500 text-[10px] font-semibold leading-tight">
                          Custo não definido
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}

            </li>
            <Separator className="mb-3" />
          </>
        ))}
      </ul>
    </div>
  )

}






