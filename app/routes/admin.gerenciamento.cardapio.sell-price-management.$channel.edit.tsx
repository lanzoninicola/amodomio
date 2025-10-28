import { Await, Form, useActionData, useLoaderData } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import randomReactKey from "~/utils/random-react-key";
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

import { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/react";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { Suspense, useState } from "react";
import Loading from "~/components/loading/loading";
import { MenuItemsFilters } from "~/domain/cardapio/components/menu-items-filters/menu-items-filters";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import MenuItemSellPriceForm from "~/domain/cardapio/components/menu-item-sell-price-form/menu-item-sell-price-form";

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


    <Suspense fallback={<Loading />}>
      <Await resolve={returnedData}>
        {/* @ts-ignore */}
        {([menuItemsWithSellPriceVariations, user, currentSellingChannel, groups, categories, sizes]) => {
          const [items, setItems] = useState<MenuItemWithSellPriceVariations[]>(menuItemsWithSellPriceVariations || [])

          const [accordionItemOpened, setAccordionItemOpened] = useState<string | null>(null)


          return (

            <div className="flex flex-col" >
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
              <ul>
                {
                  // @ts-ignore
                  items.map((menuItem: MenuItemWithSellPriceVariations) => {

                    return (

                      <li key={menuItem.menuItemId}>

                        <Accordion type="single" collapsible className="border rounded-md px-4 py-2 mb-4   "
                          onValueChange={setAccordionItemOpened}
                        >
                          <AccordionItem value={menuItem.menuItemId} className="border-none">
                            <div className="flex flex-col w-full">
                              <AccordionTrigger className="px-2 hover:no-underline hover:bg-blue-50 hover:rounded-md">


                                <ul className="grid grid-cols-6 mb-4 gap-x-2 w-full">
                                  <li className="text-left text-md font-semibold col-span-1">{menuItem.name} ({currentSellingChannel.name})</li>
                                  {menuItem.sellPriceVariations.map((record) => {

                                    const minimumPriceAmountWithProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withProfit ?? 0
                                    const minimumPriceAmountWithoutProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0

                                    return (
                                      <li key={randomReactKey()}
                                        className={cn(accordionItemOpened === menuItem.menuItemId ? "hidden" : "block")}
                                      >

                                        <div className="flex flex-col justify-center">
                                          <p className="text-[11px] uppercase text-center ">{record.sizeName}</p>



                                          <div className="flex flex-col text-center">
                                            <p className={
                                              cn(
                                                "text-[12px] font-mono",
                                                record.priceAmount > 0 && minimumPriceAmountWithProfit > record.priceAmount && 'bg-orange-200',
                                                record.priceAmount > 0 && minimumPriceAmountWithoutProfit > record.priceAmount && 'bg-red-400',
                                              )
                                            }
                                            >R$ {formatDecimalPlaces(record.priceAmount)}</p>
                                          </div>






                                        </div>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </AccordionTrigger>
                            </div>

                            <AccordionContent>

                              <ul className="grid grid-cols-5 gap-x-12">
                                {menuItem.sellPriceVariations.map((record) => (

                                  <section key={randomReactKey()} className="mb-6">

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

                                          <MenuItemSellPriceForm
                                            menuItemId={menuItem.menuItemId}
                                            sellPriceVariation={record}
                                            sellingChannel={currentSellingChannel}
                                            user={user}
                                          />
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
        }}
      </Await>
    </Suspense>
  )

}






