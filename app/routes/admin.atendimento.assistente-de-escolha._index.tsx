import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import Toooltip from "~/components/tooltip/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Tooltip } from "~/components/ui/tooltip";
import { authenticator } from "~/domain/auth/google.server";
import { MenuItemSellingPriceHandler, menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import { cn } from "~/lib/utils";
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

  const TableHeader = ({ children, description, cnContainer, showMark }: { children: React.ReactNode, description?: string, cnContainer?: string, showMark?: boolean }) => {
    return (
      <div className={
        cn(
          "flex flex-col gap-1",
          cnContainer
        )
      }>
        <Toooltip trigger={<span className="font-semibold">{children}</span>} content={description} showMark={showMark} />
      </div>
    )
  }

  const PriceAmount = ({ children }: { children: React.ReactNode }) => {
    return <span className="font-mono">{children}</span>
  }



  return (

    <Suspense fallback={<Loading />}>
      <Await resolve={returnedData}>
        {([menuItemsWithSellPriceVariations, user]) => {

          // @ts-ignore
          const itemsWithMarkupByGroup = menuItemsWithSellPriceVariations.map(group => {
            const filteredItems = group.items
              .filter(item => item.visible === true && item.active === true)
              .map(item => {
                const sellPrice = item.sellPriceVariations[0]?.priceAmount ?? 0;
                const breakEven =
                  item.sellPriceVariations[0]?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0;

                const markup = formatDecimalPlaces(sellPrice - breakEven);

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
                            <TableHeader cnContainer="col-span-2">Sabores</TableHeader>
                            <TableHeader>Preço de Venda</TableHeader>
                            <TableHeader>Margem</TableHeader>
                            <TableHeader description="Valor necessário para não ter prejuízo (equivalente a break-even)" showMark={true}>Preço de equilibrio</TableHeader>

                          </li>

                          {/* Items */}
                          {grouped.items.map(item => {
                            const sellPrice = item.sellPriceVariations[0]?.priceAmount ?? 0;
                            const breakEven = item.sellPriceVariations[0]?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0;

                            return (
                              <li
                                key={item.menuItemId}
                                className="grid grid-cols-8 hover:bg-green-200 p-1 text-[15px]"
                              >
                                <span className="col-span-2">{item.name}</span>
                                <PriceAmount>{sellPrice.toFixed(2)}</PriceAmount>
                                <PriceAmount>{item.markup.toFixed(2)}</PriceAmount>
                                <PriceAmount>{breakEven.toFixed(2)}</PriceAmount>

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
  )
}
