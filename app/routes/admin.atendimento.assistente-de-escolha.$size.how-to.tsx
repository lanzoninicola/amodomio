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

  const paramSizeKey = params.size as string;

  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadMany({
    channelKey: "cardapio",
    sizeKey: paramSizeKey
  }, {
    format: "grouped",
    fn: MenuItemSellingPriceHandler.groupMenuItems
  })

  const user = authenticator.isAuthenticated(request);


  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    paramSizeKey,
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
        {([menuItemsWithSellPriceVariations, paramSizeKey, user]) => {

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


          const promptTextMediumSize = `⚠️ Atenção: a tabela está completa. Use todos os dados abaixo.
Não me peça confirmação. Gere todas as combinações possíveis direto.

Regras para geração das combinações de sabores de pizza média:

1. O preço de venda da pizza média será o **mais alto** entre os dois sabores.
2. O preço de equilíbrio será a **média aritmética** dos preços de equilíbrio dos dois sabores.
3. A margem real (%) será calculada da seguinte forma:
   (Preço de Venda - Preço de Equilíbrio Médio) / Preço de Venda * 100
4. Ordenar o resultado da **maior para a menor margem real**.
5. Mostrar os seguintes campos com esses nomes:
   - topping_1
   - ingredient_1
   - topping_2
   - ingredient_2
   - selling_price_amount
   - break_even_price_amount
   - real_margin_perc
6. Ignorar combinações repetidas (ex: Diavola + Suave e Suave + Diavola são iguais).
7. A saída deve estar no formato **CSV**, pronta para importação.

Estrutura esperada da tabela de entrada (colada a seguir):

[cole todos os dados aqui]
`

          const promptTextBigger = `⚠️ Atenção: a tabela está completa. Use todos os dados abaixo.
Não me peça confirmação. Gere todas as combinações possíveis direto.

Regras para geração das combinações de sabores de pizza familia:

1. O preço de venda da pizza familia será o **mais alto** entre os quatro sabores.
2. O preço de equilíbrio será a **média aritmética** dos preços de equilíbrio dos quatros sabores.
3. A margem real (%) será calculada da seguinte forma:
   (Preço de Venda - Preço de Equilíbrio Médio) / Preço de Venda * 100
4. Ordenar o resultado da **maior para a menor margem real**.
5. Mostrar os seguintes campos com esses nomes:
   - topping_1
   - ingredient_1
   - topping_2
   - ingredient_2
   - topping_3
   - ingredient_3
   - topping_4
   - ingredient_4
   - selling_price_amount
   - break_even_price_amount
   - real_margin_perc
6. Ignorar combinações repetidas (ex: Diavola + Suave + Margherita + Figaro e Suave + Diavola + Figaro + Margherita são iguais).
7. A saída deve estar no formato **CSV**, pronta para importação.

Estrutura esperada da tabela de entrada (colada a seguir):

[cole todos os dados aqui]
`


          return (
            <>
              <Accordion type="single" collapsible className="border rounded-md w-max">
                <AccordionItem value="item1">
                  <AccordionTrigger className="px-4 py-2 bg-green-50">
                    <span className="text-xs font-semibold text-green-600">{
                      `Generação lista de combinaçoes pizza tamanho ${paramSizeKey === "pizza-medium" ? "média" : "grande"}`}
                    </span>

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
                            textToCopy={paramSizeKey === "pizza-medium" ? promptTextMediumSize : promptTextBigger}
                          />
                          <div className="border rounded-md p-4 bg-slate-50 ">
                            <code className="text-xs font-mono whitespace-pre-line">
                              {paramSizeKey === "pizza-medium" ? promptTextMediumSize : promptTextBigger}
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
