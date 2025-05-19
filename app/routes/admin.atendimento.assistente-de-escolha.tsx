import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { authenticator } from "~/domain/auth/google.server";
import { MenuItemSellingPriceHandler, menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import formatDecimalPlaces from "~/utils/format-decimal-places";

export async function loader({ request, params }: LoaderFunctionArgs) {


  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadMany({
    channelKey: "cardapio",
    sizeKey: "pizza-medium"
  }, {
    format: "grouped",
    fn: MenuItemSellingPriceHandler.groupMenuItems
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

export default function AdminAtendimentoDAssistenteDeEscolhaMain() {

  const { returnedData } = useLoaderData<typeof loader>();


  const PriceAmount = ({ children }: { children: React.ReactNode }) => {
    return <span className="font-mono">{children}</span>
  }


  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Assistente de Escolha</h1>

      <Suspense fallback={<Loading />}>
        <Await resolve={returnedData}>
          {([menuItemsWithSellPriceVariations, user]) => {

            console.log({ menuItemsWithSellPriceVariations })

            // @ts-ignore
            const itemsWithMarkupByGroup = menuItemsWithSellPriceVariations.map(group => {
              const filteredItems = group.items
                .filter(item => item.visible === true && item.active === true)
                .map(item => {
                  const sellPrice = item.sellPriceVariations[0]?.priceAmount ?? 0;
                  const fixedCost =
                    item.sellPriceVariations[0]?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withoutMargin ?? 0;

                  const markup = formatDecimalPlaces(sellPrice - fixedCost);

                  return {
                    ...item,
                    markup
                  };
                })
                .sort((a, b) => b.markup - a.markup);

              return {
                group: group.group,
                items: filteredItems
              };
            });



            return (
              <div>
                {itemsWithMarkupByGroup.map(grouped => (
                  <div key={grouped.group.id} className="mb-4">
                    {/* Accordion title */}

                    <Accordion type="single" collapsible className="border rounded-md">
                      <AccordionItem value={grouped.group.id}>
                        <AccordionTrigger className="px-4 py-2 bg-gray-100">
                          <h2 className="text-lg font-semibold">{grouped.group.name}</h2>
                        </AccordionTrigger>
                        <AccordionContent className="p-4">

                          <ul>
                            {/* Table header */}
                            <li className="grid grid-cols-8 mb-4" key={`header-${grouped.group.id}`}>
                              <span className="col-span-2 font-semibold">Sabores</span>
                              <span className="font-semibold">Preço de Venda</span>
                              <span className="font-semibold">Margem</span>
                              <span className="font-semibold">Custo</span>

                            </li>

                            {/* Items */}
                            {grouped.items.map(item => {
                              const sellPrice = item.sellPriceVariations[0]?.priceAmount ?? 0;
                              const fixedCost = item.sellPriceVariations[0]?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withoutMargin ?? 0;

                              return (
                                <li
                                  key={item.menuItemId}
                                  className="grid grid-cols-8 hover:bg-green-200 p-1 text-[15px]"
                                >
                                  <span className="col-span-2">{item.name}</span>
                                  <PriceAmount>{sellPrice.toFixed(2)}</PriceAmount>
                                  <PriceAmount>{item.markup.toFixed(2)}</PriceAmount>
                                  <PriceAmount>{fixedCost.toFixed(2)}</PriceAmount>

                                </li>
                              );
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>


                  </div>
                ))}
              </div>
            );


          }}
        </Await>
      </Suspense>
    </div >
  )
}
