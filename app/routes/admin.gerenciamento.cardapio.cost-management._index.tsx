
import { ActionFunctionArgs, LoaderFunctionArgs, } from "@remix-run/node";
import { Await, useLoaderData, defer, Form, useActionData } from "@remix-run/react";
import { AlertCircleIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { NumericInput } from "~/components/numeric-input/numeric-input";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import { menuItemCostHandler } from "~/domain/cardapio/menu-item-cost-handler.server";
import { menuItemCostVariationPrismaEntity } from "~/domain/cardapio/menu-item-cost-variation.entity.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { MenuItemWithCostVariations } from "~/domain/cardapio/menu-item.types";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import parserFormDataEntryToNumber from "~/utils/parse-form-data-entry-to-number";
import randomReactKey from "~/utils/random-react-key";
import createUUID from "~/utils/uuid";
import { MenuItemVisibilityFilterOption } from "./admin.gerenciamento.cardapio.main.list";



export async function loader({ request }: LoaderFunctionArgs) {

    const menuItemsWithCostVariationsAndRecommended = menuItemCostHandler.loadAll()

    const user = authenticator.isAuthenticated(request);

    const data = Promise.all([menuItemsWithCostVariationsAndRecommended, user]);

    return defer({
        data
    })
}

export async function action({ request }: ActionFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })

    if (_action === "menu-item-cost-variation-upsert-user-input") {

        const menuItemId = values?.menuItemId as string
        const menuItemCostVariationId = values?.menuItemCostVariationId as string
        const menuItemSizeId = values?.menuItemSizeId as string
        const updatedBy = values?.updatedBy as string
        const costAmount = parserFormDataEntryToNumber(values?.costAmount) || 0
        const previousCostAmount = parserFormDataEntryToNumber(values?.previousCostAmount) || 0


        const recordId = menuItemCostVariationId === "" ? createUUID() : menuItemCostVariationId

        const [err, result] = await prismaIt(menuItemCostVariationPrismaEntity.upsert(recordId,
            {
                id: recordId,
                menuItemId,
                menuItemSizeId,
                costAmount,
                previousCostAmount,
                updatedBy,
            }
        ))

        if (err) {
            return badRequest(err)
        }

        return ok(`O custo da ficha tecnica foi atualizado com sucesso`)
    }

    if (_action === "menu-item-cost-variation-upsert-from-medium") {
        const menuItemId = values?.menuItemId as string
        const updatedBy = values?.updatedBy as string
        const costAmount = parserFormDataEntryToNumber(values?.costAmount) || 0

        const [err, result] = await prismaIt(menuItemCostVariationPrismaEntity.upsertMenuItemCostVariationsFromMedium(
            menuItemId,
            costAmount,
            updatedBy
        ))

        if (err) {
            return badRequest(err)
        }

        return ok(`Os custos de todas as variações de tamanho foram atualizados com sucesso`)
    }

    if (_action === "menu-item-cost-variation-upsert-proposed-input") {

        const menuItemId = values?.menuItemId as string
        const menuItemCostVariationId = values?.menuItemCostVariationId as string
        const menuItemSizeId = values?.menuItemSizeId as string
        const updatedBy = values?.updatedBy as string
        const costAmount = parserFormDataEntryToNumber(values?.recommendedCostAmount) || 0
        const previousCostAmount = parserFormDataEntryToNumber(values?.previousCostAmount) || 0


        const recordId = menuItemCostVariationId === "" ? createUUID() : menuItemCostVariationId

        const [err, result] = await prismaIt(menuItemCostVariationPrismaEntity.upsert(recordId,
            {
                id: recordId,
                menuItemId,
                menuItemSizeId,
                costAmount,
                previousCostAmount,
                updatedBy,
            }
        ))

        if (err) {
            return badRequest(err)
        }

        return ok(`O custo da ficha tecnica foi atualizado com sucesso`)
    }

    if (_action === "menu-item-cost-variation-upsert-all-proposed-input") {
        const menuItemId = values?.menuItemId as string
        const updatedBy = values?.updatedBy as string
        const recommendedCostAmount = parserFormDataEntryToNumber(values?.recommendedCostAmount) || 0

        const menuItemWithCostVariations = await menuItemPrismaEntity.findWithCostVariationsByItem(menuItemId)

        if (!menuItemWithCostVariations) {
            return badRequest("Nenhum item encontrado")
        }

        const costVariations = menuItemWithCostVariations.costVariations.map(record => {
            return {
                id: record.menuItemCostVariationId,
                menuItemId,
                costAmount: recommendedCostAmount,
                updatedAt: record.updatedAt,
                updatedBy,
                previousCostAmount: record.costAmount,
                menuItemSizeId: record.sizeId,
            }
        })

        const [err, result] = await prismaIt(menuItemCostVariationPrismaEntity.upsertMany(menuItemId, costVariations))

        if (err) {
            return badRequest(err)
        }

        return ok(`Os custos da ficha tecnica foi atualizado com sucesso`)
    }

    return ok("Elemento atualizado com successo")
}

export default function AdminGerenciamentoCardapioCostManagementIndex() {
    const { data } = useLoaderData<typeof loader>()

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
        <div className="flex flex-col gap-4">

            <Suspense fallback={<Loading />}>
                <Await resolve={data}>
                    {/* @ts-ignore */}
                    {([menuItemsWithCostVariationsAndRecommended, user]) => {

                        {/* @ts-ignore */ }
                        const [items, setItems] = useState<MenuItemWithCostVariations[]>(menuItemsWithCostVariationsAndRecommended || [])

                        const [currentFilter, setCurrentFilter] = useState<MenuItemVisibilityFilterOption | null>("active");
                        const applyFilters = (
                            visibility: MenuItemVisibilityFilterOption | null,
                        ) => {
                            let filtered = items;

                            // Filtro por visibilidade
                            if (visibility === "active") {
                                filtered = filtered.filter(item => item.active === true);
                            }
                            if (visibility === "venda-pausada") {
                                filtered = filtered.filter(item => item.active === true && item.visible === false);
                            }
                            setItems(filtered);
                        };

                        const handleVisibilityChange = (visibility: MenuItemVisibilityFilterOption) => {
                            setCurrentFilter(visibility);
                            applyFilters(visibility);
                        };


                        const [search, setSearch] = useState("")

                        const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
                            const allItems = menuItemsWithCostVariationsAndRecommended.filter(item => item.visible === true && item.active === true)

                            const value = event.target.value

                            setSearch(value)
                            // @ts-ignore
                            if (!value || value.length === 0 || value === "") {
                                return setItems(allItems)
                            }

                            const searchedItems = items
                                .filter(item => {
                                    return (
                                        item.name?.toLowerCase().includes(value.toLowerCase())
                                        || item.ingredients?.toLowerCase().includes(value.toLowerCase())
                                    )
                                })

                            setItems(searchedItems)
                        }

                        // Primeira renderização
                        useEffect(() => {
                            applyFilters(currentFilter);
                        }, []);

                        return (
                            <div className="flex flex-col">

                                <div className="grid grid-cols-8 gap-4 items-center bg-slate-50 py-2 px-4 mb-4">
                                    {/* Select de Visibilidade */}
                                    <Select
                                        onValueChange={(value) => handleVisibilityChange(value as MenuItemVisibilityFilterOption)}
                                        defaultValue={"active"}
                                    >
                                        <SelectTrigger className="w-full bg-white md:col-span-2">
                                            <SelectValue placeholder="Filtrar vendas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Venda ativa</SelectItem>
                                            <SelectItem value="venda-pausada">Venda pausada</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <div className="grid place-items-center rounded-sm col-span-5">
                                        <Input name="search" className="w-full py-4 text-lg bg-white " placeholder="Pesquisar o sabor..." onChange={(e) => handleSearch(e)} value={search} />
                                    </div>

                                    <AlertsCostsAndSellPrice items={items} cnContainer="col-span-1 flex justify-end w-full" />
                                </div>

                                <div className="h-[500px] overflow-y-scroll">
                                    <ul>
                                        {
                                            // @ts-ignore
                                            items.map((menuItem: MenuItemWithCostVariations) => {

                                                return (
                                                    <li key={menuItem.menuItemId} className="p-2">
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
                                                                                            <div className="flex flex-col gap-1">
                                                                                                <div className="grid grid-cols-2 gap-2">

                                                                                                    <div className="flex flex-col gap-1 items-center">
                                                                                                        <div className="flex flex-col gap-y-0">
                                                                                                            <span className="text-muted-foreground text-[11px]">Novo custo:</span>
                                                                                                            <NumericInput name="costAmount" defaultValue={record.costAmount} />
                                                                                                        </div>

                                                                                                        <SubmitButton
                                                                                                            actionName="menu-item-cost-variation-upsert-user-input"
                                                                                                            tabIndex={0}
                                                                                                            cnContainer="bg-slate-300 md:max-w-none hover:bg-slate-400"
                                                                                                            cnLabel="text-[11px] tracking-widest text-black uppercase"
                                                                                                            iconColor="black"

                                                                                                        />


                                                                                                    </div>

                                                                                                    <div className="flex flex-col gap-1 items-center">
                                                                                                        <div className="flex flex-col gap-y-0 w-ma">
                                                                                                            <span className="text-muted-foreground text-[11px]">Valor proposto</span>
                                                                                                            <NumericInput name="recommendedCostAmount" defaultValue={record.recommendedCostAmount} readOnly />
                                                                                                        </div>
                                                                                                        <SubmitButton
                                                                                                            actionName="menu-item-cost-variation-upsert-proposed-input"
                                                                                                            tabIndex={0}
                                                                                                            cnContainer="bg-white border w-full hover:bg-slate-200 "
                                                                                                            cnLabel="text-[11px] tracking-widest text-black uppercase leading-[1.15]"
                                                                                                            hideIcon
                                                                                                            idleText="Aceitar proposta"
                                                                                                            loadingText="Aceitando..."
                                                                                                        />
                                                                                                    </div>

                                                                                                </div>
                                                                                                <div className="flex flex-col gap-2">
                                                                                                    <SubmitButton
                                                                                                        actionName="menu-item-cost-variation-upsert-from-medium"
                                                                                                        tabIndex={0}
                                                                                                        cnContainer={
                                                                                                            cn(
                                                                                                                "md:max-w-none bg-blue-500",
                                                                                                                record.sizeKey !== "pizza-medium" && "hidden"
                                                                                                            )
                                                                                                        }
                                                                                                        cnLabel="text-[11px] tracking-widest text-white uppercase leading-[1.15] "
                                                                                                        iconColor="white"
                                                                                                        idleText="Recalcular outros tamanhos"
                                                                                                        loadingText="Recalculando..."

                                                                                                        disabled={record.sizeKey !== "pizza-medium" ||
                                                                                                            (record.costAmount === 0 || record.costAmount === null)
                                                                                                        }
                                                                                                    />
                                                                                                    <span className={
                                                                                                        cn(
                                                                                                            "text-[11px] text-muted-foreground font-semibold text-blue-500 leading-[1.2]",
                                                                                                            record.sizeKey !== "pizza-medium" && "hidden",
                                                                                                            record.sizeKey !== "pizza-medium" ||
                                                                                                            (record.costAmount !== 0 || record.costAmount !== null) && "hidden",
                                                                                                        )
                                                                                                    }>
                                                                                                        Para calcular o custo dos outros tamanhos inserir o custo do tamanho médio.
                                                                                                    </span>
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


                                                    </li>
                                                )
                                            })
                                        }
                                    </ul>
                                </div>
                            </div>
                        )

                    }}
                </Await>
            </Suspense>


        </div>
    )
}