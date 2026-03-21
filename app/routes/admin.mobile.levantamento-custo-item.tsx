import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import { calculateItemCostMetrics, getItemAverageCostWindowDays } from "~/domain/item/item-cost-metrics.server";
import { itemCostVariationPrismaEntity } from "~/domain/item/item-cost-variation.prisma.entity.server";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Levantamento de custo" }];

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const supplierName = (metadata as Record<string, unknown>).supplierName;
  const normalized = String(supplierName || "").trim();
  return normalized || null;
}

function pickPrimaryItemVariation(item: any) {
  const activeVariations = (item?.ItemVariation || []).filter((row: any) => !row?.deletedAt);
  return activeVariations.find((row: any) => row.isReference) || activeVariations[0] || null;
}

function findLatestPurchaseSupplierName(history: any[]): string {
  for (const row of history || []) {
    const source = String(row?.source || "").trim().toLowerCase();
    if (source !== "purchase" && source !== "import") continue;
    const supplierName = getSupplierNameFromMetadata(row?.metadata);
    if (supplierName) return supplierName;
  }

  for (const row of history || []) {
    const supplierName = getSupplierNameFromMetadata(row?.metadata);
    if (supplierName) return supplierName;
  }

  return "";
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const itemId = String(url.searchParams.get("itemId") || "").trim();

    const [averageWindowDays, suppliers, itemOptions, item] = await Promise.all([
      getItemAverageCostWindowDays(),
      supplierPrismaEntity.findAll(),
      db.item.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          classification: true,
          purchaseUm: true,
          consumptionUm: true,
        },
        orderBy: [{ name: "asc" }],
        take: 300,
      }),
      itemId
        ? db.item.findUnique({
            where: { id: itemId },
            include: {
              ItemVariation: {
                where: { deletedAt: null },
                include: {
                  Variation: true,
                  ItemCostVariation: {
                    select: {
                      id: true,
                      costAmount: true,
                      unit: true,
                      validFrom: true,
                      createdAt: true,
                      source: true,
                    },
                  },
                  ItemCostVariationHistory: {
                    select: {
                      id: true,
                      costAmount: true,
                      unit: true,
                      validFrom: true,
                      createdAt: true,
                      source: true,
                      metadata: true,
                    },
                    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
                    take: 100,
                  },
                },
                orderBy: [{ createdAt: "asc" }],
              },
            },
          })
        : Promise.resolve(null),
    ]);

    if (itemId && !item) return badRequest("Item não encontrado");

    if (!item) {
      return ok({
        item: null,
        itemOptions,
        suppliers,
        costMetrics: null,
        averageWindowDays,
      });
    }

    const primaryVariation = pickPrimaryItemVariation(item);
    const primaryHistory = primaryVariation?.ItemCostVariationHistory || [];
    const currentCost = primaryVariation?.ItemCostVariation || null;
    const historyForMetrics = primaryHistory.length > 0 ? primaryHistory : currentCost ? [currentCost] : [];
    const costMetrics = calculateItemCostMetrics({
      item,
      history: historyForMetrics,
      averageWindowDays,
    });

    return ok({
      item: {
        ...item,
        _baseItemVariation: primaryVariation,
        _itemCostVariationHistory: primaryHistory,
        _itemCostVariationCurrent: currentCost,
        _latestPurchaseSupplierName: findLatestPurchaseSupplierName(primaryHistory),
      },
      itemOptions,
      suppliers,
      costMetrics,
      averageWindowDays,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const itemId = String(formData.get("itemId") || "").trim();
    const actionName = String(formData.get("_action") || "");

    if (!itemId) return badRequest("Item inválido");

    if (actionName === "supplier-quick-create") {
      const name = String(formData.get("name") || "").trim();
      if (!name) return badRequest("Informe o nome do fornecedor");

      const created = await supplierPrismaEntity.create({ name });
      return ok({
        message: "Fornecedor criado com sucesso",
        supplier: { id: created.id, name: created.name, cnpj: created.cnpj },
      });
    }

    if (actionName === "item-cost-add") {
      const costAmount = Number(formData.get("costAmount") || 0);
      const unit = String(formData.get("unit") || "").trim();
      const source = String(formData.get("source") || "manual").trim();
      const supplierName = String(formData.get("supplierName") || "").trim();
      const notes = String(formData.get("notes") || "").trim();
      const comparisonOnly = formData.get("comparisonOnly") === "on";

      if (!(costAmount > 0)) return badRequest("Informe um custo maior que zero");

      const baseItemVariation = await itemVariationPrismaEntity.findPrimaryVariationForItem(itemId, {
        ensureBaseIfMissing: true,
      });

      if (!baseItemVariation?.id) return badRequest("Nenhuma variação disponível para registrar custo");

      const metadata = {
        supplierName: supplierName || null,
        notes: notes || null,
        comparisonOnly,
        excludeFromMetrics: comparisonOnly,
        legacyAction: "item-cost-add",
      };

      if (comparisonOnly) {
        await itemCostVariationPrismaEntity.addHistoryEntry({
          itemVariationId: baseItemVariation.id,
          costAmount,
          unit: unit || null,
          source: source || "manual",
          validFrom: new Date(),
          metadata,
        });
      } else {
        await itemCostVariationPrismaEntity.setCurrentCost({
          itemVariationId: baseItemVariation.id,
          costAmount,
          unit: unit || null,
          source: source || "manual",
          validFrom: new Date(),
          metadata,
        });
      }

      return ok("Levantamento registrado com sucesso");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminMobileItemCostSurveyPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const payload = data.payload as any;
  const fetcher = useFetcher<any>();
  const item = payload.item;
  const itemOptions = payload.itemOptions || [];
  const suppliers = payload.suppliers || [];
  const costMetrics = payload.costMetrics;
  const latestCost = costMetrics?.latestCost || item?._itemCostVariationCurrent || item?._itemCostVariationHistory?.[0] || null;
  const latestCostAmount = Number(latestCost?.costAmount || 0);
  const averageCostAmount = Number(costMetrics?.averageCostPerConsumptionUnit || 0);
  const latestSupplierName =
    (item?._itemCostVariationHistory || []).map((row: any) => getSupplierNameFromMetadata(row?.metadata)).find(Boolean) || "";
  const latestPurchaseSupplierName = String(item?._latestPurchaseSupplierName || "").trim();

  const [source, setSource] = useState("manual");
  const [unit, setUnit] = useState(latestCost?.unit || item?.purchaseUm || item?.consumptionUm || "");
  const [supplierName, setSupplierName] = useState(latestPurchaseSupplierName || latestSupplierName);
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const [costAmount, setCostAmount] = useState(latestCostAmount > 0 ? latestCostAmount : averageCostAmount || 0);
  const [selectedItemId, setSelectedItemId] = useState(String(item?.id || ""));
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
  const createdSupplier = fetcher.data?.payload?.supplier;

  useEffect(() => {
    setSelectedItemId(String(item?.id || ""));
  }, [item?.id]);

  useEffect(() => {
    setUnit(latestCost?.unit || item?.purchaseUm || item?.consumptionUm || "");
  }, [latestCost?.unit, item?.purchaseUm, item?.consumptionUm]);

  useEffect(() => {
    setSupplierName(latestPurchaseSupplierName || latestSupplierName);
  }, [latestPurchaseSupplierName, latestSupplierName]);

  useEffect(() => {
    setCostAmount(latestCostAmount > 0 ? latestCostAmount : averageCostAmount || 0);
  }, [latestCostAmount, averageCostAmount]);

  useEffect(() => {
    if (actionData?.status === 200 && actionData?.message) {
      toast({ title: "Ok", description: actionData.message });
    }
    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }
  }, [actionData]);

  useEffect(() => {
    if (fetcher.data?.status === 200 && fetcher.data?.message) {
      toast({ title: "Ok", description: fetcher.data.message });
    }
    if (fetcher.data?.status && fetcher.data.status >= 400) {
      toast({ title: "Erro", description: fetcher.data.message, variant: "destructive" });
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (createdSupplier?.name) {
      setSupplierName(createdSupplier.name);
      setQuickSupplierName("");
    }
  }, [createdSupplier]);

  const supplierOptions: SearchableSelectOption[] = [
    ...(latestPurchaseSupplierName && !suppliers.some((supplier: any) => supplier.name === latestPurchaseSupplierName)
      ? [{ value: latestPurchaseSupplierName, label: `${latestPurchaseSupplierName} (última compra)`, searchText: latestPurchaseSupplierName }]
      : []),
    ...suppliers.map((supplier: any) => ({
      value: supplier.name,
      label: supplier.name,
      searchText: [supplier.name, supplier.cnpj || ""].filter(Boolean).join(" "),
    })),
    ...(createdSupplier && !suppliers.some((supplier: any) => supplier.name === createdSupplier.name)
      ? [{ value: createdSupplier.name, label: createdSupplier.name, searchText: createdSupplier.name }]
      : []),
  ];

  const unitOptions = [latestCost?.unit, item?.purchaseUm, item?.consumptionUm].filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index
  );
  const mobileItemOptions: SearchableSelectOption[] = itemOptions.map((entry: any) => ({
    value: entry.id,
    label: entry.name,
    searchText: [entry.name, entry.classification || "", entry.purchaseUm || "", entry.consumptionUm || ""].filter(Boolean).join(" "),
  }));

  return (
    <div className="space-y-4 pb-6">
      <section className="border-b border-slate-200 pb-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Item</div>
          <div className="mt-2">
            <SearchableSelect
              value={selectedItemId}
              onValueChange={(nextItemId) => {
                setSelectedItemId(nextItemId);
                navigate(nextItemId ? `/admin/mobile/levantamento-custo-item?itemId=${nextItemId}` : "/admin/mobile/levantamento-custo-item");
              }}
              options={mobileItemOptions}
              placeholder="Selecionar produto ou insumo"
              searchPlaceholder="Buscar item..."
              emptyText="Nenhum item encontrado."
              triggerClassName="h-11 w-full max-w-none justify-between rounded-xl border-slate-300 px-3 text-sm"
              contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
            />
          </div>
          {item ? (
            <div className="mt-3 text-sm text-slate-600">
              Selecionado: <span className="font-semibold text-slate-950">{item.name}</span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Selecione um item para abrir o formulário de levantamento.</p>
          )}
        </div>
      </section>

      {item ? (
      <Collapsible open={quickSupplierOpen} onOpenChange={setQuickSupplierOpen} className="border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Fornecedor ao voo</div>
          </div>
          <CollapsibleTrigger asChild>
            <Button type="button" className="h-9 w-9 rounded-full bg-slate-950 p-0 text-white hover:bg-slate-800">
              {quickSupplierOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-3">
          <fetcher.Form method="post" className="space-y-3">
            <input type="hidden" name="_action" value="supplier-quick-create" />
            <input type="hidden" name="itemId" value={item.id} />
            <Input
              name="name"
              value={quickSupplierName}
              onChange={(event) => setQuickSupplierName(event.target.value)}
              placeholder="Nome do fornecedor"
            />
            <Button type="submit" variant="outline" className="h-11 w-full" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? "Salvando..." : "Cadastrar fornecedor"}
            </Button>
          </fetcher.Form>
        </CollapsibleContent>
      </Collapsible>
      ) : null}

      {item ? (
      <Form method="post" className="space-y-4">
        <input type="hidden" name="_action" value="item-cost-add" />
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="unit" value={unit} />
        <input type="hidden" name="supplierName" value={supplierName} />
        <input type="hidden" name="comparisonOnly" value="on" />

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Levantamento rápido</div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <div>
              <Label className="text-base text-slate-900">UM</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-12 rounded-xl border-slate-300 text-base">
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((value) => (
                    <SelectItem key={value} value={value} className="py-3 text-base">
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-base text-slate-900">Valor ({unit || "sem unidade"})</Label>
              <MoneyInput name="costAmount" defaultValue={costAmount} onValueChange={setCostAmount} className="h-12 w-full text-base" />
            </div>
          </div>

          <div>
              <Label className="text-base text-slate-900">Fornecedor ou loja</Label>
              <SearchableSelect
                value={supplierName}
                onValueChange={setSupplierName}
                options={supplierOptions}
                placeholder="Selecionar fornecedor"
                searchPlaceholder="Buscar fornecedor..."
                emptyText="Nenhum fornecedor encontrado."
                triggerClassName="h-12 w-full max-w-none justify-between rounded-xl border-slate-300 px-4 text-base"
                contentClassName="w-[var(--radix-popover-trigger-width)] p-0"
              />
              {latestPurchaseSupplierName ? (
                <div className="mt-2 text-sm text-slate-500">Última compra: {latestPurchaseSupplierName}.</div>
              ) : null}
          </div>
        </div>

        <Button type="submit" className="h-12 w-full rounded-xl text-base">
          Registrar levantamento
        </Button>
      </Form>
      ) : null}
    </div>
  );
}
