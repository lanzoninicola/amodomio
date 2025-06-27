import { Form, useActionData, useOutletContext } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import randomReactKey from "~/utils/random-react-key";
import { AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext } from "./admin.gerenciamento.cardapio.sell-price-management.$channel";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { MenuItemSellingPriceVariationAudit } from "@prisma/client";
import { ActionFunctionArgs } from "@remix-run/node";

import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { MenuItemSellingPriceVariationUpsertParams, menuItemSellingPriceVariationPrismaEntity } from "~/domain/cardapio/menu-item-selling-price-variation.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import toFixedNumber from "~/utils/to-fixed-number";
import createUUID from "~/utils/uuid";
import { toast } from "~/components/ui/use-toast";

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

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelEdit() {
  const { items, sellingChannel, user } = useOutletContext<AdminGerenciamentoCardapioSellPriceManagementSingleChannelOutletContext>()
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
    <div className="h-[500px] overflow-y-scroll">
      <ul>
        {
          // @ts-ignore
          items.map((menuItem: MenuItemWithSellPriceVariations) => {

            return (
              <li key={menuItem.menuItemId}>

                <Accordion type="single" collapsible className="border rounded-md px-4 py-2 mb-4">
                  <AccordionItem value="item-1">
                    <div className="flex flex-col w-full">
                      <AccordionTrigger>
                        <h3 className="text-md font-semibold">{menuItem.name} ({sellingChannel.name})</h3>
                      </AccordionTrigger>
                      <ul className="grid grid-cols-5 mb-4 gap-x-2">
                        {menuItem.sellPriceVariations.map((record) => {

                          const minimumPriceAmountWithProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withProfit ?? 0
                          const minimumPriceAmountWithoutProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0

                          return (
                            <li key={randomReactKey()} >

                              <div className="flex flex-col justify-center">
                                <p className="text-[11px] uppercase text-center ">{record.sizeName}</p>

                                <div className="flex flex-col gap-0">
                                  <div className="grid grid-cols-2 gap-2 justify-center">
                                    <div className="flex flex-col text-center">
                                      <p className="text-[11px] text-muted-foreground">Valor de venda:</p>
                                      <p className={
                                        cn(
                                          "text-[12px] font-mono",
                                          record.priceAmount > 0 && minimumPriceAmountWithProfit > record.priceAmount && 'bg-orange-200',
                                          record.priceAmount > 0 && minimumPriceAmountWithoutProfit > record.priceAmount && 'bg-red-400',
                                        )
                                      }
                                      >{formatDecimalPlaces(record.priceAmount)}</p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <div className="flex flex-col text-center">
                                        {/* <p className="text-[11px] text-muted-foreground">Valor recomendado:</p> */}

                                        <p className="text-[11px] text-muted-foreground">Break-even:</p>
                                        <p className="text-[12px] font-mono">{formatDecimalPlaces(minimumPriceAmountWithoutProfit)}</p>
                                      </div>
                                      <div className="flex flex-col text-center">
                                        {/* <p className="text-[11px] text-muted-foreground">Valor recomendado:</p> */}

                                        <MinimumSellPriceLabelDialog computedSellingPriceBreakdown={record.computedSellingPriceBreakdown} />
                                        <p className="text-[12px] font-mono">{formatDecimalPlaces(minimumPriceAmountWithProfit)}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <Separator className="my-2 px-4" />
                                  <div className="flex justify-center">
                                    <span className={
                                      cn(
                                        "text-xs text-muted-foreground",
                                        record.profitActualPerc > 10 && record.profitActualPerc < sellingChannel.targetMarginPerc && "text-orange-500 font-semibold",
                                        record.profitActualPerc > 0 && record.profitActualPerc < 10 && "text-red-500 font-semibold",
                                        record.profitActualPerc >= sellingChannel.targetMarginPerc && "text-green-500 font-semibold",
                                        record.profitActualPerc < 0 && "text-red-500 font-semibold"
                                      )
                                    }>Profitto real: {record?.profitActualPerc ?? 0}%</span>
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
                    <AccordionContent>

                      <Separator className="my-4" />

                      <ul className="grid grid-cols-5 gap-x-1">
                        {menuItem.sellPriceVariations.map((record) => (

                          <section key={randomReactKey()} className="mb-8">

                            <ul className="flex gap-6">
                              <li key={record.sizeId} className={
                                cn(
                                  "p-2 rounded-md",
                                )
                              }>
                                <div className="flex flex-col">
                                  <div className={
                                    cn(
                                      "mb-2",
                                      record.sizeKey === "pizza-medium" && "grid place-items-center bg-black",
                                    )
                                  }>

                                    <h4 className={
                                      cn(
                                        "text-[12px] font-medium uppercase tracking-wider",
                                        record.sizeKey === "pizza-medium" && "font-semibold text-white",
                                      )
                                    }>
                                      {record.sizeName}
                                    </h4>
                                  </div>

                                  <Form method="post" className="flex flex-col gap-1 justify-center items-center">
                                    <div className="flex flex-col gap-2 mb-2">
                                      <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                                      <input type="hidden" name="menuItemSellPriceVariationId" value={record.menuItemSellPriceVariationId ?? ""} />
                                      <input type="hidden" name="menuItemSellingChannelId" value={sellingChannel.id ?? ""} />
                                      <input type="hidden" name="menuItemSizeId" value={record.sizeId ?? ""} />
                                      <input type="hidden" name="updatedBy" value={record.updatedBy || user?.email || ""} />
                                      <input type="hidden" name="previousPriceAmount" value={record.previousPriceAmount} />

                                      <input type="hidden" name="recipeCostAmount" value={record.computedSellingPriceBreakdown?.custoFichaTecnica ?? 0} />
                                      <input type="hidden" name="packagingCostAmount" value={record.computedSellingPriceBreakdown?.packagingCostAmount ?? 0} />
                                      <input type="hidden" name="doughCostAmount" value={record.computedSellingPriceBreakdown?.doughCostAmount ?? 0} />
                                      <input type="hidden" name="wasteCostAmount" value={record.computedSellingPriceBreakdown?.wasteCost ?? 0} />
                                      <input type="hidden" name="sellingPriceExpectedAmount" value={record.computedSellingPriceBreakdown?.minimumPrice.priceAmount.withProfit ?? 0} />
                                      <input type="hidden" name="profitExpectedPerc" value={record.computedSellingPriceBreakdown?.channel.targetMarginPerc ?? 0} />

                                      <div className="grid grid-cols-2 gap-2">

                                        <div className="flex flex-col gap-1 items-center">
                                          <div className="flex flex-col gap-y-0">
                                            <span className="text-muted-foreground text-[11px]">Novo preço:</span>
                                            <NumericInput name="priceAmount" defaultValue={record.priceAmount} />
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
                                            <MinimumSellPriceLabelDialog computedSellingPriceBreakdown={record.computedSellingPriceBreakdown} />
                                            <NumericInput name="minimumPriceAmount" defaultValue={record.computedSellingPriceBreakdown?.minimumPrice.priceAmount.withProfit} readOnly className="bg-slate-100" />
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
                                        <span className="text-xs">Preço atual: {record.priceAmount}</span>
                                        <span className="text-xs text-muted-foreground">Preço anterior: {record.previousPriceAmount}</span>
                                      </div>
                                    </div>


                                  </Form>
                                </div>
                              </li>

                            </ul>
                          </section>
                        ))}

                      </ul>

                      {/* <Form method="post" className="flex gap-2">
                      <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                      <input type="hidden" name="updatedBy" value={user?.email || ""} />
                      <SubmitButton
                        actionName="menu-item-sell-price-variation-upsert-all-recommended-input"
                        tabIndex={0}
                        cnContainer="bg-white border w-full hover:bg-slate-200"
                        cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                        hideIcon
                        idleText="Aceitar todas as propostas"
                        loadingText="Aceitando..."
                      />
                    </Form> */}

                    </AccordionContent>
                  </AccordionItem>
                </Accordion>


              </li>
            )
          })
        }
      </ul>
    </div>
  )

}


interface MinimumPriceLabelDialogProps {
  computedSellingPriceBreakdown: ComputedSellingPriceBreakdown | undefined | null

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


