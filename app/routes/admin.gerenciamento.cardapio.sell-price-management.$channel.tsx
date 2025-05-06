import { MenuItemPriceVariation } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData, defer, Form, useActionData, redirect } from "@remix-run/react";
import { Suspense, useState } from "react";
import OptionTab from "~/components/layout/option-tab/option-tab";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

import { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity.server";
import { MenuItemSellingPriceVariationUpsertParams, menuItemSellingPriceVariationPrismaEntity } from "~/domain/cardapio/menu-item-selling-price-variation.entity.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonStringify } from "~/utils/json-helper";
import randomReactKey from "~/utils/random-react-key";
import toFixedNumber from "~/utils/to-fixed-number";

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

  const data = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
    dnaEmpresaSettings,
    sellingChannel
  ]);

  return defer({
    data
  })
}

export async function action({ request }: ActionFunctionArgs) {

  let formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  console.log({ _action, values })

  if (_action === "menu-item-sell-price-variation-upsert-user-input") {

    const menuItemSellPriceVariationId = values?.menuItemSellPriceVariationId as string
    const menuItemSellingChannelId = values?.menuItemSellingChannelId as string
    const menuItemSizeId = values?.menuItemSizeId as string
    const menuItemId = values?.menuItemId as string
    const priceAmount = toFixedNumber(values?.priceAmount, 2) || 0
    const previousPriceAmount = toFixedNumber(values?.previousPriceAmount, 2) || 0

    // at the moment we are not using the discount percentage
    const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)

    // at the moment we are not using the showOnCardapioAt
    const showOnCardapio = values?.showOnCardapio === "on" ? true : false

    const updatedBy = values?.updatedBy as string

    const nextPrice: MenuItemSellingPriceVariationUpsertParams = {
      menuItemId,
      menuItemSellingChannelId,
      menuItemSizeId,
      priceAmount: priceAmount,
      previousPriceAmount: previousPriceAmount,
      discountPercentage,
      showOnCardapio,
      updatedBy,
      showOnCardapioAt: null,
    }

    const [err, result] = await prismaIt(menuItemSellingPriceVariationPrismaEntity.upsert(menuItemSellPriceVariationId, nextPrice))

    console.log({ result, err })

    if (err) {
      return badRequest(err)
    }

    return ok(`O preço de venda foi atualizado com sucesso`)
  }



  return ok("Elemento atualizado com successo")
}

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannel() {
  const { data } = useLoaderData<typeof loader>()
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
        <Await resolve={data}>
          {/* @ts-ignore */}
          {([menuItemsWithSellPriceVariations, user, dnaEmpresaSettings, sellingChannel]) => {


            {/* @ts-ignore */ }
            const [items, setItems] = useState<MenuItemsWithSellPriceVariations[]>(menuItemsWithSellPriceVariations.filter(item => item.visible === true && item.active === true) || [])

            const [optVisibleItems, setOptVisibleItems] = useState<boolean | null>(true)
            const [optActiveItems, setOptActiveItems] = useState<boolean | null>(null)

            const handleOptionVisibileItems = (state: boolean) => {
              setOptVisibleItems(state)
              setOptActiveItems(null)
              // @ts-ignore
              setItems(menuItemsWithSellPriceVariations.filter(item => item.visible === state && item.active === true))
            }
            const handleOptionActiveItems = (state: boolean) => {
              setOptActiveItems(state)
              setOptVisibleItems(null)
              // @ts-ignore
              setItems(menuItemsWithSellPriceVariations.filter(item => item.active === state))
            }

            return (
              <div className="flex flex-col">
                <div className="flex gap-4 items-center justify-center">
                  <OptionTab label="Venda ativa" onClickFn={() => handleOptionVisibileItems(true)} state={true} highlightCondition={optVisibleItems === true && optActiveItems === null} />
                  <span>-</span>
                  <OptionTab label="Venda pausada" onClickFn={() => handleOptionVisibileItems(false)} state={false} highlightCondition={optVisibleItems === false && optActiveItems === null} />
                  <span>-</span>
                  <OptionTab label="Inativos" onClickFn={() => handleOptionActiveItems(false)} state={false} highlightCondition={optActiveItems === false && optVisibleItems === null} />

                </div>
                <Separator className="my-4" />
                <div className="h-[500px] overflow-y-scroll">
                  <ul>
                    {
                      // @ts-ignore
                      items.map((menuItem: MenuItemWithSellPriceVariations) => {

                        return (
                          <li key={menuItem.menuItemId} className="p-2">
                            <div className="flex justify-between  items-center mb-4 bg-slate-300 rounded-md px-4 py-1">

                              <h3 className="text-md font-semibold">{menuItem.name} ({sellingChannel.name})</h3>
                              <Form method="post" className="flex gap-2">
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
                              </Form>
                            </div>

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
                                            " mb-2",
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
                                            <input type="hidden" name="previousCostAmount" value={record.previousPriceAmount} />


                                            <div className="grid grid-cols-2 gap-2">

                                              <div className="flex flex-col gap-1 items-center">
                                                <div className="flex flex-col gap-y-0">
                                                  <span className="text-muted-foreground text-[11px]">Novo preço:</span>
                                                  <NumericInput name="priceAmount" defaultValue={record.priceAmount} />
                                                </div>
                                                <SubmitButton
                                                  actionName="menu-item-sell-price-variation-upsert-user-input"
                                                  tabIndex={0}
                                                  cnContainer="md:py-0 bg-slate-300 hover:bg-slate-400"
                                                  cnLabel="text-[11px] tracking-widest text-black uppercase"
                                                  iconColor="black"
                                                />
                                              </div>

                                              <div className="flex flex-col gap-1 items-center">
                                                <div className="flex flex-col gap-y-0">
                                                  <ValorPropostoLabelDialog computedSellingPriceBreakdown={record.computedSellingPriceBreakdown} />
                                                  <NumericInput name="recommendedCostAmount" defaultValue={record.computedSellingPriceBreakdown?.recommendedPrice.priceAmount} readOnly />
                                                </div>
                                                <SubmitButton
                                                  actionName="menu-item-sell-price-variation-upsert-recommended-input"
                                                  tabIndex={0}
                                                  cnContainer="bg-white border w-full hover:bg-slate-200"
                                                  cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                                                  hideIcon
                                                  idleText="Aceitar proposta"
                                                  loadingText="Aceitando..."
                                                />
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


                          </li>
                        )
                      })
                    }
                  </ul>
                </div>
              </div>
            )

          }}
        </Await>
      </Suspense>


    </div>
  )
}

interface ValorPropostoLabelDialogProps {
  computedSellingPriceBreakdown: ComputedSellingPriceBreakdown | null

}

function ValorPropostoLabelDialog({ computedSellingPriceBreakdown }: ValorPropostoLabelDialogProps
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
        <span className="text-muted-foreground text-[11px] cursor-pointer hover:underline">Valor proposto</span>
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
                  + (cspb?.packagingCostAmount ?? 0)
                  + (cspb?.channel?.taxPerc ?? 0)).toFixed(2)
              }</Amount>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-4 items-center">
                <span className="font-semibold text-sm col-span-3">Preço de venda sugerido</span>
                <Amount>{Number(cspb?.recommendedPrice?.priceAmount ?? 0).toFixed(2)}</Amount>
              </div>
              <span className="text-[12px] font-mono">{cspb?.recommendedPrice?.formulaExplanation}</span>
              <span className="text-[12px] font-mono">{cspb?.recommendedPrice?.formulaExpression}</span>
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