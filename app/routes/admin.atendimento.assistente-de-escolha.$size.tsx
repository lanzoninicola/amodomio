import { ImportCustomerServicePizzaMediumCombinations } from "@prisma/client";
import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Suspense, useState } from "react";
import Loading from "~/components/loading/loading";
import Toooltip from "~/components/tooltip/tooltip";
import { Input } from "~/components/ui/input";
import { authenticator } from "~/domain/auth/google.server";
import { MenuItemSellingPriceHandler, menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {


  const items = prismaClient.importCustomerServicePizzaMediumCombinations.findMany({
    orderBy: { realMarginPerc: "desc" },
  })

  const user = authenticator.isAuthenticated(request);


  const returnedData = Promise.all([
    items,
    user,
  ]);

  return defer({
    returnedData
  })
}

export default function AdminAtendimentoAssistenteDeEscolhaPorTamanho() {

  const { returnedData } = useLoaderData<typeof loader>();

  const location = useLocation();


  const TableHeader = ({ children, description, cnContainer, showMark }: { children: React.ReactNode, description?: string, cnContainer?: string, showMark?: boolean }) => {
    return (
      <div className={
        cn(
          "flex flex-col gap-1",
          cnContainer
        )
      }>
        <Toooltip trigger={<span className="font-semibold text-sm">{children}</span>} content={description} showMark={showMark} />
      </div>
    )
  }

  const PriceAmount = ({ children }: { children: React.ReactNode }) => {
    return <span className="font-mono text-xs">{children}</span>
  }

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
    <>
      <Link to={`${location.pathname}/how-to`} className="text-xs font-semibold underline tracking-wide">Guida</Link>
      <Outlet />

      <Suspense fallback={<Loading />}>
        <Await resolve={returnedData}>
          {([items, user]) => {

            // @ts-ignore
            const [allItems, setAllItems] = useState<ImportCustomerServicePizzaMediumCombinations[]>(items)

            const [search, setSearch] = useState("")

            const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value

              setSearch(value)

              if (!value || value.length === 0 || value === "") {
                // @ts-ignore
                setAllItems(items)
                return
              }

              const searchedItems = allItems.filter(item => {
                return (
                  item.topping1?.toLowerCase().includes(value.toLowerCase()) ||
                  item.topping2?.toLowerCase().includes(value.toLowerCase())
                )
              })

              setAllItems(searchedItems)
            }



            const removeToppingSelected = (toppingSelected: string) => {

              const nexItems = allItems.filter(item => {
                return (
                  item.topping1 !== toppingSelected &&
                  item.topping2 !== toppingSelected
                )
              }

              )

              setAllItems(nexItems)
            }

            // @ts-ignore
            return (
              <div className="flex flex-col gap-4">
                <div className="bg-slate-50 px-60 py-2 grid place-items-center mb-4 rounded-sm">
                  <Input name="search" className="w-full py-4 text-lg bg-white " placeholder="Pesquisar o sabor..." onChange={(e) => handleSearch(e)} value={search} />
                </div>
                <ul>
                  <li className="grid grid-cols-8 gap-4 w-full items-center mb-2">
                    <TableHeader cnContainer="col-span-2">Sabor 1</TableHeader>
                    <TableHeader cnContainer="col-span-2">Sabor 2</TableHeader>
                    <TableHeader >Preço de venda</TableHeader>
                    <TableHeader description="Valor que permite a coberturas dos custos fixos " showMark={true}>Preço de equilibrio</TableHeader>
                    <TableHeader cnContainer="col-span-2" showMark>
                      Margem real (%)
                    </TableHeader>
                  </li>
                  {allItems.map((item) => (
                    <li key={item.id} className="grid grid-cols-8 gap-4 w-full items-center mb-2 hover:bg-green-300 ">

                      <div className="flex flex-col gap-0 col-span-2" onClick={() => removeToppingSelected(item.topping1)}>
                        <span className="text-sm" >{item.topping1}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight max-w-prose">{item.ingredient1}</span>
                      </div>
                      <div className="flex flex-col gap-0 col-span-2" onClick={() => removeToppingSelected(item.topping2)}>
                        <span className="text-sm col-span-2">{item.topping2}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight max-w-prose">{item.ingredient2}</span>
                      </div>
                      <PriceAmount>{item.sellingPriceAmount}</PriceAmount>
                      <PriceAmount>{item.breakEvenPriceAmount}</PriceAmount>
                      <PriceAmount>{item.realMarginPerc}</PriceAmount>


                    </li>
                  ))}
                </ul>
              </div>
            )


          }}
        </Await>
      </Suspense>
    </>
  )
}
