import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData, useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { toast } from "~/components/ui/use-toast";
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
  { name: "Variações", href: "variations" },
  { name: "Venda", href: "venda" },
  { name: "Custos", href: "costs" },
  { name: "Receitas", href: "recipes" },
  { name: "Fichas de Custo", href: "item-cost-sheets" },
  { name: "Compras", href: "purchases" },
];

function toBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function normalizeUnit(value: FormDataEntryValue | string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

const RECIPE_VARIATION_POLICY_OPTIONS = ["auto", "hide", "show"] as const;

function pickPrimaryItemVariation(item: any) {
  const activeVariations = (item?.ItemVariation || []).filter((row: any) => !row?.deletedAt);

  return (
    activeVariations.find((row: any) => row.isReference && row?.Variation?.kind !== "base") ||
    activeVariations.find((row: any) => row?.Variation?.kind !== "base") ||
    activeVariations.find((row: any) => row?.Variation?.kind === "base" && row?.Variation?.code === "base") ||
    activeVariations[0] ||
    null
  );
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
            select: { id: true, name: true, createdAt: true },
            take: 5,
          },
          ItemCostSheet: {
            select: {
              id: true,
              name: true,
              isActive: true,
              updatedAt: true,
              baseItemCostSheetId: true,
              itemVariationId: true,
              ItemVariation: {
                select: {
                  id: true,
                  isReference: true,
                  Variation: { select: { name: true, code: true } },
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 20,
          },
          ItemVariation: {
            where: {
              deletedAt: null,
            },
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
    await itemVariationPrismaEntity.syncBaseVariationForItem(loadedItem.id);

    const item = await db.item.findUnique({
      where: { id },
      include: {
        MenuItem: { select: { id: true, name: true }, take: 5 },
        Recipe: { select: { id: true, name: true, createdAt: true }, take: 5 },
        ItemCostSheet: {
          select: {
            id: true,
            name: true,
            isActive: true,
            updatedAt: true,
            baseItemCostSheetId: true,
            itemVariationId: true,
            ItemVariation: {
              select: {
                id: true,
                isReference: true,
                Variation: { select: { name: true, code: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
        },
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
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!item) return badRequest("Item não encontrado");

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
      const recipeVariationPolicyRaw = String(formData.get("recipeVariationPolicy") || "auto").trim().toLowerCase();
      const recipeVariationPolicy = RECIPE_VARIATION_POLICY_OPTIONS.includes(recipeVariationPolicyRaw as any)
        ? recipeVariationPolicyRaw
        : "auto";

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
          recipeVariationPolicy,
          consumptionUm,
          active: toBool(formData.get("active")),
          canPurchase: toBool(formData.get("canPurchase")),
          canTransform: toBool(formData.get("canTransform")),
          canSell: toBool(formData.get("canSell")),
          canStock: toBool(formData.get("canStock")),
        },
      });

      const hasConfiguredVariations = !!(await db.itemVariation.findFirst({
        where: {
          itemId: id,
          deletedAt: null,
          Variation: {
            is: {
              deletedAt: null,
              NOT: { kind: "base" },
            },
          },
        },
        select: { id: true },
      }));

      return ok({
        message: "Item atualizado com sucesso",
        missingVariations: !hasConfiguredVariations,
      });
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

      const baseItemVariation = await itemVariationPrismaEntity.findPrimaryVariationForItem(id, {
        ensureBaseIfMissing: true,
      });
      if (!baseItemVariation?.id) return badRequest("Nenhuma variação disponível para registrar custo");
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

    if (_action === "item-variations-update") {
      const variationIds = Array.from(
        new Set(
          formData
            .getAll("variationIds")
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )
      );
      const referenceVariationId = String(formData.get("referenceVariationId") || "").trim();

      const allowedVariations = await db.variation.findMany({
        where: {
          id: { in: variationIds },
          deletedAt: null,
          NOT: { kind: "base" },
        },
        select: { id: true },
      });

      const normalizedVariationIds = allowedVariations.map((row: any) => row.id);
      const linked = await itemVariationPrismaEntity.replaceItemVariations(id, normalizedVariationIds, {
        keepBase: normalizedVariationIds.length === 0,
      });

      const activeRows = (linked || []).filter((row: any) => !row.deletedAt);
      const requestedReference = activeRows.find((row: any) => row.variationId === referenceVariationId);
      const fallbackReference =
        activeRows.find((row: any) => row.isReference) ||
        activeRows.find((row: any) => row?.Variation?.kind !== "base") ||
        activeRows[0];

      const nextReference = requestedReference || fallbackReference;

      if (nextReference?.id) {
        await itemVariationPrismaEntity.setReferenceVariation({
          itemId: id,
          itemVariationId: nextReference.id,
        });
      }

      return ok("Variantes do item atualizadas com sucesso");
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
  const navigate = useNavigate();
  const [showMissingVariationsDialog, setShowMissingVariationsDialog] = useState(false);

  const item = (loaderData?.payload as any)?.item;
  const costMetrics = (loaderData?.payload as any)?.costMetrics;
  const averageWindowDays = Number((loaderData?.payload as any)?.averageWindowDays || 30);
  const unitOptions = ((loaderData?.payload as any)?.unitOptions || ITEM_UNIT_OPTIONS) as string[];
  const categories = ((loaderData?.payload as any)?.categories || []) as Array<{ id: string; name: string }>;
  const activeTab = getItemActiveTab(location.pathname);

  useEffect(() => {
    if (actionData?.status === 200) {
      toast({ title: "Ok", description: actionData.message });
    }

    if (actionData?.status && actionData.status >= 400) {
      toast({ title: "Erro", description: actionData.message, variant: "destructive" });
    }

    const shouldPromptMissingVariations =
      actionData?.status === 200 &&
      actionData?.payload?.missingVariations === true;

    if (shouldPromptMissingVariations) {
      setShowMissingVariationsDialog(true);
    }
  }, [actionData]);

  if (!item) {
    const message = loaderData?.message || "Nao foi possivel carregar o item.";
    return <div className="p-4 text-sm text-muted-foreground">{message}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-5 border-b border-slate-200/80 pb-5">


        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{item.name}</h2>
            <p className="text-sm text-slate-500">{item.id}</p>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <nav className="overflow-x-auto border-b border-slate-100">
          <div className="flex min-w-max items-center gap-6 text-sm">
            {itemNavigation.map((navItem) => {
              const isActive = activeTab === navItem.href;
              return (
                <Link
                  key={navItem.href}
                  to={navItem.href}
                  className={`border-b-2 pb-3 font-medium transition ${
                    isActive
                      ? "border-slate-950 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {navItem.name}
                </Link>
              );
            })}
          </div>
        </nav>

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

      <AlertDialog open={showMissingVariationsDialog} onOpenChange={setShowMissingVariationsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este item ainda não tem variações configuradas</AlertDialogTitle>
            <AlertDialogDescription>
              Você quer configurar as variações agora? Se continuar, o sistema vai abrir a aba de variações deste item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Depois</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/admin/items/${item.id}/variations`)}>
              Configurar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getItemActiveTab(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const itemIdIndex = segments.findIndex((segment) => segment === "items");

  if (itemIdIndex < 0) return lastUrlSegment(pathname);

  return segments[itemIdIndex + 2] || lastUrlSegment(pathname);
}
