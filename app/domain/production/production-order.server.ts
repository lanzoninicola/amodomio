import prismaClient from "~/lib/prisma/client.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import {
  calculateProductionPlan,
  convertQuantity,
  type ProductionPlan,
  type ProductionRecipeIngredient,
} from "./production-order-calc";

export type FormLike = { get(name: string): unknown };

export const ORDER_STATUS = {
  planned: "Planejada",
  in_progress: "Em produção",
  finished: "Finalizada",
  cancelled: "Cancelada",
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS;

export async function listProductionRecipes() {
  return prismaClient.recipe.findMany({
    where: { status: { not: "archived" } },
    select: {
      id: true,
      name: true,
      status: true,
      productionBaseRecipeIngredientId: true,
      _count: { select: { Preparations: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Ingredientes (variação de referência), ingrediente-base e preparações de uma receita. */
export async function getRecipeProduction(recipeId: string) {
  const [recipe, config] = await Promise.all([
    getMobileRecipe(recipeId),
    prismaClient.recipe.findUnique({
      where: { id: recipeId },
      select: {
        productionBaseRecipeIngredientId: true,
        Preparations: {
          orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
          include: { Ingredients: true },
        },
      },
    }),
  ]);
  if (!config) throw new Response("Receita não encontrada", { status: 404 });
  const ingredients: ProductionRecipeIngredient[] = recipe.ingredients.map((i: any) => ({
    id: i.id,
    name: i.name,
    quantity: Number(i.quantity),
    unit: i.unit,
  }));
  const storedBase = config.productionBaseRecipeIngredientId;
  const baseIngredientId =
    storedBase && ingredients.some((i) => i.id === storedBase)
      ? storedBase
      : null;
  return {
    id: recipe.id,
    name: recipe.name,
    ingredients,
    baseIngredientId,
    preparations: config.Preparations.map((p: any) => ({
      id: p.id,
      name: p.name,
      notes: p.notes,
      ingredients: p.Ingredients.map((l: any) => ({
        recipeIngredientId: l.recipeIngredientId,
        quantity: l.quantity,
      })),
    })),
  };
}

export type RecipeProduction = Awaited<ReturnType<typeof getRecipeProduction>>;

export function planForRecipe(
  recipe: RecipeProduction,
  baseQuantity: number
): ProductionPlan {
  if (!recipe.baseIngredientId)
    throw new Error("Defina o ingrediente-base da receita.");
  return calculateProductionPlan({
    ingredients: recipe.ingredients,
    preparations: recipe.preparations,
    baseIngredientId: recipe.baseIngredientId,
    baseQuantity,
  });
}

export async function saveRecipeProduction(
  recipeId: string,
  input: {
    baseIngredientId: string;
    preparations: Array<{
      name: string;
      notes?: string;
      ingredients: Array<{
        recipeIngredientId: string;
        quantity: number;
        unit: string;
      }>;
    }>;
  }
) {
  const recipe = await getRecipeProduction(recipeId);
  const byId = new Map(recipe.ingredients.map((i) => [i.id, i]));
  if (!byId.has(input.baseIngredientId))
    throw new Error("Ingrediente-base inválido.");

  const preparations = input.preparations
    .filter((p) => p.name.trim())
    .map((p, index) => ({
      name: p.name.trim(),
      notes: p.notes?.trim() || null,
      sortOrderIndex: index,
      lines: p.ingredients
        .filter((l) => l.quantity > 0)
        .map((l) => {
          const ingredient = byId.get(l.recipeIngredientId);
          if (!ingredient) throw new Error("Ingrediente inválido.");
          const quantity = convertQuantity(
            l.quantity,
            l.unit,
            ingredient.unit
          );
          if (quantity == null)
            throw new Error(
              `Unidade ${l.unit} incompatível com ${ingredient.name} (${ingredient.unit}).`
            );
          return { recipeIngredientId: ingredient.id, quantity };
        }),
    }));

  for (const p of preparations) {
    const seen = new Set<string>();
    for (const l of p.lines) {
      if (seen.has(l.recipeIngredientId))
        throw new Error(`${p.name}: ingrediente repetido.`);
      seen.add(l.recipeIngredientId);
    }
  }

  await prismaClient.$transaction(async (tx) => {
    await tx.recipe.update({
      where: { id: recipeId },
      data: { productionBaseRecipeIngredientId: input.baseIngredientId },
    });
    await tx.recipePreparation.deleteMany({ where: { recipeId } });
    for (const p of preparations) {
      await tx.recipePreparation.create({
        data: {
          recipeId,
          name: p.name,
          notes: p.notes,
          sortOrderIndex: p.sortOrderIndex,
          Ingredients: { create: p.lines },
        },
      });
    }
  });
}

export async function createProductionOrder(input: {
  recipeId: string;
  baseQuantity: number;
  productionDate: Date;
  notes?: string;
}) {
  const recipe = await getRecipeProduction(input.recipeId);
  const plan = planForRecipe(recipe, input.baseQuantity);
  if (plan.inconsistencies.length)
    throw new Error(`Receita inconsistente. ${plan.inconsistencies[0]}`);
  const base = recipe.ingredients.find((i) => i.id === recipe.baseIngredientId)!;
  return prismaClient.productionOrder.create({
    data: {
      recipeId: recipe.id,
      recipeName: recipe.name,
      baseIngredient: base.name,
      baseQuantity: input.baseQuantity,
      baseUnit: base.unit,
      productionDate: input.productionDate,
      notes: input.notes?.trim() || null,
      plan: plan as any,
      Steps: {
        create: [
          ...plan.preparations.map((p, index) => ({
            kind: "preparation",
            name: p.name,
            preparationId: p.id,
            sortOrder: index,
          })),
          {
            kind: "final",
            name: "Mistura final",
            sortOrder: plan.preparations.length,
          },
        ],
      },
    },
  });
}

export function listProductionOrders(status?: string) {
  return prismaClient.productionOrder.findMany({
    where: status && status in ORDER_STATUS ? { status } : undefined,
    orderBy: [{ productionDate: "desc" }, { number: "desc" }],
    take: 200,
    include: { Steps: { select: { status: true } } },
  });
}

export async function getProductionOrder(id: string) {
  const order = await prismaClient.productionOrder.findUnique({
    where: { id },
    include: { Steps: { orderBy: { sortOrder: "asc" } } },
  });
  if (!order) throw new Response("OP não encontrada", { status: 404 });
  return { ...order, plan: order.plan as unknown as ProductionPlan };
}

export async function applyOrderAction(
  id: string,
  form: FormLike
): Promise<void> {
  const intent = String(form.get("intent") || "");
  const order = await getProductionOrder(id);
  const now = new Date();

  if (intent === "start") {
    if (order.status !== "planned") throw new Error("OP já iniciada.");
    await prismaClient.productionOrder.update({
      where: { id },
      data: { status: "in_progress", startedAt: now },
    });
    return;
  }
  if (intent === "cancel") {
    if (order.status === "finished") throw new Error("OP já finalizada.");
    await prismaClient.productionOrder.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return;
  }
  if (intent === "step") {
    if (order.status !== "in_progress")
      throw new Error("Inicie a produção antes de operar as etapas.");
    const step = order.Steps.find((s) => s.id === String(form.get("stepId")));
    const to = String(form.get("to"));
    if (!step || !["pending", "in_progress", "done"].includes(to))
      throw new Error("Etapa inválida.");
    if (
      step.kind === "final" &&
      to !== "pending" &&
      order.Steps.some((s) => s.kind !== "final" && s.status !== "done")
    )
      throw new Error("Conclua as preparações antes da mistura final.");
    if (
      step.kind !== "final" &&
      to === "pending" &&
      order.Steps.some((s) => s.kind === "final" && s.status !== "pending")
    )
      throw new Error("Reabra a mistura final primeiro.");
    await prismaClient.productionOrderStep.update({
      where: { id: step.id },
      data: { status: to, completedAt: to === "done" ? now : null },
    });
    return;
  }
  if (intent === "finish") {
    if (order.status !== "in_progress")
      throw new Error("A OP não está em produção.");
    if (order.Steps.some((s) => s.status !== "done"))
      throw new Error("Conclua todas as etapas antes de finalizar.");
    const produced = Number(String(form.get("producedQuantity") || "").replace(",", "."));
    await prismaClient.productionOrder.update({
      where: { id },
      data: {
        status: "finished",
        finishedAt: now,
        producedQuantity: Number.isFinite(produced) && produced > 0 ? produced : null,
        producedUnit:
          Number.isFinite(produced) && produced > 0
            ? String(form.get("producedUnit") || "").trim() || null
            : null,
      },
    });
    return;
  }
  throw new Error("Ação inválida.");
}
