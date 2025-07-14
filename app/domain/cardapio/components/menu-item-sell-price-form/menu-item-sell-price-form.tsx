import { Form } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { SellPriceVariation } from "../../menu-item.types";
import { MenuItemSellingChannel } from "@prisma/client";
import { LoggedUser } from "~/domain/auth/types.server";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";


interface MenuItemSellPriceFormProps {
  menuItemId: string,
  sellPriceVariation: SellPriceVariation
  sellingChannel: MenuItemSellingChannel
  user: LoggedUser

}

export default function MenuItemSellPriceForm({ menuItemId, sellPriceVariation, sellingChannel, user }: MenuItemSellPriceFormProps) {


  return (
    <Form method="post" className="flex flex-col gap-1 justify-center items-center">
      <div className="flex flex-col gap-2 mb-2">
        <input type="hidden" name="menuItemId" value={menuItemId} />
        <input type="hidden" name="menuItemSellPriceVariationId" value={sellPriceVariation.menuItemSellPriceVariationId ?? ""} />
        <input type="hidden" name="menuItemSellingChannelId" value={sellingChannel.id ?? ""} />
        <input type="hidden" name="menuItemSizeId" value={sellPriceVariation.sizeId ?? ""} />
        <input type="hidden" name="updatedBy" value={sellPriceVariation.updatedBy || user?.email || ""} />
        <input type="hidden" name="previousPriceAmount" value={sellPriceVariation.previousPriceAmount} />

        <input type="hidden" name="recipeCostAmount" value={sellPriceVariation.computedSellingPriceBreakdown?.custoFichaTecnica ?? 0} />
        <input type="hidden" name="packagingCostAmount" value={sellPriceVariation.computedSellingPriceBreakdown?.packagingCostAmount ?? 0} />
        <input type="hidden" name="doughCostAmount" value={sellPriceVariation.computedSellingPriceBreakdown?.doughCostAmount ?? 0} />
        <input type="hidden" name="wasteCostAmount" value={sellPriceVariation.computedSellingPriceBreakdown?.wasteCost ?? 0} />
        <input type="hidden" name="sellingPriceExpectedAmount" value={sellPriceVariation.computedSellingPriceBreakdown?.minimumPrice.priceAmount.withProfit ?? 0} />
        <input type="hidden" name="profitExpectedPerc" value={sellPriceVariation.computedSellingPriceBreakdown?.channel.targetMarginPerc ?? 0} />

        <div className="flex flex-row justify-between items-center mb-4">
          <span className="text-xs"> Visualizar no cardapio:</span>
          <Switch name="showOnCardapio" defaultChecked={sellPriceVariation?.showOnCardapio || false} />
        </div>
        <div className="grid grid-cols-2 gap-2">

          <div className="flex flex-col gap-1 items-center">
            <div className="flex flex-col gap-y-0">
              <span className="text-muted-foreground text-[11px]">Novo preço:</span>
              <NumericInput name="priceAmount" defaultValue={sellPriceVariation.priceAmount} />
            </div>
            <SubmitButton
              actionName="upsert-by-user-input"
              tabIndex={0}
              variant={"outline"}
              cnContainer="md:py-0 hover:bg-slate-200 "
              cnLabel="text-[11px] tracking-widest text-black uppercase"
              iconColor="black"
            />
          </div>

          <div className="flex flex-col gap-1 items-center">
            <div className="flex flex-col gap-y-0 ">
              <MinimumSellPriceLabelDialog computedSellingPriceBreakdown={sellPriceVariation.computedSellingPriceBreakdown} />
              <NumericInput name="minimumPriceAmount" defaultValue={sellPriceVariation.computedSellingPriceBreakdown?.minimumPrice.priceAmount.withProfit} readOnly className="bg-slate-100" />
            </div>
            {/* <SubmitButton
                                              actionName="upsert-by-minimum-input"
                                              tabIndex={0}
                                              cnContainer="bg-white border w-full hover:bg-slate-200"
                                              cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                                              hideIcon
                                              idleText="Aceitar proposta"
                                              loadingText="Aceitando..."
                                            /> */}
          </div>

        </div>




        <div className="flex flex-col gap-1">
          <span className="text-xs">Preço atual: {sellPriceVariation.priceAmount}</span>
          <span className="text-xs text-muted-foreground">Preço anterior: {sellPriceVariation.previousPriceAmount}</span>
        </div>
      </div>

      {(sellPriceVariation.computedSellingPriceBreakdown?.custoFichaTecnica ?? 0) === 0 && (
        <div className="flex gap-2 items-center mt-2">
          <AlertCircleIcon className="h-4 w-4 text-red-500" />
          <span className="text-red-500 text-xs font font-semibold">Custo ficha tecnica não definido</span>
        </div>
      )}


    </Form>
  )
}

function MinimumSellPriceLabelDialog({ computedSellingPriceBreakdown }: MinimumPriceLabelDialogProps
) {


  const Amount = ({ children }: { children: React.ReactNode }) => {
    return (
      <span className="font-mono col-span-1">
        {children}
      </span>
    )
  }

  const Label = ({ children, cnContainer }: { children: React.ReactNode, cnContainer?: string }) => {
    return (
      <span className={cn("text-sm col-span-3", cnContainer)}>
        {children}
      </span>
    )
  }

  const cspb = { ...computedSellingPriceBreakdown }



  return (
    <Dialog>
      <DialogTrigger asChild className="w-full">
        <span className="text-muted-foreground text-[11px] cursor-pointer hover:underline">{`Val. rec. (lucro ${cspb.channel?.targetMarginPerc}%)`}</span>
      </DialogTrigger>
      <DialogContent>

        <div className="flex flex-col">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 items-center">
              <Label>Custo Ficha Tecnica</Label>
              <Amount>{cspb?.custoFichaTecnica ?? 0}</Amount>
            </div>

            <div className="grid grid-cols-4 items-center">
              <Label>Desperdício</Label>
              <Amount>{cspb?.wasteCost}</Amount>
            </div>

            <div className="grid grid-cols-4 items-center">
              <Label>Custo Massa</Label>
              <Amount>{cspb?.doughCostAmount}</Amount>
            </div>


            <div className="grid grid-cols-4 items-center">
              <Label>Custo Embalagens</Label>
              <Amount>{cspb?.packagingCostAmount}</Amount>
            </div>


            <Separator className="my-4" />

            {
              cspb?.channel?.isMarketplace && (
                <>
                  <Label>{`Custo Marketplace (${cspb?.channel?.name})`}</Label>
                  <div className="grid grid-cols-4 items-center">
                    <Label cnContainer="text-[12px]">Taxa mensal</Label>
                    <Amount>{cspb?.channel?.feeAmount}</Amount>
                  </div>
                  <div className="grid grid-cols-4 items-center">
                    <Label cnContainer="text-[12px]">Taxa transação </Label>
                    <Amount>{cspb?.channel?.taxPerc}</Amount>
                  </div>

                  <div className="grid grid-cols-4 items-center">
                    <Label cnContainer="text-[12px]">Taxa pagamento online</Label>
                    <Amount>{cspb?.channel?.onlinePaymentTaxPerc}</Amount>
                  </div>

                  <Separator className="my-4" />
                </>
              )
            }



            <div className="grid grid-cols-4 items-center">
              <Label cnContainer="font-semibold">Total Custo</Label>
              <Amount>{
                Number((cspb?.custoFichaTecnica ?? 0)
                  + (cspb?.wasteCost ?? 0)
                  + (cspb?.doughCostAmount ?? 0)
                  + (cspb?.packagingCostAmount ?? 0)
                  + (cspb?.channel?.taxPerc ?? 0)).toFixed(2)
              }</Amount>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2">
              <Label cnContainer="font-semibold">{`Preço de venda minimo`}</Label>
              <div className="grid grid-cols-4 items-center">
                <span className="text-xs col-span-3">Sem profito (com cobertura custos fixos)</span>
                <Amount>{Number(cspb?.minimumPrice?.priceAmount.breakEven ?? 0).toFixed(2)}</Amount>
              </div>

              <div className="grid grid-cols-4 items-center mb-2">
                <span className="text-xs col-span-3">Com profito</span>
                <Amount>{Number(cspb?.minimumPrice?.priceAmount.withProfit ?? 0).toFixed(2)}</Amount>
              </div>

              <span className="text-[12px] font-mono">{cspb?.minimumPrice?.formulaExplanation}</span>
              <span className="text-[12px] font-mono">{cspb?.minimumPrice?.formulaExpression}</span>
            </div>

            <Separator className="my-4" />
          </div>
          <DialogClose asChild>
            <div className="w-full px-4 py-6">
              <Button type="button" variant="secondary" className="w-full" >
                <span className=" tracking-wide font-semibold uppercase">Fechar</span>
              </Button>
            </div>

          </DialogClose>
        </div>
      </DialogContent>
    </Dialog >
  )
}