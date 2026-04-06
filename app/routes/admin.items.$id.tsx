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
import {
  calculateItemCostAverageWindowMetrics,
  calculateItemCostMetrics,
  getItemAverageCostWindowDays,
} from "~/domain/item/item-cost-metrics.server";
import { recalculateItemCostHistory } from "~/domain/item/item-cost-recalculate.server";
import { loadItemCostAuditForItem } from "~/domain/item/item-cost-audit.server";
import { getAvailableItemUnits as getAvailableItemUnitsFromServer } from "~/domain/item/item-units.server";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { registerItemCostEvent } from "~/domain/costs/item-cost-event.server";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
import {
  DEFAULT_RECIPE_CHATGPT_PROJECT_URL,
  RECIPE_CHATGPT_PROJECT_URL_SETTING_NAME,
  RECIPE_CHATGPT_SETTINGS_CONTEXT,
} from "~/domain/recipe/recipe-chatgpt-settings";
import {
  buildItemRecipeChatGptImportPreview,
  type ExistingRecipeImportMode,
  importItemRecipeFromChatGpt,
  parseItemRecipeChatGptImportPayload,
} from "~/domain/recipe/item-recipe-chatgpt.server";
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
  { name: "Movimentação estoque", href: "stock-movements" },
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

  return activeVariations.find((row: any) => row.isReference) || activeVariations[0] || null;
}

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const supplierName = (metadata as Record<string, unknown>).supplierName;
  const normalized = String(supplierName || "").trim();
  return normalized || null;
}

function shouldHideItemHistoryRow(row: any, movementLookup: Map<string, { itemId: string | null; deletedAt: Date | null }>, itemId: string) {
  const referenceType = String(row?.referenceType || "").trim();
  if (referenceType === "stock-movement-delete") return true;

  const metadata =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  if (metadata?.hideFromItemHistory === true) return true;

  const referenceId = String(row?.referenceId || "").trim();
  if (referenceType !== "stock-movement" || !referenceId) return false;

  const movement = movementLookup.get(referenceId);
  if (!movement) return true;
  if (movement.deletedAt) return true;
  return String(movement.itemId || "") !== String(itemId);
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

function getAvailableItemUnits(itemId?: string) {
  return getAvailableItemUnitsFromServer(itemId);
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const db = prismaClient as any;
    const ingredientRecipeUsageLookup =
      typeof db.recipeIngredient?.findMany === "function"
        ? db.recipeIngredient.findMany({
          where: { ingredientItemId: id },
          select: {
            id: true,
            recipeId: true,
            Recipe: {
              select: { id: true, name: true, createdAt: true },
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 20,
        })
        : Promise.resolve([]);

    const [loadedItem, averageWindowDays, unitOptions, categories, ingredientRecipeUsage, suppliers, recipeAssistantItems, chatGptProjectUrlSetting] = await Promise.all([
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
          ItemSellingInfo: {
            select: {
              id: true,
              ingredients: true,
              longDescription: true,
              notesPublic: true,
            },
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
      getAvailableItemUnits(id),
      db.category.findMany({
        where: { type: "item" },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      ingredientRecipeUsageLookup,
      supplierPrismaEntity.findAll(),
      db.item.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          classification: true,
          consumptionUm: true,
        },
        orderBy: [{ name: "asc" }],
        take: 500,
      }),
      db.setting.findFirst({
        where: {
          context: RECIPE_CHATGPT_SETTINGS_CONTEXT,
          name: RECIPE_CHATGPT_PROJECT_URL_SETTING_NAME,
        },
        orderBy: [{ createdAt: "desc" }],
        select: { value: true },
      }),
    ]);

    if (!loadedItem) return badRequest("Item não encontrado");
    const item = await db.item.findUnique({
      where: { id },
      include: {
        MenuItem: { select: { id: true, name: true }, take: 5 },
        Recipe: { select: { id: true, name: true, createdAt: true }, take: 5 },
        ItemSellingInfo: {
          select: {
            id: true,
            ingredients: true,
            longDescription: true,
            notesPublic: true,
          },
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
        ItemPurchaseConversion: {
          select: { id: true, purchaseUm: true, factor: true },
          orderBy: { purchaseUm: "asc" },
        },
        ItemUnit: {
          select: { id: true, unitCode: true },
        },
      },
    });

    if (!item) return badRequest("Item não encontrado");

    // Load all restricted units and which ones are linked to this item
    const restrictedUnits = typeof db.measurementUnit?.findMany === "function"
      ? await db.measurementUnit.findMany({
          where: { active: true, scope: "restricted" },
          select: { id: true, code: true, name: true, kind: true },
          orderBy: [{ code: "asc" }],
        })
      : [];
    const linkedUnitCodes = new Set<string>(
      (item.ItemUnit ?? []).map((u: any) => u.unitCode)
    );

    const primaryVariation = pickPrimaryItemVariation(item);
    const rawPrimaryHistory = primaryVariation?.ItemCostVariationHistory || [];
    const stockMovementReferenceIds = Array.from(new Set(
      rawPrimaryHistory
        .filter((row: any) => String(row?.referenceType || "").trim() === "stock-movement" && row?.referenceId)
        .map((row: any) => String(row.referenceId)),
    ));
    const referencedMovements = stockMovementReferenceIds.length > 0
      ? await db.stockMovement.findMany({
          where: { id: { in: stockMovementReferenceIds } },
          select: { id: true, itemId: true, deletedAt: true },
        })
      : [];
    const movementLookup = new Map<string, { itemId: string | null; deletedAt: Date | null }>(
      referencedMovements.map((movement: any) => [String(movement.id), { itemId: movement.itemId || null, deletedAt: movement.deletedAt || null }]),
    );
    const primaryHistory = rawPrimaryHistory.filter((row: any) => !shouldHideItemHistoryRow(row, movementLookup, item.id));
    const currentCost = primaryVariation?.ItemCostVariation || null;
    const historyForMetrics = primaryHistory.length > 0 ? primaryHistory : currentCost ? [currentCost] : [];
    const costMetrics = calculateItemCostMetrics({
      item,
      history: historyForMetrics,
      averageWindowDays,
    });
    const costAverageWindows = [30, 60, 90].map((windowDays) =>
      calculateItemCostAverageWindowMetrics({
        item,
        history: historyForMetrics,
        averageWindowDays: windowDays,
      }),
    );
    const latestPurchaseSupplierName = findLatestPurchaseSupplierName(primaryHistory);
    const costAuditHistory = primaryVariation?.id
      ? await loadItemCostAuditForItem(primaryVariation.id, 30)
      : [];

    return ok({
      item: {
        ...item,
        _baseItemVariation: primaryVariation,
        _itemCostVariationHistory: primaryHistory,
        _itemCostVariationCurrent: currentCost,
        _ingredientRecipeUsage: ingredientRecipeUsage,
        _latestPurchaseSupplierName: latestPurchaseSupplierName,
        _costAuditHistory: costAuditHistory,
      },
      costMetrics,
      costAverageWindows,
      averageWindowDays,
      unitOptions,
      categories,
      suppliers,
      restrictedUnits,
      linkedUnitCodes: Array.from(linkedUnitCodes),
      recipeAssistantItems,
      recipeAssistantChatGptProjectUrl:
        String(chatGptProjectUrlSetting?.value || "").trim() ||
        DEFAULT_RECIPE_CHATGPT_PROJECT_URL,
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

      const availableUnits = await getAvailableItemUnits(id);

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

    if (_action === "item-recipe-chatgpt-preview") {
      const chatGptResponse = String(formData.get("chatGptResponse") || "").trim();
      const existingRecipeImportMode = String(formData.get("existingRecipeImportMode") || "replace_existing").trim() as ExistingRecipeImportMode;
      if (!chatGptResponse) return badRequest("Cole a resposta do ChatGPT antes de pré-visualizar");

      const item = await db.item.findUnique({
        where: { id },
        include: {
          Recipe: {
            select: { id: true, name: true },
            take: 10,
          },
          ItemCostSheet: {
            select: { id: true, baseItemCostSheetId: true },
            take: 20,
          },
          ItemVariation: {
            where: { deletedAt: null },
            include: { Variation: true },
            orderBy: [{ createdAt: "asc" }],
          },
        },
      });
      if (!item) return badRequest("Item não encontrado");

      try {
        const payload = parseItemRecipeChatGptImportPayload(chatGptResponse);
        const { preview } = await buildItemRecipeChatGptImportPreview({
          db,
          item,
          payload,
          existingRecipeImportMode,
        });

        return ok({
          message: "Pré-visualização gerada",
          payload: preview,
        });
      } catch (error) {
        return badRequest(
          (error as Error)?.message || "Erro ao gerar pré-visualização da importação"
        );
      }
    }

    if (_action === "item-recipe-chatgpt-import") {
      const chatGptResponse = String(formData.get("chatGptResponse") || "").trim();
      const existingRecipeImportMode = String(formData.get("existingRecipeImportMode") || "replace_existing").trim() as ExistingRecipeImportMode;
      if (!chatGptResponse) return badRequest("Cole a resposta do ChatGPT antes de importar");

      const item = await db.item.findUnique({
        where: { id },
        include: {
          Recipe: {
            select: { id: true, name: true },
            take: 10,
          },
          ItemCostSheet: {
            select: { id: true, baseItemCostSheetId: true },
            take: 20,
          },
          ItemVariation: {
            where: { deletedAt: null },
            include: { Variation: true },
            orderBy: [{ createdAt: "asc" }],
          },
        },
      });
      if (!item) return badRequest("Item não encontrado");

      try {
        const payload = parseItemRecipeChatGptImportPayload(chatGptResponse);
        if (payload.ingredients.length === 0) {
          return badRequest("A resposta só contém ingredientes faltantes. Cadastre os itens e tente novamente.");
        }

        const result = await importItemRecipeFromChatGpt({
          db,
          item,
          payload,
          existingRecipeImportMode,
        });

        return ok({
          message: "Receita e ficha técnica geradas com sucesso",
          payload: result,
        });
      } catch (error) {
        return badRequest(
          (error as Error)?.message || "Erro ao importar receita do ChatGPT"
        );
      }
    }

    if (_action === "item-purchase-conversion-add") {
      const currentItem = await db.item.findUnique({
        where: { id },
        select: { id: true, consumptionUm: true },
      });

      if (!currentItem) return badRequest("Item não encontrado");
      if (!currentItem.consumptionUm) {
        return badRequest("Defina primeiro a unidade de consumo na aba Principal");
      }

      const purchaseUm = normalizeUnit(formData.get("purchaseUm"));
      const factorRaw = String(formData.get("factor") || "").trim();
      const factor = factorRaw ? Number(factorRaw) : null;

      if (!purchaseUm) return badRequest("Informe a unidade de compra");
      if (!(Number.isFinite(factor) && factor > 0)) return badRequest("Informe um fator maior que zero");

      const availableUnits = await getAvailableItemUnits(id);
      if (!availableUnits.includes(purchaseUm)) return badRequest("Unidade de compra inválida");

      await db.itemPurchaseConversion.upsert({
        where: { itemId_purchaseUm: { itemId: id, purchaseUm } },
        create: { id: crypto.randomUUID(), itemId: id, purchaseUm, factor },
        update: { factor },
      });

      return ok("Conversão adicionada com sucesso");
    }

    if (_action === "item-purchase-conversion-delete") {
      const conversionId = String(formData.get("conversionId") || "").trim();
      if (!conversionId) return badRequest("Conversão inválida");

      const existing = await db.itemPurchaseConversion.findUnique({ where: { id: conversionId } });
      if (!existing || existing.itemId !== id) return badRequest("Conversão não encontrada");

      await db.itemPurchaseConversion.delete({ where: { id: conversionId } });

      return ok("Conversão removida com sucesso");
    }

    if (_action === "item-cost-add") {
      const costAmount = Number(formData.get("costAmount") || 0);
      const unit = String(formData.get("unit") || "").trim();
      const source = String(formData.get("source") || "manual").trim();
      const supplierName = String(formData.get("supplierName") || "").trim();
      const notes = String(formData.get("notes") || "").trim();
      const comparisonOnly = formData.get("comparisonOnly") === "on";

      if (!(costAmount > 0)) return badRequest("Informe um custo maior que zero");

      const baseItemVariation = await itemVariationPrismaEntity.findPrimaryVariationForItem(id, {
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
        await registerItemCostEvent({
          itemVariationId: baseItemVariation.id,
          costAmount,
          unit: unit || null,
          source: source || "manual",
          movementType: source as any,
          originType: "item-cost-manual-entry",
          originRefId: id,
          appliedBy: null,
          validFrom: new Date(),
          metadata,
          comparisonOnly: true,
        });
      } else {
        await registerItemCostEvent({
          itemVariationId: baseItemVariation.id,
          costAmount,
          unit: unit || null,
          source: source || "manual",
          movementType: source as any,
          originType: "item-cost-manual-entry",
          originRefId: id,
          appliedBy: null,
          validFrom: new Date(),
          metadata,
        });
      }

      return ok("Custo registrado com sucesso");
    }

    if (_action === "supplier-quick-create") {
      const name = String(formData.get("name") || "").trim();

      if (!name) return badRequest("Informe o nome do fornecedor");

      const created = await supplierPrismaEntity.create({
        name,
      });

      return ok({
        message: "Fornecedor criado com sucesso",
        supplier: {
          id: created.id,
          name: created.name,
          cnpj: created.cnpj,
        },
      });
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
        },
        select: { id: true },
      });

      const normalizedVariationIds = allowedVariations.map((row: any) => row.id);
      const linked = await itemVariationPrismaEntity.replaceItemVariations(id, normalizedVariationIds);

      const activeRows = (linked || []).filter((row: any) => !row.deletedAt);
      const requestedReference = activeRows.find((row: any) => row.variationId === referenceVariationId);
      const fallbackReference =
        activeRows.find((row: any) => row.isReference) ||
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

    if (_action === "item-unit-link") {
      const unitCode = String(formData.get("unitCode") || "").trim().toUpperCase();
      if (!unitCode) return badRequest("Informe a unidade");
      const unit = await db.measurementUnit.findUnique({ where: { code: unitCode } });
      if (!unit || unit.scope !== "restricted") return badRequest("Unidade inválida ou não restrita");
      await db.itemUnit.upsert({
        where: { itemId_unitCode: { itemId: id, unitCode } },
        create: { id: crypto.randomUUID(), itemId: id, unitCode },
        update: {},
      });
      return ok("Unidade vinculada");
    }

    if (_action === "item-unit-unlink") {
      const itemUnitId = String(formData.get("itemUnitId") || "").trim();
      if (!itemUnitId) return badRequest("Vínculo inválido");
      const existing = await db.itemUnit.findUnique({ where: { id: itemUnitId } });
      if (!existing || existing.itemId !== id) return badRequest("Vínculo não encontrado");
      await db.itemUnit.delete({ where: { id: itemUnitId } });
      return ok("Unidade desvinculada");
    }

    if (_action === "item-cost-recalculate") {
      const result = await recalculateItemCostHistory(id);
      return ok({
        message: `Recalculado: ${result.updated} atualizados, ${result.skipped} sem alteração, ${result.errors} erros`,
        ...result,
      });
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
  suppliers: Array<{ id: string; name: string; cnpj?: string | null }>;
  recipeAssistantItems: Array<{
    id: string;
    name: string;
    classification?: string | null;
    consumptionUm?: string | null;
  }>;
  recipeAssistantChatGptProjectUrl: string;
  costMetrics: any;
  costAverageWindows: Array<{
    averageWindowDays: number;
    averageCostPerConsumptionUnit: number | null;
    averageSamplesCount: number;
  }>;
  averageWindowDays: number;
  restrictedUnits: Array<{ id: string; code: string; name: string; kind: string | null }>;
  linkedUnitCodes: string[];
};

export default function AdminItemDetailLayout() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMissingVariationsDialog, setShowMissingVariationsDialog] = useState(false);

  const item = (loaderData?.payload as any)?.item;
  const costMetrics = (loaderData?.payload as any)?.costMetrics;
  const costAverageWindows = ((loaderData?.payload as any)?.costAverageWindows || []) as Array<{
    averageWindowDays: number;
    averageCostPerConsumptionUnit: number | null;
    averageSamplesCount: number;
  }>;
  const averageWindowDays = Number((loaderData?.payload as any)?.averageWindowDays || 30);
  const unitOptions = ((loaderData?.payload as any)?.unitOptions || ITEM_UNIT_OPTIONS) as string[];
  const categories = ((loaderData?.payload as any)?.categories || []) as Array<{ id: string; name: string }>;
  const suppliers = (((loaderData?.payload as any)?.suppliers || []) as Array<{ id: string; name: string; cnpj?: string | null }>);
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
            suppliers,
            recipeAssistantItems: ((loaderData?.payload as any)?.recipeAssistantItems || []),
            recipeAssistantChatGptProjectUrl: String((loaderData?.payload as any)?.recipeAssistantChatGptProjectUrl || ""),
            costMetrics,
            costAverageWindows,
            averageWindowDays,
            restrictedUnits: ((loaderData?.payload as any)?.restrictedUnits || []),
            linkedUnitCodes: ((loaderData?.payload as any)?.linkedUnitCodes || []),
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
