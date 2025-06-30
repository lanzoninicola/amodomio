import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, Form, defer, useLoaderData } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemCostHandler } from "~/domain/cardapio/menu-item-cost-handler.server";
import { MenuItemWithCostVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import randomReactKey from "~/utils/random-react-key";

export async function loader({ request, params }: LoaderFunctionArgs) {

  const menuItemId = params.id as string;
  const menuItemWithCostVariationsAndRecommended = menuItemCostHandler.loadOne(menuItemId)

  const user = authenticator.isAuthenticated(request);

  const data = Promise.all([menuItemWithCostVariationsAndRecommended, user]);

  return defer({
    data
  })
}

export default function AdminGerenciamentoCardapioCostManagementSingle() {
  const { data } = useLoaderData<typeof loader>();

  return (


    <div className="p-2" data-element="admin-gerenciamento-cardapio-custo-single">
      <Suspense fallback={<Loading />}>
        <Await resolve={data}>
          {/* @ts-ignore */}
          {([menuItemWithCostVariationsAndRecommended, user]) => {



            // @ts-ignore
            const menuItem: MenuItemWithCostVariations = menuItemWithCostVariationsAndRecommended;

            <>

              <div className="flex justify-between  items-center mb-4 bg-slate-300 rounded-md px-4 py-1">

                <h3 className="text-md font-semibold">{menuItem.name}</h3>
                <Form method="post" className="flex gap-2">
                  <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                  {/* @ts-ignore */}
                  <input type="hidden" name="updatedBy" value={user?.email || ""} />
                  <SubmitButton
                    actionName="menu-item-cost-variation-upsert-all-proposed-input"
                    tabIndex={0}
                    cnContainer="bg-white border w-full hover:bg-slate-200"
                    cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                    hideIcon
                    idleText="Aceitar todas as propostas"
                    loadingText="Aceitando..."
                  />
                </Form>
              </div>

              <ul className="grid grid-cols-5 gap-x-1">
                {menuItem.costVariations.map((record) => (
                  <section key={randomReactKey()} className="mb-8">

                    <ul className="flex gap-6">
                      <li key={record.sizeId} className={
                        cn(
                          "p-2 rounded-md",
                        )
                      }>
                        <div className="flex flex-col">
                          <div className={
                            cn(
                              " mb-2",
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

                          <Form method="post" className="flex flex-col gap-1 justify-center items-center">
                            <div className="flex flex-col gap-2 mb-2">
                              <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                              <input type="hidden" name="menuItemCostVariationId" value={record.menuItemCostVariationId ?? ""} />
                              <input type="hidden" name="menuItemSizeId" value={record.sizeId ?? ""} />
                              {/* @ts-ignore */}
                              <input type="hidden" name="updatedBy" value={record.updatedBy || user?.email || ""} />
                              <input type="hidden" name="previousCostAmount" value={record.previousCostAmount} />

                              <div className="flex flex-col gap-2">

                                <div className="grid grid-cols-2 gap-2">

                                  <div className="flex flex-col gap-1 items-center">
                                    <div className="flex flex-col gap-y-0">
                                      <span className="text-muted-foreground text-[11px]">Novo custo:</span>
                                      <NumericInput name="costAmount" defaultValue={record.costAmount} />
                                    </div>
                                    <SubmitButton
                                      actionName="menu-item-cost-variation-upsert-user-input"
                                      tabIndex={0}
                                      cnContainer="md:py-0 bg-slate-300 hover:bg-slate-400"
                                      cnLabel="text-[11px] tracking-widest text-black uppercase"
                                      iconColor="black"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1 items-center">
                                    <div className="flex flex-col gap-y-0">
                                      <span className="text-muted-foreground text-[11px]">Valor proposto</span>
                                      <NumericInput name="recommendedCostAmount" defaultValue={record.recommendedCostAmount} readOnly />
                                    </div>
                                    <SubmitButton
                                      actionName="menu-item-cost-variation-upsert-proposed-input"
                                      tabIndex={0}
                                      cnContainer="bg-white border w-full hover:bg-slate-200"
                                      cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                                      hideIcon
                                      idleText="Aceitar proposta"
                                      loadingText="Aceitando..."
                                    />
                                  </div>

                                </div>
                                {(record?.costAmount ?? 0) === 0 && (
                                  <div className="flex gap-2 items-center mt-2">
                                    <AlertCircleIcon className="h-4 w-4 text-red-500" />
                                    <span className="text-red-500 text-xs font font-semibold">Custo ficha tecnica não definido</span>
                                  </div>
                                )}
                              </div>




                              <div className="flex flex-col gap-1">
                                <span className="text-xs">Custo atual: {record.costAmount}</span>
                                <span className="text-xs text-muted-foreground">Custo anterior: {record.previousCostAmount}</span>
                              </div>
                            </div>


                          </Form>
                        </div>
                      </li>

                    </ul>
                  </section>
                ))}

              </ul>


            </>
          }
          }
        </Await>
      </Suspense>

    </div>


  )
}