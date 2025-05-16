import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import formatDecimalPlaces from "~/utils/format-decimal-places";

export async function loader({ request, params }: LoaderFunctionArgs) {


  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadMany({
    channelKey: "cardapio",
    sizeKey: "pizza-medium"
  })

  const user = authenticator.isAuthenticated(request);


  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
  ]);

  return defer({
    returnedData
  })
}

export default function AdminAtendimentoDirecionamentoClientes() {

  const { returnedData } = useLoaderData<typeof loader>();


  const PriceAmount = ({ children }: { children: React.ReactNode }) => {

    return <span className="font-mono">{children}</span>

  }


  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Atendimento - Direcionamento de Clientes</h1>
      <p>Lista dos sabores em orderm de markup</p>

      <Suspense fallback={<Loading />}>
        <Await resolve={returnedData}>
          {([menuItemsWithSellPriceVariations, user]) => {

            console.log({ menuItemsWithSellPriceVariations })

            // @ts-ignore
            const items = menuItemsWithSellPriceVariations.filter(miwspv => miwspv.visible === true && miwspv.active === true)

            const itemsWithMarkup = items.map((item) => {
              const sellPrice = item.sellPriceVariations[0].priceAmount
              const sellPriceFixedCostCovered = item.sellPriceVariations[0].computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withoutMargin ?? 0
              const markup = formatDecimalPlaces(sellPrice - sellPriceFixedCostCovered)

              return {
                ...item,
                markup
              }
            }).sort((a, b) => {
              return b.markup - a.markup
            })


            return (
              <ul>
                <li className="grid grid-cols-8 mb-4">
                  <span className="col-span-2 font-semibold">Sabores</span>
                  <span className="font-semibold">Preço de Venda</span>
                  <span className="font-semibold">Custo</span>
                  <span className="font-semibold">Markup</span>

                </li>
                {
                  itemsWithMarkup.map((item) => {

                    const sellPrice = item.sellPriceVariations[0].priceAmount
                    const sellPriceFixedCostCovered = item.sellPriceVariations[0].computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withoutMargin ?? 0

                    return (
                      <li key={item?.id} className="grid grid-cols-8 gap-y-2 hover:bg-slate-50 text-[15px]">

                        <span className="col-span-2">{item.name}</span>
                        <PriceAmount>{sellPrice}</PriceAmount>
                        <PriceAmount>{sellPriceFixedCostCovered}</PriceAmount>
                        <PriceAmount>{item.markup}</PriceAmount>
                      </li>
                    )
                  })
                }
              </ul>
            )

          }}
        </Await>
      </Suspense>
    </div>
  )
}