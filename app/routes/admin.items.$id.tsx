import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData, useLocation } from "@remix-run/react";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import { calculateItemCostMetrics, getItemAverageCostWindowDays } from "~/domain/item/item-cost-metrics.server";
import { itemCostVariationPrismaEntity } from "~/domain/item/item-cost-variation.prisma.entity.server";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";

export const ITEM_CLASSIFICATIONS = [
  "insumo",
  "semi_acabado",
  "produto_final",
  "embalagem",
  "servico",
  "outro",
] as const;

const ITEM_UNIT_OPTIONS = ["UN", "L", "ML", "KG", "G"];

const itemNavigation = [
  { name: "Principal", href: "main" },
  { name: "Custos", href: "costs" },
  { name: "Receitas", href: "recipes" },
  { name: "Fichas de Custo", href: "item-cost-sheets" },
  { name: "Compras", href: "purchases" },
];

function toBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function normalizeUnit(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

async function getAvailableItemUnits() {
  const db = prismaClient as any;
  const staticUnits = ITEM_UNIT_OPTIONS;
  let dbUnits: Array<{ code?: string | null }> | undefined;
  const measurementUnitModel = db.measurementUnit;

  if (typeof measurementUnitModel?.findMany !== "function") {
    return [...staticUnits].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  try {
    dbUnits = await measurementUnitModel.findMany({
      where: { active: true },
      select: { code: true },
      orderBy: [{ code: "asc" }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const isMissingTable =
      message.includes("measurement_units") &&
      (message.includes("does not exist") || message.includes("no such table"));

    if (isMissingTable) {
      console.error("[admin.items.$id] measurement_units table is required but missing");
      throw error;
    } else {
      console.warn("[admin.items.$id] measurementUnit lookup failed, using static units only");
    }
  }

  const merged = new Set<string>(staticUnits);
  for (const row of dbUnits || []) {
    const code = normalizeUnit(row?.code);
    if (code) merged.add(code);
  }

  return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const db = prismaClient as any;
    const [loadedItem, averageWindowDays, unitOptions, categories] = await Promise.all([
      db.item.findUnique({
        where: { id },
        include: {
          // Do not include Item.Category here: some environments still run with a Prisma client
          // generated before the item-category relation existed. The UI only needs item.categoryId
          // plus the categories list loaded below.
          MenuItem: {
            select: { id: true, name: true },
            take: 5,
          },
          Recipe: {
            select: { id: true, name: true },
            take: 5,
          },
          ItemCostSheet: {
            select: { id: true, name: true, isActive: true },
            orderBy: { updatedAt: "desc" },
            take: 5,
          },
          ItemVariation: {
            where: {
              deletedAt: null,
              Variation: {
                is: { kind: "base", code: "base", deletedAt: null },
              },
            },
            take: 1,
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
                  referenceType: true,
                  referenceId: true,
                  updatedBy: true,
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
                  referenceType: true,
                  referenceId: true,
                  createdBy: true,
                  metadata: true,
                },
                orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
                take: 100,
              },
            },
          },
        },
      }),
      getItemAverageCostWindowDays(),
      getAvailableItemUnits(),
      db.category.findMany({
        where: { type: "item" },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
    ]);

    if (!loadedItem) return badRequest("Item não encontrado");
    let item = loadedItem;
    if (!(item as any).ItemVariation?.length) {
      await itemVariationPrismaEntity.ensureBaseVariationForItem(item.id);
      const reloaded = await db.item.findUnique({
        where: { id },
        include: {
          MenuItem: { select: { id: true, name: true }, take: 5 },
          Recipe: { select: { id: true, name: true }, take: 5 },
          ItemCostSheet: {
            select: { id: true, name: true, isActive: true },
            orderBy: { updatedAt: "desc" },
            take: 5,
          },
          ItemVariation: {
            where: {
              deletedAt: null,
              Variation: { is: { kind: "base", code: "base", deletedAt: null } },
            },
            take: 1,
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
                  referenceType: true,
                  referenceId: true,
                  updatedBy: true,
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
                  referenceType: true,
                  referenceId: true,
                  createdBy: true,
                  metadata: true,
                },
                orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
                take: 100,
              },
            },
          },
        },
      });
      if (reloaded) {
        // @ts-ignore simplify mixed generated client compatibility
        item = reloaded;
      }
    }

    const baseVariation = (item as any).ItemVariation?.[0] || null;
    const baseHistory = baseVariation?.ItemCostVariationHistory || [];
    const currentCost = baseVariation?.ItemCostVariation || null;
    const historyForMetrics = baseHistory.length > 0 ? baseHistory : currentCost ? [currentCost] : [];
    const costMetrics = calculateItemCostMetrics({
      item,
      history: historyForMetrics,
      averageWindowDays,
    });
    return ok({
      item: {
        ...item,
        _baseItemVariation: baseVariation,
        _itemCostVariationHistory: baseHistory,
        _itemCostVariationCurrent: currentCost,
      },
      costMetrics,
      averageWindowDays,
      unitOptions,
      categories,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const formData = await request.formData();
    const _action = String(formData.get("_action") || "");
    const db = prismaClient as any;

    if (_action === "item-update") {
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const classification = String(formData.get("classification") || "").trim();
      const consumptionUm = normalizeUnit(formData.get("consumptionUm"));
      const categoryIdRaw = String(formData.get("categoryId") || "").trim();
      const categoryId = categoryIdRaw || null;

      if (!name) return badRequest("Informe o nome do item");
      if (!classification) return badRequest("Informe a classificação");

      const availableUnits = await getAvailableItemUnits();

      if (consumptionUm && !availableUnits.includes(consumptionUm)) {
        return badRequest("Unidade de consumo inválida");
      }

      if (categoryId) {
        const categoryExists = await db.category.findUnique({
          where: { id: categoryId },
          select: { id: true, type: true },
        });

        if (!categoryExists || categoryExists.type !== "item") {
          return badRequest("Categoria inválida");
        }
      }

      await db.item.update({
        where: { id },
        data: {
          name,
          description: description || null,
          classification,
          categoryId,
          consumptionUm,
          active: toBool(formData.get("active")),
          canPurchase: toBool(formData.get("canPurchase")),
          canTransform: toBool(formData.get("canTransform")),
          canSell: toBool(formData.get("canSell")),
          canStock: toBool(formData.get("canStock")),
          canBeInMenu: toBool(formData.get("canBeInMenu")),
        },
      });

      return ok("Item atualizado com sucesso");
    }

    if (_action === "item-purchase-conversion-update") {
      const currentItem = await db.item.findUnique({
        where: { id },
        select: { id: true, consumptionUm: true },
      });

      if (!currentItem) return badRequest("Item não encontrado");
      if (!currentItem.consumptionUm) {
        return badRequest("Defina primeiro a unidade de consumo na aba Principal");
      }

      const purchaseUm = normalizeUnit(formData.get("purchaseUm"));
      const factorRaw = String(formData.get("purchaseToConsumptionFactor") || "").trim();
      const purchaseToConsumptionFactor = factorRaw ? Number(factorRaw) : null;
      const filledConversionFields = [purchaseUm, factorRaw].filter(Boolean).length;

      if (filledConversionFields > 0 && filledConversionFields < 2) {
        return badRequest("Preencha unidade de compra e fator de conversão para salvar");
      }

      if (filledConversionFields === 2 && !(purchaseToConsumptionFactor && purchaseToConsumptionFactor > 0)) {
        return badRequest("Informe um fator de conversão maior que zero");
      }

      const availableUnits = await getAvailableItemUnits();
      if (purchaseUm && !availableUnits.includes(purchaseUm)) {
        return badRequest("Unidade de compra inválida");
      }

      await db.item.update({
        where: { id },
        data: {
          purchaseUm: filledConversionFields === 2 ? purchaseUm : null,
          purchaseToConsumptionFactor: filledConversionFields === 2 ? purchaseToConsumptionFactor : null,
        },
      });

      return ok("Conversão de compra atualizada com sucesso");
    }

    if (_action === "item-cost-add") {
      const costAmount = Number(formData.get("costAmount") || 0);
      const unit = String(formData.get("unit") || "").trim();
      const source = String(formData.get("source") || "manual").trim();
      const supplierName = String(formData.get("supplierName") || "").trim();
      const notes = String(formData.get("notes") || "").trim();

      if (!(costAmount > 0)) return badRequest("Informe um custo maior que zero");

      const baseItemVariation = await itemVariationPrismaEntity.ensureBaseVariationForItem(id);
      await itemCostVariationPrismaEntity.setCurrentCost({
        itemVariationId: baseItemVariation.id,
        costAmount,
        unit: unit || null,
        source: source || "manual",
        validFrom: new Date(),
        metadata: {
          supplierName: supplierName || null,
          notes: notes || null,
          legacyAction: "item-cost-add",
        },
      });

      return ok("Custo registrado com sucesso");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export type AdminItemOutletContext = {
  item: any;
  classifications: readonly string[];
  unitOptions: string[];
  categories: Array<{ id: string; name: string }>;
  costMetrics: any;
  averageWindowDays: number;
};

export default function AdminItemDetailLayout() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();

  const item = (loaderData?.payload as any)?.item;
  const costMetrics = (loaderData?.payload as any)?.costMetrics;
  const averageWindowDays = Number((loaderData?.payload as any)?.averageWindowDays || 30);
  const unitOptions = ((loaderData?.payload as any)?.unitOptions || ITEM_UNIT_OPTIONS) as string[];
  const categories = ((loaderData?.payload as any)?.categories || []) as Array<{ id: string; name: string }>;
  const activeTab = lastUrlSegment(location.pathname);

  if (actionData?.status === 200) {
    toast({ title: "Ok", description: actionData.message });
  }
  if (actionData?.status && actionData.status >= 400) {
    toast({ title: "Erro", description: actionData.message, variant: "destructive" });
  }

  if (!item) {
    const message = loaderData?.message || "Nao foi possivel carregar o item.";
    return <div className="p-4 text-sm text-muted-foreground">{message}</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{item.name}</h1>
            <p className="text-sm text-slate-600">{item.id}</p>
          </div>
          <Link to="/admin/items" className="text-sm underline">
            Voltar
          </Link>
        </div>
      </div>

      <div className="h-full w-full rounded-[inherit]">
        <div style={{ minWidth: "100%", display: "table" }}>
          <div className="flex justify-between">
            <div className="flex items-center col-span-6">
              {itemNavigation.map((navItem) => (
                <MenuItemNavLink
                  key={navItem.name}
                  to={navItem.href}
                  isActive={activeTab === navItem.href}
                >
                  {navItem.name}
                </MenuItemNavLink>
              ))}
            </div>
          </div>
        </div>
        <Separator className="my-4" />
      </div>

      <Outlet
        context={{
          item,
          classifications: ITEM_CLASSIFICATIONS,
          unitOptions,
          categories,
          costMetrics,
          averageWindowDays,
        }}
      />
    </div>
  );
}
