import { ActionFunctionArgs, defer, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Await } from "@remix-run/react";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { urlAt } from "~/utils/url";

import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import MenuItemSellPriceForm from "~/domain/cardapio/components/menu-item-sell-price-form/menu-item-sell-price-form";
import { cn } from "~/lib/utils";
import randomReactKey from "~/utils/random-react-key";
import { MenuItemSellingPriceVariationAudit } from "@prisma/client";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { MenuItemSellingPriceVariationUpsertParams, menuItemSellingPriceVariationPrismaEntity } from "~/domain/cardapio/menu-item-selling-price-variation.entity.server";
import toFixedNumber from "~/utils/to-fixed-number";
import createUUID from "~/utils/uuid";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const itemId = urlAt(request.url, -4);

  if (!itemId) {
    return badRequest("Nenhum item encontrado");
  }

  const [err, item] = await prismaIt(menuItemPrismaEntity.findById(itemId));

  if (err) {
    return serverError(err);
  }

  if (!item) {
    return badRequest("Nenhum item encontrado");
  }

  const sellingChannelKey = params.channel as string;
  const currentSellingChannel = await prismaClient.menuItemSellingChannel.findFirst({
    where: {
      key: sellingChannelKey,
    },
  })


  if (!currentSellingChannel) {
    return badRequest(`Can not find selling channel with key ${sellingChannelKey}`)
  }

  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadOne(itemId, {
    channelKey: currentSellingChannel.key,
  })

  const user = authenticator.isAuthenticated(request);



  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
    currentSellingChannel,
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

    console.log({ showOnCardapio })

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

export default function SingleMenuItemVendaPriceChannel() {
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
        {([menuItemsWithSellPriceVariations, user, currentSellingChannel]) => {

          return (
            <div className="grid grid-cols-5 gap-x-1">
              {
                menuItemsWithSellPriceVariations.sellPriceVariations.map((record) => (


                  <ul key={record.sizeId} className="flex gap-6 flex-col md:flex-row mb-6 ">
                    <li className={
                      cn(
                        "flex flex-col",
                        "p-2 border-r",
                        "hover:border-t-2 hover:border-t-black"
                      )
                    }>
                      <div className={
                        cn(
                          "min-h-[50px] mb-4",
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
                        menuItemId={menuItemsWithSellPriceVariations.menuItemId}
                        sellPriceVariation={record}
                        sellingChannel={currentSellingChannel}
                        user={user}
                      />
                    </li>

                  </ul>

                ))
              }
            </div>
          )
        }}
      </Await>
    </Suspense>

  )


}