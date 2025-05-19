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

export default function AdminAtendimentoAssistenteDeEscolhaPorTamanho() {

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
    return <span className="font-mono text-xs">{children}</span>
  }



  return (

    <Suspense fallback={<Loading />}>
      <Await resolve={returnedData}>
        {([menuItemsWithSellPriceVariations, user]) => {

          // @ts-ignore
          const itemsWithMarkup = menuItemsWithSellPriceVariations
            .flatMap(group => group.items) // junta todos os items de todos os grupos
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



          return (

            <div className="flex flex-col gap-4">
              <section>
                <p className="font-semibold tracking-tight text-sm mb-4">1. copiar esse input no Chat GPT</p>
                <div className="text-xs font-mono border rounded-md p-4 bg-slate-50">
                  Considere a seguinte tabela de pizzas com os campos: ID, Sabores, Preço de Venda, Margem (%) e Preço de Equilíbrio.<br />
                  Gere todas as possíveis combinações de 2 sabores, considerando que a pizza média pode ser vendida com dois sabores diferentes.<br />
                  <br />
                  Regras:<br />
                  1. O preço de venda da pizza média deve ser o **mais alto** entre os dois sabores escolhidos.<br />
                  2. O preço de equilíbrio da combinação deve ser a **média aritmética dos preços de equilíbrio** dos dois sabores.<br />
                  3. A margem real (%) da combinação deve ser calculada com a fórmula:<br />
                  (Preço de Venda - Preço de Equilíbrio Médio) / Preço de Venda * 100<br />
                  4. Ordene o resultado da maior para a menor margem real.<br />
                  5. Mostre os campos: Sabor 1, Sabor 2, Preço de Venda, Preço de Equilíbrio Médio, Margem Real (%).<br />
                  6. Ignore combinações repetidas (ex: Diavola + Suave e Suave + Diavola são a mesma coisa).<br />
                  7. Gere a saída final em formato **CSV**, pronta para importação futura.<br />
                  <br />
                  Aqui está a tabela (em CSV):<br />
                  <br />
                  [visualizar a lista abaixo e copiar o conteúdo]<br />
                </div><br />
                <Accordion type="single" collapsible className="border rounded-md w-max">
                  <AccordionItem value="item1">
                    <AccordionTrigger className="px-4 py-2 ">
                      <span className="text-xs font-semibold">Visualizar lista</span>
                    </AccordionTrigger>
                    <AccordionContent className="p-4">

                      <ul>
                        {/* Items */}
                        {itemsWithMarkup.map(item => {
                          const sellPrice = item.sellPriceVariations[0]?.priceAmount ?? 0;
                          const breakEven = item.sellPriceVariations[0]?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0;

                          return (
                            <li
                              key={item.menuItemId}
                              className="flex text-[15px] font-mono"
                            >
                              {item.menuItemId},{item.name},{sellPrice.toFixed(2)},{item.markup.toFixed(2)},{breakEven.toFixed(2)}

                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </section>
            </div>
          );


        }}
      </Await>
    </Suspense>
  )
}
