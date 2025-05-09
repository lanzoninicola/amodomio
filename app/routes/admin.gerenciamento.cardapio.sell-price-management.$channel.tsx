import { MenuItemPriceVariation } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData, defer, Form, useActionData } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { Suspense, useState } from "react";
import OptionTab from "~/components/layout/option-tab/option-tab";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

import { ComputedSellingPriceBreakdown } from "~/domain/cardapio/menu-item-selling-price-utility.entity.server";
import { MenuItemSellingPriceVariationUpsertParams, menuItemSellingPriceVariationPrismaEntity } from "~/domain/cardapio/menu-item-selling-price-variation.entity.server";
import { MenuItemWithSellPriceVariations, SellPriceVariation } from "~/domain/cardapio/menu-item.types";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import { badRequest, ok } from "~/utils/http-response.server";
import randomReactKey from "~/utils/random-react-key";
import toFixedNumber from "~/utils/to-fixed-number";

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

  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
    dnaEmpresaSettings,
    sellingChannel
  ]);

  return defer({
    returnedData
  })
}

export async function action({ request }: ActionFunctionArgs) {

  let formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  console.log({ _action, values })

  if (_action === "upsert-by-user-input") {

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



    if (err) {
      return badRequest(err)
    }

    return ok(`O preço de venda foi atualizado com sucesso`)
  }





  return ok("Elemento atualizado com successo")
}

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannel() {
  const { returnedData } = useLoaderData<typeof loader>()
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

            const [search, setSearch] = useState("")

            const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
              const allItems = menuItemsWithSellPriceVariations.filter(item => item.visible === true && item.active === true)

              const value = event.target.value

              setSearch(value)

              if (!value || value.length === 0 || value === "") {
                return setItems(allItems) // ← corrigido
              }

              const searchedItems = allItems.filter(item => {
                return (
                  item.name?.toLowerCase().includes(value.toLowerCase()) ||
                  item.ingredients?.toLowerCase().includes(value.toLowerCase())
                )
              })

              setItems(searchedItems)
            }

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
                default:
                  break;
              }

              setItems(sortedItems)
            }


            return (
              <div className="flex flex-col">

                <div className="flex gap-4 items-center justify-center mt-4">
                  <OptionTab label="Venda ativa" onClickFn={() => handleOptionVisibileItems(true)} state={true} highlightCondition={optVisibleItems === true && optActiveItems === null} />
                  <span>-</span>
                  <OptionTab label="Venda pausada" onClickFn={() => handleOptionVisibileItems(false)} state={false} highlightCondition={optVisibleItems === false && optActiveItems === null} />
                  <span>-</span>
                  <OptionTab label="Inativos" onClickFn={() => handleOptionActiveItems(false)} state={false} highlightCondition={optActiveItems === false && optVisibleItems === null} />

                </div>
                <Separator className="my-4" />
                <AlertsCostsAndSellPrice items={items} />

                <div className="bg-slate-50 px-60 py-2 grid place-items-center mb-4 rounded-sm">
                  <Input name="search" className="w-full py-4 text-lg bg-white " placeholder="Pesquisar o sabor..." onChange={(e) => handleSearch(e)} value={search} />
                </div>

                <div className="flex flex-row gap-x-4 mb-4 items-center">
                  <span className="text-xs">Ordenamento:</span>
                  <div className="flex flex-row gap-x-4 ">

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
                      label="Preço crescente"
                      sortOrderType="price-asc"
                      handleSort={handleSort}
                    />
                    <SortOrderOption
                      label="Preço decrescente"
                      sortOrderType="price-desc"
                      handleSort={handleSort}
                    />
                  </div>
                </div>


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
                                  <ul className="grid grid-cols-5 mb-4">
                                    {menuItem.sellPriceVariations.map((record) => {

                                      const minimumPriceAmountWithMargin = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withMargin ?? 0
                                      const minimumPriceAmountWithoutMargin = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withoutMargin ?? 0

                                      return (
                                        <li key={randomReactKey()} >

                                          <div className="flex flex-col justify-center">
                                            <p className="text-[11px] uppercase text-center ">{record.sizeName}</p>

                                            <div className="grid grid-cols-2 gap-2 justify-center">
                                              <div className="flex flex-col text-center">
                                                <p className="text-[11px] text-muted-foreground">Valor:</p>
                                                <p className={
                                                  cn(
                                                    "text-[12px] font-mono",
                                                    record.priceAmount > 0 && minimumPriceAmountWithMargin > record.priceAmount && 'bg-red-500'
                                                  )
                                                }
                                                >{formatDecimalPlaces(record.priceAmount)}</p>
                                              </div>
                                              <div className="flex flex-col text-center">
                                                {/* <p className="text-[11px] text-muted-foreground">Valor recomendado:</p> */}

                                                <MinimumSellPriceLabelDialog computedSellingPriceBreakdown={record.computedSellingPriceBreakdown} />
                                                <p className="text-[12px] font-mono">{formatDecimalPlaces(minimumPriceAmountWithMargin)}</p>
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
                                                        <NumericInput name="minimumPriceAmount" defaultValue={record.computedSellingPriceBreakdown?.minimumPrice.priceAmount.withMargin} readOnly className="bg-slate-100" />
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
              </div>
            )

          }}
        </Await>
      </Suspense>


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
        <span className="text-muted-foreground text-[11px] cursor-pointer hover:underline">Valor minimo</span>
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
              <Label cnContainer="font-semibold">{`Preço de venda sugerido`}</Label>
              <div className="grid grid-cols-4 items-center">
                <span className="text-xs col-span-3">Sem margem (com cobertura custos fixos)</span>
                <Amount>{Number(cspb?.minimumPrice?.priceAmount.withoutMargin ?? 0).toFixed(2)}</Amount>
              </div>

              <div className="grid grid-cols-4 items-center mb-2">
                <span className="text-xs col-span-3">Com margem</span>
                <Amount>{Number(cspb?.minimumPrice?.priceAmount.withMargin ?? 0).toFixed(2)}</Amount>
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