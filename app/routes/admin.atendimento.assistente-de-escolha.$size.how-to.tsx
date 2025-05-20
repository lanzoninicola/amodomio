import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import Toooltip from "~/components/tooltip/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Separator } from "~/components/ui/separator";
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

  const SectionTitle = ({ children }: { children: React.ReactNode }) => {
    return (
      <h4 className="font-semibold tracking-tight text-sm mb-4">{children}</h4>
    )
  }

  const SectionSubTitle = ({ children }: { children: React.ReactNode }) => {
    return (
      <h5 className="font-semibold tracking-tight text-xs mb-2">{children}</h5>
    )
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


          const promptText = `Considere a seguinte tabela de pizzas com os campos: ID, Sabores, Ingredientes, Preço de Venda, Margem (%) e Preço de Equilíbrio.
                          Cada campo é separado por ponto e vírgula.
                          Gere todas as possíveis combinações de 2 sabores, considerando que a pizza média pode ser vendida com dois sabores diferentes.

                          Regras:
                          1. O preço de venda da pizza média deve ser o **mais alto** entre os dois sabores escolhidos.
                          2. O preço de equilíbrio da combinação deve ser a **média aritmética dos preços de equilíbrio** dos dois sabores.
                          3. A margem real (%) da combinação deve ser calculada com a fórmula:
                          (Preço de Venda - Preço de Equilíbrio Médio) / Preço de Venda * 100
                          4. Ordene o resultado da maior para a menor margem real.
                          5. Mostre os campos: Sabor 1, Sabor 2, Preço de Venda, Preço de Equilíbrio Médio, Margem Real (%).
                          6. Renomeie o campo Sabor 1 em flavor_1
                          7. Adiciona o campo ingredient_1 para o ingredientes do Sabor 1
                          8. Renomeie o campo Sabor 2 em flavor_2
                          9. Adiciona o campo ingredient_2 para o ingredientes do Sabor 2
                          10. Renomeie o campo Preço de Venda em selling_price_amount
                          11. Renomeie o campo Preço de Equilíbrio Médio em break_even_price_amount
                          12. Renomeie o campo Margem Real (%) em real_margin_perc
                          13. Ignore combinações repetidas (ex: Diavola + Suave e Suave + Diavola são a mesma coisa).
                          14. Gere a saída final em formato **CSV**, pronta para importação futura.

                          Aqui está a tabela (em CSV):
                          [visualizar a lista abaixo e copiar o conteúdo]`



          return (
            <>
              <Accordion type="single" collapsible className="border rounded-md w-max">
                <AccordionItem value="item1">
                  <AccordionTrigger className="px-4 py-2 bg-green-50">
                    <span className="text-xs font-semibold text-green-600">Generação lista de combinaçoes pizza tamanho medio</span>

                  </AccordionTrigger>
                  <AccordionContent className="p-4">

                    <div className="flex flex-col gap-4 mb-12">
                      <section >
                        <SectionTitle>1. Requisitos</SectionTitle>
                        <Separator className="mb-4" />
                        <section className="mb-4">
                          <SectionSubTitle>a. Tabela formato CSV preços de venda e equilibrio</SectionSubTitle>

                          <Accordion type="single" collapsible className="border rounded-md w-max">
                            <AccordionItem value="item1">
                              <AccordionTrigger className="px-4 py-2 ">
                                <span className="text-xs font-semibold">Visualizar dados</span>

                              </AccordionTrigger>
                              <AccordionContent >
                                <p className="text-[11px] text-muted-foreground px-4 max-w-prose leading-tight">Essa tabela é gerada a partir do banco de dados al carregamento da pagina e deve ser copiada no promot de Chat GPT (veja o passo sucessivo)</p>
                                <ul className="p-4">
                                  {/* Items */}
                                  {itemsWithMarkup.map(item => {
                                    const sellPrice = item.sellPriceVariations[0]?.priceAmount ?? 0;
                                    const breakEven = item.sellPriceVariations[0]?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0;

                                    return (
                                      <li
                                        key={item.menuItemId}
                                        className="flex text-[15px] font-mono"
                                      >
                                        {item.menuItemId};{item.name};{item?.ingredients};{sellPrice.toFixed(2)};{item.markup.toFixed(2)};{breakEven.toFixed(2)}

                                      </li>
                                    );
                                  })}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </section>
                        <section>
                          <SectionSubTitle>b. Extração relatorio Mogo das vendas analitica (ainda nao gerenciada)</SectionSubTitle>
                          <Accordion type="single" collapsible className="border rounded-md w-max">
                            <AccordionItem value="item1">
                              <AccordionTrigger className="px-4 py-2 ">
                                <span className="text-xs font-semibold">Visualizar dados</span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <p className="text-[11px] text-muted-foreground px-4 max-w-prose leading-tight">
                                  Dados de venda extraidos do Mogo, para identificar o sabor mais vendido.<br />
                                </p>
                                <ul className="p-4">

                                </ul>

                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </section>
                      </section>
                      <Separator className="my-4" />
                      <section>
                        <SectionTitle>2. Copiar esse input no Chat GPT</SectionTitle>
                        <Separator className="mb-4" />
                        <div className="flex flex-col gap-2">
                          <CopyButton
                            label="Copiar"
                            classNameLabel="text-sm md:text-xs text-black"
                            classNameButton="w-full md:w-max md:px-2 py-0 bg-white border"
                            classNameIcon="text-black"
                            textToCopy={promptText}
                          />
                          <div className="border rounded-md p-4 bg-slate-50 ">
                            <code className="text-xs font-mono whitespace-pre-line">
                              {promptText}
                            </code>
                          </div>
                        </div>

                      </section>
                      <section>
                        <SectionTitle>3. Importar o arquivo CSV</SectionTitle>

                        <p className="text-xs">
                          O arquivo CSV gerado pelo ChatGPT deve ser importado para o sistema, utilizando a funcionalidade de importação de dados.
                          <br />
                          Certifique-se de que o arquivo está no formato correto e contém os campos necessários.
                        </p>

                      </section>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          );


        }}
      </Await>
    </Suspense>
  )
}
