
import { ActionFunctionArgs, LoaderFunctionArgs, } from "@remix-run/node";
import { Await, useLoaderData, defer, useFetcher } from "@remix-run/react";
import { AlertCircleIcon, Loader } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import Loading from "~/components/loading/loading";
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
import createUUID from "~/utils/uuid";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import prismaClient from "~/lib/prisma/client.server";
import { MenuItemsFilters } from "~/domain/cardapio/components/menu-items-filters/menu-items-filters";
import { MoneyInput } from "~/components/money-input/MoneyInput";



export async function loader({ request }: LoaderFunctionArgs) {

    const menuItemWithCostVariations = menuItemCostHandler.loadAll()

    const user = authenticator.isAuthenticated(request);

    const menuItemGroups = prismaClient.menuItemGroup.findMany({
        where: {
            deletedAt: null,
            visible: true
        }
    })

    const menuItemCategories = prismaClient.category.findMany({
        where: {
            type: "menu"
        }
    })

    const data = Promise.all([menuItemWithCostVariations, user, menuItemGroups, menuItemCategories]);

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

        return ok(`O custo da ficha de custo do item foi atualizado com sucesso`)
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

        return ok(`O custo da ficha de custo do item foi atualizado com sucesso`)
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

        return ok(`Os custos da ficha de custo do item foram atualizados com sucesso`)
    }

    return ok("Elemento atualizado com successo")
}

export default function AdminGerenciamentoCardapioCostManagementIndex() {
    const { data } = useLoaderData<typeof loader>()

    return (
        <div className="flex flex-col gap-4">
            <Suspense fallback={<Loading />}>
                <Await resolve={data}>
                    {/* @ts-ignore */}
                    {([menuItemWithCostVariations, user, groups, categories]) => (
                        <CostManagementResolved
                            // @ts-ignore
                            menuItemWithCostVariations={menuItemWithCostVariations}
                            // @ts-ignore
                            user={user}
                            // @ts-ignore
                            groups={groups}
                            // @ts-ignore
                            categories={categories}
                        />
                    )}
                </Await>
            </Suspense>
        </div>
    )
}

function CostManagementResolved({
    menuItemWithCostVariations,
    user,
    groups,
    categories,
}: {
    menuItemWithCostVariations: MenuItemWithCostVariations[];
    user: any;
    groups: any;
    categories: any;
}) {
    const [items, setItems] = useState<MenuItemWithCostVariations[]>(menuItemWithCostVariations || []);
    const now = new Date();
    const [pendingCost, setPendingCost] = useState<Record<string, number>>({});

    const multipliers: Record<string, number> = {
        "pizza-individual": 0.5,
        "pizza-medium": 1,
        "pizza-big": 1.25,
        "pizza-bigger": 2,
        "pizza-slice": 0.25,
    };

    useEffect(() => {
        setItems(menuItemWithCostVariations || []);
    }, [menuItemWithCostVariations]);

    function handleCostChange(menuItemId: string, menuItemSizeId: string, refCostAmount: number) {
        setPendingCost((current) => ({
            ...current,
            [`${menuItemId}:${menuItemSizeId}`]: refCostAmount,
        }));

        setItems((current) =>
            current.map((menuItem) => {
                if (menuItem.menuItemId !== menuItemId) return menuItem;
                return {
                    ...menuItem,
                    costVariations: menuItem.costVariations.map((record) => {
                        const isMedium = record.sizeKey === "pizza-medium";
                        if (!isMedium) return record;
                        const multiplier = multipliers[record.sizeKey];
                        if (!multiplier) return record;
                        return {
                            ...record,
                            recommendedCostAmount: refCostAmount * multiplier,
                        };
                    }),
                };
            })
        );
    }

    function applyOptimisticUpdate(action: string, formData: FormData) {
        const menuItemId = String(formData.get("menuItemId") ?? "");
        const menuItemSizeId = String(formData.get("menuItemSizeId") ?? "");
        const costAmountRaw = formData.get("costAmount");
        const recommendedCostAmountRaw = formData.get("recommendedCostAmount");
        const costAmount = Number(costAmountRaw ?? 0);
        const recommendedCostAmount = Number(recommendedCostAmountRaw ?? 0);

        if (!menuItemId || !menuItemSizeId) return;

        setItems((current) =>
            current.map((menuItem) => {
                if (menuItem.menuItemId !== menuItemId) return menuItem;
                return {
                    ...menuItem,
                    costVariations: menuItem.costVariations.map((record) => {
                        if (record.sizeId !== menuItemSizeId) return record;
                        if (action === "menu-item-cost-variation-upsert-user-input") {
                            setPendingCost((state) => {
                                const next = { ...state };
                                delete next[`${menuItemId}:${menuItemSizeId}`];
                                return next;
                            });
                            return {
                                ...record,
                                previousCostAmount: record.costAmount,
                                costAmount,
                            };
                        }
                        if (action === "menu-item-cost-variation-upsert-proposed-input") {
                            setPendingCost((state) => {
                                const next = { ...state };
                                delete next[`${menuItemId}:${menuItemSizeId}`];
                                return next;
                            });
                            return {
                                ...record,
                                previousCostAmount: record.costAmount,
                                costAmount: recommendedCostAmount,
                            };
                        }
                        if (action === "menu-item-cost-variation-upsert-from-medium") {
                            const multiplier = multipliers[record.sizeKey];
                            if (!multiplier) return record;
                            setPendingCost((state) => {
                                const next = { ...state };
                                delete next[`${menuItemId}:${record.sizeId}`];
                                return next;
                            });
                            return {
                                ...record,
                                previousCostAmount: record.costAmount,
                                costAmount: costAmount * multiplier,
                                recommendedCostAmount: costAmount * multiplier,
                            };
                        }
                        return record;
                    }),
                };
            })
        );
    }

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-2 py-2 md:py-0 md:grid md:grid-cols-8 md:items-center mb-4 bg-slate-50 px-1">
                <MenuItemsFilters
                    // @ts-ignore
                    initialItems={menuItemWithCostVariations}
                    // @ts-ignore
                    groups={groups}
                    // @ts-ignore
                    categories={categories}
                    onItemsChange={(filtered) => setItems(filtered)}
                    cnContainer="col-span-7"
                />
                <AlertsCostsAndSellPrice items={items} cnContainer="col-span-1 flex justify-center md:justify-end w-full col-span-1" />
            </div>

            <div className="h-[500px] overflow-y-scroll">
                <ul>
                    {items.map((menuItem: MenuItemWithCostVariations) => {
                        return (
                            <li key={menuItem.menuItemId}>
                                <Accordion type="single" collapsible className="border rounded-md px-4 py-2 mb-4">
                                    <AccordionItem value="item-1" className="border-none">
                                        <AccordionTrigger className="py-2">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-md font-semibold">{menuItem.name}</h3>
                                                    <span className={cn(
                                                        "text-[10px] uppercase tracking-widest font-semibold rounded px-2 py-0.5",
                                                        menuItem.visible ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {menuItem.visible ? "Visível" : "Oculto"}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {menuItem.costVariations.map((record) => {
                                                        if (!record.updatedAt) {
                                                            return `${record.sizeName}: sem alteração`;
                                                        }
                                                        const updatedAt = new Date(record.updatedAt);
                                                        const diffDays = Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / 86400000));
                                                        const dateText = updatedAt.toLocaleDateString("pt-BR");
                                                        return `${record.sizeName}: ${diffDays} dia${diffDays === 1 ? "" : "s"} (${dateText})`;
                                                    }).join(" • ")}
                                                </div>
                                            </div>
                                        </AccordionTrigger>

                                        <AccordionContent>
                                            <ul className="grid grid-cols-5 gap-x-1">
                                                {menuItem.costVariations.map((record) => (
                                                    <section key={record.sizeId} className="mb-8">
                                                        <ul className="flex gap-6">
                                                            <li
                                                                key={record.sizeId}
                                                                className={cn(
                                                                    "p-2 rounded-md",
                                                                )}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <div
                                                                        className={cn(
                                                                            " mb-2",
                                                                            record.sizeKey === "pizza-medium" && "grid place-items-center bg-black",
                                                                        )}
                                                                    >
                                                                        <h4
                                                                            className={cn(
                                                                                "text-[12px] font-medium uppercase tracking-wider",
                                                                                record.sizeKey === "pizza-medium" && "font-semibold text-white",
                                                                            )}
                                                                        >
                                                                            {record.sizeName}
                                                                        </h4>
                                                                    </div>

                                                                    <CostVariationForm
                                                                        menuItem={menuItem}
                                                                        record={record}
                                                                        userEmail={user?.email}
                                                                        pendingValue={pendingCost[`${menuItem.menuItemId}:${record.sizeId}`]}
                                                                        onCostChange={(value) => handleCostChange(menuItem.menuItemId, record.sizeId, value)}
                                                                        onOptimisticAction={applyOptimisticUpdate}
                                                                    />
                                                                </div>
                                                            </li>
                                                        </ul>
                                                    </section>
                                                ))}
                                            </ul>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    );
}

function CostVariationForm({
    menuItem,
    record,
    userEmail,
    pendingValue,
    onCostChange,
    onOptimisticAction,
}: {
    menuItem: MenuItemWithCostVariations;
    record: MenuItemWithCostVariations["costVariations"][number];
    userEmail?: string | null;
    pendingValue?: number;
    onCostChange: (value: number) => void;
    onOptimisticAction: (action: string, formData: FormData) => void;
}) {
    const fetcher = useFetcher();
    const formRef = useRef<HTMLFormElement>(null);
    const [activeAction, setActiveAction] = useState<string | null>(null);

    useEffect(() => {
        if (fetcher.data?.status > 399) {
            toast({ title: "Erro", description: fetcher.data?.message });
        }
        if (fetcher.data?.status === 200) {
            toast({ title: "Ok", description: fetcher.data?.message });
        }
    }, [fetcher.data]);

    useEffect(() => {
        if (fetcher.state === "idle") setActiveAction(null);
    }, [fetcher.state]);

    const submitAction = (action: string) => {
        if (!formRef.current) return;
        setActiveAction(action);
        const fd = new FormData(formRef.current);
        fd.set("_action", action);
        onOptimisticAction(action, fd);
        fetcher.submit(fd, { method: "post" });
    };

    const isSubmitting = fetcher.state !== "idle";
    const isSavingUserInput = isSubmitting && activeAction === "menu-item-cost-variation-upsert-user-input";
    const isAcceptingProposal = isSubmitting && activeAction === "menu-item-cost-variation-upsert-proposed-input";
    const isRecalculating = isSubmitting && activeAction === "menu-item-cost-variation-upsert-from-medium";
    const effectiveCostAmount = pendingValue ?? record.costAmount ?? 0;

    return (
        <form ref={formRef} method="post" className="flex flex-col gap-1 justify-center items-center">
            <div className="flex flex-col gap-2 mb-2">
                <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
                <input type="hidden" name="menuItemCostVariationId" value={record.menuItemCostVariationId ?? ""} />
                <input type="hidden" name="menuItemSizeId" value={record.sizeId ?? ""} />
                <input type="hidden" name="updatedBy" value={record.updatedBy || userEmail || ""} />
                <input type="hidden" name="previousCostAmount" value={record.previousCostAmount} />

                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1 items-center">
                                <div className="flex flex-col gap-y-0">
                                    <span className="text-muted-foreground text-[11px]">Novo custo:</span>
                                    <MoneyInput
                                        name="costAmount"
                                        defaultValue={record.costAmount}
                                        className="w-full font-mono"
                                        onValueChange={onCostChange}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => submitAction("menu-item-cost-variation-upsert-user-input")}
                                    disabled={isSubmitting}
                                    className={cn(
                                        "h-9 w-full md:max-w-none",
                                        "rounded border px-3 text-[11px] uppercase tracking-widest font-semibold",
                                        "bg-slate-300 hover:bg-slate-400 text-black",
                                        isSubmitting && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        {isSavingUserInput && <Loader size={12} className="animate-spin" />}
                                        {isSavingUserInput ? "Salvando..." : "Salvar"}
                                    </span>
                                </button>
                            </div>

                            <div className="flex flex-col gap-1 items-center">
                                <div className="flex flex-col gap-y-0 w-ma">
                                    <span className="text-muted-foreground text-[11px]">Valor proposto</span>
                                    <MoneyInput
                                        name="recommendedCostAmount"
                                        defaultValue={record.recommendedCostAmount}
                                        className="w-full font-mono"
                                        readOnly
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => submitAction("menu-item-cost-variation-upsert-proposed-input")}
                                    disabled={isSubmitting}
                                    className={cn(
                                        "h-9 w-full",
                                        "rounded border px-3 text-[11px] uppercase tracking-widest font-semibold",
                                        "bg-white hover:bg-slate-200 text-black",
                                        isSubmitting && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        {isAcceptingProposal && <Loader size={12} className="animate-spin" />}
                                        {isAcceptingProposal ? "Aceitando..." : "Aceitar proposta"}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => submitAction("menu-item-cost-variation-upsert-from-medium")}
                                disabled={
                                    isSubmitting ||
                                    record.sizeKey !== "pizza-medium" ||
                                    effectiveCostAmount === 0
                                }
                                className={cn(
                                    "h-9 md:max-w-none rounded border px-3 text-[11px] uppercase tracking-widest font-semibold",
                                    "bg-blue-500 text-white hover:bg-blue-600",
                                    record.sizeKey !== "pizza-medium" && "hidden",
                                    isRecalculating && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    {isRecalculating && <Loader size={12} className="animate-spin" />}
                                    {isRecalculating ? "Recalculando..." : "Recalcular outros tamanhos"}
                                </span>
                            </button>
                            <span
                                className={cn(
                                    "text-[11px] text-muted-foreground font-semibold text-blue-500 leading-[1.2]",
                                    record.sizeKey !== "pizza-medium" && "hidden",
                                    record.sizeKey !== "pizza-medium" ||
                                    effectiveCostAmount !== 0 && "hidden",
                                )}
                            >
                                Para calcular o custo dos outros tamanhos inserir o custo do tamanho médio.
                            </span>
                        </div>
                    </div>
                    {effectiveCostAmount === 0 && (
                        <div className="flex gap-2 items-center mt-2">
                            <AlertCircleIcon className="h-4 w-4 text-red-500" />
                            <span className="text-red-500 text-xs font font-semibold">Custo da ficha de custo não definido</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-xs">
                        Custo atual:
                        {pendingValue != null ? ` ${pendingValue} (não salvo)` : ` ${record.costAmount}`}
                    </span>
                    <span className="text-xs text-muted-foreground">Custo anterior: {record.previousCostAmount}</span>
                </div>
            </div>
        </form>
    );
}
