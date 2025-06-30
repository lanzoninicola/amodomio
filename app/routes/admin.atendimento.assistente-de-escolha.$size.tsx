import { ImportCustomerServicePizzaBiggerCombinations, ImportCustomerServicePizzaMediumCombinations } from "@prisma/client";
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
  const paramSizeKey = params.size as string;

  let items = [] as ImportCustomerServicePizzaMediumCombinations[] | ImportCustomerServicePizzaBiggerCombinations[];

  if (paramSizeKey === "pizza-medium") {
    items = await prismaClient.importCustomerServicePizzaMediumCombinations.findMany({
      orderBy: { realMarginPerc: "desc" },
    })
  }

  if (paramSizeKey === "pizza-bigger") {
    items = await prismaClient.importCustomerServicePizzaBiggerCombinations.findMany({
      orderBy: { realMarginPerc: "desc" },
    })
  }

  const user = authenticator.isAuthenticated(request);


  const returnedData = Promise.all([
    items,
    paramSizeKey,
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

  const PriceAmountCol = ({ children }: { children: React.ReactNode }) => {
    return <span className="font-mono text-xs">{children}</span>
  }

  const ToppingCol = ({ name, ingredients, ...props }: {
    name: string, ingredients: string,
    [key: string]: any
  }) => {
    return (
      <div className="flex flex-col gap-0 col-span-2" {...props}>
        <span className="text-sm">{name}</span>
        <span className="text-[10px] text-muted-foreground leading-tight max-w-prose">{ingredients}</span>
      </div>
    )
  }

  return (
    <>
      <Link to={`${location.pathname}/how-to`} className="text-xs font-semibold underline tracking-wide">Guida</Link>
      <Outlet />

      <Suspense fallback={<Loading />}>
        <Await resolve={returnedData}>
          {([items, paramSizeKey, user]) => {

            // @ts-ignore
            const [allItems, setAllItems] = useState<ImportCustomerServicePizzaBiggerCombinations[] | ImportCustomerServicePizzaMediumCombinations[]>(items)

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

              const nexItems = allItems.filter((item: ImportCustomerServicePizzaBiggerCombinations) => {
                return (
                  item.topping1 !== toppingSelected &&
                  item.topping2 !== toppingSelected &&
                  item.topping3 !== toppingSelected &&
                  item.topping4 !== toppingSelected
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
                  <li className={
                    cn(
                      "grid gap-4 w-full items-center mb-2",
                      paramSizeKey === "pizza-medium" ? "grid-cols-8" : "grid-cols-12"
                    )
                  }>
                    <TableHeader cnContainer="col-span-2">Sabor 1</TableHeader>
                    <TableHeader cnContainer="col-span-2">Sabor 2</TableHeader>
                    {
                      paramSizeKey === "pizza-bigger" && (
                        <>
                          <TableHeader cnContainer="col-span-2">Sabor 3</TableHeader>
                          <TableHeader cnContainer="col-span-2">Sabor 4</TableHeader>
                        </>
                      )
                    }
                    <TableHeader >Preço de venda</TableHeader>
                    <TableHeader description="Valor que permite a coberturas dos custos fixos " showMark={true}>Preço de equilibrio</TableHeader>
                    <TableHeader cnContainer="col-span-2" showMark>
                      Margem real (%)
                    </TableHeader>
                  </li>
                  {allItems.map((item) => (
                    <li key={item.id} className={
                      cn(
                        "grid gap-4 w-full items-center mb-2 hover:bg-green-300 ",
                        paramSizeKey === "pizza-medium" ? "grid-cols-8" : "grid-cols-12"
                      )
                    }>
                      <ToppingCol name={item.topping1} ingredients={item.ingredient1} onClick={() => removeToppingSelected(item.topping1)} />
                      <ToppingCol name={item.topping2} ingredients={item.ingredient2} onClick={() => removeToppingSelected(item.topping2)} />
                      {
                        paramSizeKey === "pizza-bigger" && (
                          <>
                            <ToppingCol name={item.topping3} ingredients={item.ingredient3} onClick={() => removeToppingSelected(item.topping3)} />
                            <ToppingCol name={item.topping4} ingredients={item.ingredient4} onClick={() => removeToppingSelected(item.topping4)} />
                          </>
                        )
                      }
                      <PriceAmountCol>{item.sellingPriceAmount}</PriceAmountCol>
                      <PriceAmountCol>{item.breakEvenPriceAmount}</PriceAmountCol>
                      <PriceAmountCol>{item.realMarginPerc}</PriceAmountCol>


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
