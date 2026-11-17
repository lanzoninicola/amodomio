import prismaClient from "~/lib/prisma/client.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import {
  applyPreparationsToPlan,
  calculateProductionTotals,
  calculateProductionPlan,
  convertQuantity,
  type ProductionOrderItemSnapshot,
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
        costingMode: true,
        yieldQuantity: true,
        yieldUnit: true,
        Preparations: {
          orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
          include: { Ingredients: true },
        },
      },
    }),
  ]);
  if (!config) throw new Response("Receita não encontrada", { status: 404 });
  const ingredients: ProductionRecipeIngredient[] = recipe.ingredients.map(
    (i: any) => ({
      id: i.id,
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
    })
  );
  const storedBase = config.productionBaseRecipeIngredientId;
  const baseIngredientId =
    storedBase && ingredients.some((i) => i.id === storedBase)
      ? storedBase
      : null;
  return {
    id: recipe.id,
    name: recipe.name,
    costingMode: config.costingMode,
    yieldQuantity: config.yieldQuantity == null ? null : Number(config.yieldQuantity),
    yieldUnit: config.yieldUnit,
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

/** Fase 1: totais da receita para a quantidade-base (sem preparações). */
export function planForRecipe(
  recipe: RecipeProduction,
  baseQuantity: number,
  baseIngredientId = recipe.baseIngredientId
): ProductionPlan {
  if (!baseIngredientId) throw new Error("Escolha o ingrediente-base.");
  return calculateProductionTotals({
    ingredients: recipe.ingredients,
    baseIngredientId,
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

  for (const p of input.preparations) {
    if (!p.name.trim()) throw new Error("Informe o nome de cada preparação.");
    if (
      p.ingredients.some((l) => !Number.isFinite(l.quantity) || l.quantity < 0)
    )
      throw new Error(`${p.name}: quantidade inválida.`);
  }
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
          const quantity = convertQuantity(l.quantity, l.unit, ingredient.unit);
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

  const plan = calculateProductionPlan({
    ingredients: recipe.ingredients,
    preparations: preparations.map((p, index) => ({
      id: String(index),
      name: p.name,
      ingredients: p.lines,
    })),
    baseIngredientId: input.baseIngredientId,
    baseQuantity: byId.get(input.baseIngredientId)!.quantity,
  });
  if (plan.inconsistencies.length)
    throw new Error(plan.inconsistencies.join(" "));

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
  baseIngredientId?: string;
  baseQuantity: number;
  productionDate: Date;
  /** Dia em que o resultado será usado; vazio = o mesmo dia da produção. */
  usageDate?: Date | null;
  notes?: string;
}) {
  if (!Number.isFinite(input.productionDate.getTime()))
    throw new Error("Data de produção inválida.");
  if (input.usageDate && !Number.isFinite(input.usageDate.getTime()))
    throw new Error("Data de uso inválida.");
  if (
    input.usageDate &&
    input.usageDate.getTime() < input.productionDate.getTime()
  )
    throw new Error("A data de uso não pode ser anterior à data de produção.");
  const recipe = await getRecipeProduction(input.recipeId);
  const baseId = input.baseIngredientId || recipe.baseIngredientId;
  const base = recipe.ingredients.find((i) => i.id === baseId);
  if (!base) throw new Error("Escolha o ingrediente-base.");
  const plan = planForRecipe(recipe, input.baseQuantity, base.id);
  // As etapas nascem na fase 2, quando as preparações são definidas.
  return prismaClient.productionOrder.create({
    data: {
      recipeId: recipe.id,
      recipeName: recipe.name,
      baseIngredient: base.name,
      baseQuantity: input.baseQuantity,
      baseUnit: base.unit,
      productionDate: input.productionDate,
      usageDate: input.usageDate ?? null,
      notes: input.notes?.trim() || null,
      plan: plan as any,
    },
  });
}

/** Modelo reutilizavel de OP. Datas e estado pertencem apenas aos lancamentos. */
export async function createProductionOrderTemplate(input: {
  name?: string;
  recipeId?: string;
  baseIngredientId?: string;
  baseQuantity?: number;
  items?: Array<{
    recipeId: string;
    baseIngredientId?: string;
    baseQuantity: number;
    calculationMode: "ingredient" | "yield";
    targetQuantity: number;
    targetUnit: string;
  }>;
  notes?: string;
}) {
  const requested = input.items?.length
    ? input.items
    : input.recipeId && input.baseQuantity
      ? [{ recipeId: input.recipeId, baseIngredientId: input.baseIngredientId,
          baseQuantity: input.baseQuantity, calculationMode: "ingredient" as const,
          targetQuantity: input.baseQuantity, targetUnit: "" }]
      : [];
  if (!requested.length) throw new Error("Adicione ao menos uma receita à OP.");
  const items: ProductionOrderItemSnapshot[] = [];
  for (const requestedItem of requested) {
    const recipe = await getRecipeProduction(requestedItem.recipeId);
    const baseId = requestedItem.baseIngredientId || recipe.baseIngredientId;
    const base = recipe.ingredients.find((ingredient) => ingredient.id === baseId);
    if (!base) throw new Error(`${recipe.name}: escolha o ingrediente-base.`);
    if (!Number.isFinite(requestedItem.baseQuantity) || requestedItem.baseQuantity <= 0)
      throw new Error(`${recipe.name}: informe uma quantidade maior que zero.`);
    let plan = planForRecipe(recipe, requestedItem.baseQuantity, base.id);
    plan = applyPreparationsToPlan(plan, recipe.preparations.map((preparation, index) => ({
      id: `p${index + 1}`, name: preparation.name, notes: preparation.notes,
      ingredients: preparation.ingredients.map((line) => ({
        recipeIngredientId: line.recipeIngredientId,
        quantity: line.quantity * plan.scaleFactor,
      })),
    })));
    if (plan.inconsistencies.length) throw new Error(plan.inconsistencies.join(" "));
    items.push({ version: 1, recipeId: recipe.id, recipeName: recipe.name,
      calculationMode: requestedItem.calculationMode,
      targetQuantity: requestedItem.targetQuantity,
      targetUnit: requestedItem.targetUnit || (requestedItem.calculationMode === "yield" ? recipe.yieldUnit || "UN" : base.unit),
      baseIngredientId: base.id, baseIngredient: base.name,
      baseQuantity: requestedItem.baseQuantity, baseUnit: base.unit, plan });
  }
  const first = items[0];

  return prismaClient.productionOrderTemplate.create({
    data: {
      name: input.name?.trim() || items.map((item) => item.recipeName).join(" + "),
      recipeId: first.recipeId,
      recipeName: first.recipeName,
      baseIngredient: first.baseIngredient,
      baseQuantity: first.baseQuantity,
      baseUnit: first.baseUnit,
      plan: first.plan as any,
      items: items as any,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function listProductionOrderTemplates(includeArchived = false) {
  return prismaClient.productionOrderTemplate.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ name: "asc" }, { number: "desc" }],
    include: {
      _count: { select: { Launches: true } },
      Launches: {
        orderBy: [{ productionDate: "desc" }, { number: "desc" }],
        take: 30,
        select: { id: true, number: true, productionDate: true, status: true },
      },
    },
  });
}

export async function getProductionOrderTemplate(id: string) {
  const template = await prismaClient.productionOrderTemplate.findUnique({
    where: { id },
    include: {
      Launches: {
        orderBy: [{ productionDate: "desc" }, { number: "desc" }],
        take: 30,
      },
    },
  });
  if (!template)
    throw new Response("OP nao encontrada", { status: 404 });
  return { ...template, plan: template.plan as unknown as ProductionPlan };
}

export async function launchProductionOrderTemplate(input: {
  templateId: string;
  productionDate: Date;
  usageDate?: Date | null;
  notes?: string;
  stepSchedules?: Array<{
    itemIndex: number;
    kind: "preparation" | "final";
    preparationIndex?: number;
    startAt: Date;
    endAt?: Date | null;
  }>;
}) {
  if (!Number.isFinite(input.productionDate.getTime()))
    throw new Error("Data de producao invalida.");
  if (input.usageDate && input.usageDate < input.productionDate)
    throw new Error("A data de uso nao pode ser anterior a data de producao.");
  const template = await getProductionOrderTemplate(input.templateId);
  if (template.archivedAt) throw new Error("Esta OP esta arquivada.");
  const plan = template.plan;
  const items = (Array.isArray(template.items) && template.items.length
    ? template.items
    : [{ version: 1, recipeId: template.recipeId, recipeName: template.recipeName,
        calculationMode: "ingredient", targetQuantity: template.baseQuantity,
        targetUnit: template.baseUnit, baseIngredientId: plan.baseIngredientId || "",
        baseIngredient: template.baseIngredient, baseQuantity: template.baseQuantity,
        baseUnit: template.baseUnit, plan }]) as unknown as ProductionOrderItemSnapshot[];
  const scheduleFor = (itemIndex: number, kind: "preparation" | "final", preparationIndex?: number) =>
    input.stepSchedules?.find((entry) => entry.itemIndex === itemIndex && entry.kind === kind && entry.preparationIndex === preparationIndex);
  const steps = items.flatMap((item, itemIndex) => [
    ...item.plan.preparations.map((preparation, preparationIndex) => {
      const schedule = scheduleFor(itemIndex, "preparation", preparationIndex);
      return { kind: "preparation", name: preparation.name, preparationId: preparation.id,
        itemIndex, recipeName: item.recipeName, sortOrder: itemIndex * 100 + preparationIndex,
        scheduledStartAt: schedule?.startAt ?? input.productionDate,
        scheduledEndAt: schedule?.endAt ?? null };
    }),
    (() => {
      const schedule = scheduleFor(itemIndex, "final");
      return { kind: "final", name: "Mistura final", itemIndex,
        recipeName: item.recipeName, sortOrder: itemIndex * 100 + item.plan.preparations.length,
        scheduledStartAt: schedule?.startAt ?? input.productionDate,
        scheduledEndAt: schedule?.endAt ?? null };
    })(),
  ]);
  return prismaClient.productionOrder.create({
    data: {
      templateId: template.id,
      recipeId: template.recipeId,
      recipeName: template.recipeName,
      baseIngredient: template.baseIngredient,
      baseQuantity: template.baseQuantity,
      baseUnit: template.baseUnit,
      productionDate: input.productionDate,
      usageDate: input.usageDate ?? null,
      notes: input.notes?.trim() || template.notes,
      plan: plan as any,
      items: items as any,
      Steps: {
        create: steps,
      },
    },
  });
}

export async function setProductionOrderTemplateArchived(
  id: string,
  archived: boolean
) {
  return prismaClient.productionOrderTemplate.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
}

export type PreparationInput = {
  name: string;
  notes?: string;
  ingredients: Array<{
    recipeIngredientId: string;
    quantity: number;
    unit: string;
  }>;
};

/**
 * Ponto de partida do editor de preparações (só OP planejada). Antes da fase 2:
 * preparações salvas na receita, escaladas. Depois: as preparações atuais da OP.
 */
export async function getPreparationSuggestions(order: {
  recipeId: string | null;
  status?: string;
  plan: ProductionPlan;
}) {
  if (order.status && order.status !== "planned") return [];
  if (order.plan.preparationsDefined !== false)
    return order.plan.preparations.map((p) => ({
      name: p.name,
      notes: p.notes ?? "",
      ingredients: p.ingredients.map((l) => ({
        recipeIngredientId: l.id,
        quantity: l.quantity,
        unit: l.unit,
      })),
    }));
  if (!order.recipeId) return [];
  const recipe = await getRecipeProduction(order.recipeId).catch(() => null);
  if (!recipe) return [];
  const totals = new Map(order.plan.totals.map((t) => [t.id, t]));
  return recipe.preparations.map((p) => ({
    name: p.name,
    notes: p.notes ?? "",
    ingredients: p.ingredients
      .filter((l) => totals.has(l.recipeIngredientId))
      .map((l) => {
        const total = totals.get(l.recipeIngredientId)!;
        return {
          recipeIngredientId: l.recipeIngredientId,
          quantity: l.quantity * order.plan.scaleFactor,
          unit: total.unit,
        };
      }),
  }));
}

/**
 * Fase 2: define as preparações da OP (lista vazia = sem preparações), recria as
 * etapas e recalcula a etapa final. Só enquanto a OP está planejada.
 */
export async function definePreparations(
  id: string,
  preparations: PreparationInput[],
  options: { saveToRecipe?: boolean } = {}
) {
  const order = await getProductionOrder(id);
  const totals = new Map(order.plan.totals.map((t) => [t.id, t]));
  const normalized = preparations.map((p, index) => {
    const name = String(p.name || "").trim();
    if (!name) throw new Error("Informe o nome de cada preparação.");
    const seen = new Set<string>();
    if (!p.ingredients.some((l) => l.quantity !== 0))
      throw new Error(`${name}: adicione ao menos um ingrediente.`);
    return {
      id: `p${index + 1}`,
      name,
      notes: p.notes?.trim() || null,
      ingredients: p.ingredients
        .filter((l) => l.quantity !== 0)
        .map((l) => {
          const total = totals.get(l.recipeIngredientId);
          if (!total)
            throw new Error(`${name}: ingrediente não encontrado na receita.`);
          if (!Number.isFinite(l.quantity) || l.quantity < 0)
            throw new Error(`${name}: quantidade inválida.`);
          if (seen.has(total.id))
            throw new Error(`${name}: ingrediente repetido.`);
          seen.add(total.id);
          const quantity = convertQuantity(l.quantity, l.unit, total.unit);
          if (quantity == null)
            throw new Error(
              `${name}: unidade ${l.unit} incompatível com ${total.name} (${total.unit}).`
            );
          return { recipeIngredientId: total.id, quantity };
        }),
    };
  });

  await prismaClient.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM production_orders WHERE id = ${id} FOR UPDATE`;
    const current = await tx.productionOrder.findUnique({
      where: { id },
      include: { Steps: { select: { status: true } } },
    });
    if (!current) throw new Response("OP não encontrada", { status: 404 });
    if (current.status !== "planned")
      throw new Error(
        "As preparações só podem ser alteradas antes de iniciar a produção."
      );
    const plan = applyPreparationsToPlan(
      current.plan as unknown as ProductionPlan,
      normalized
    );
    if (plan.inconsistencies.length)
      throw new Error(plan.inconsistencies.join(" "));
    await tx.productionOrderStep.deleteMany({ where: { orderId: id } });
    await tx.productionOrder.update({
      where: { id },
      data: {
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
  });

  if (options.saveToRecipe && order.recipeId && order.plan.baseIngredientId) {
    const scale = order.plan.scaleFactor;
    await saveRecipeProduction(order.recipeId, {
      baseIngredientId: order.plan.baseIngredientId,
      preparations: normalized.map((p) => ({
        name: p.name,
        notes: p.notes ?? "",
        ingredients: p.ingredients.map((l) => ({
          recipeIngredientId: l.recipeIngredientId,
          quantity: l.quantity / scale,
          unit: totals.get(l.recipeIngredientId)!.unit,
        })),
      })),
    });
  }
}

// async: defer exige Promise real, não o PrismaPromise lazy.
export async function listProductionOrders(
  status?: string,
  productionDate?: { gte: Date; lt: Date }
) {
  return prismaClient.productionOrder.findMany({
    where: {
      ...(status && Object.hasOwn(ORDER_STATUS, status) ? { status } : {}),
      ...(productionDate ? { productionDate } : {}),
    },
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
  await prismaClient.$transaction(async (tx) => {
    // Serializa as ações desta OP antes de ler o estado e as etapas.
    await tx.$queryRaw`SELECT id FROM production_orders WHERE id = ${id} FOR UPDATE`;
    const order = await tx.productionOrder.findUnique({
      where: { id },
      include: { Steps: true },
    });
    if (!order) throw new Response("OP não encontrada", { status: 404 });
    const now = new Date();

    if (intent === "start") {
      if (order.status !== "planned") throw new Error("OP já iniciada.");
      if ((order.plan as any)?.preparationsDefined === false)
        throw new Error(
          "Defina as preparações intermediárias antes de iniciar."
        );
      await tx.productionOrder.update({
        where: { id },
        data: { status: "in_progress", startedAt: now },
      });
      return;
    }
    if (intent === "cancel") {
      if (!["planned", "in_progress"].includes(order.status))
        throw new Error("A OP não pode ser cancelada neste estado.");
      await tx.productionOrder.update({
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
        order.Steps.some((s) => s.itemIndex === step.itemIndex && s.kind !== "final" && s.status !== "done")
      )
        throw new Error("Conclua as preparações antes da mistura final.");
      if (
        step.kind !== "final" &&
        to !== "done" &&
        order.Steps.some((s) => s.itemIndex === step.itemIndex && s.kind === "final" && s.status !== "pending")
      )
        throw new Error("Reabra a mistura final primeiro.");
      const allowed: Record<string, string[]> = {
        pending: ["in_progress", "done"],
        in_progress: ["done", "pending"],
        done: ["pending"],
      };
      if (!allowed[step.status]?.includes(to))
        throw new Error("Transição de etapa inválida. Atualize a OP.");
      await tx.productionOrderStep.update({
        where: { id: step.id },
        data: { status: to, completedAt: to === "done" ? now : null },
      });
      return;
    }
    if (intent === "reorder") {
      if (order.status !== "planned" && order.status !== "in_progress")
        throw new Error(
          "A ordem das etapas só muda antes de finalizar a produção."
        );
      const ids = String(form.get("stepIds") || "")
        .split(",")
        .filter(Boolean);
      const preparations = order.Steps.filter((s) => s.kind === "preparation");
      if (
        ids.length !== preparations.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => preparations.some((s) => s.id === id))
      )
        throw new Error("Ordem das etapas inválida. Atualize a OP.");
      for (const [index, id] of ids.entries())
        await tx.productionOrderStep.update({
          where: { id },
          data: { sortOrder: index },
        });
      // A mistura final fica sempre por último.
      const final = order.Steps.find((s) => s.kind === "final");
      if (final)
        await tx.productionOrderStep.update({
          where: { id: final.id },
          data: { sortOrder: ids.length },
        });
      return;
    }
    if (intent === "finish") {
      if (order.status !== "in_progress")
        throw new Error("A OP não está em produção.");
      if (order.Steps.some((s) => s.status !== "done"))
        throw new Error("Conclua todas as etapas antes de finalizar.");
      const rawProduced = String(form.get("producedQuantity") || "").trim();
      const produced = Number(rawProduced.replace(",", "."));
      if (rawProduced && (!Number.isFinite(produced) || produced <= 0))
        throw new Error("Informe uma quantidade produzida maior que zero.");
      await tx.productionOrder.update({
        where: { id },
        data: {
          status: "finished",
          finishedAt: now,
          producedQuantity:
            Number.isFinite(produced) && produced > 0 ? produced : null,
          producedUnit:
            Number.isFinite(produced) && produced > 0
              ? String(form.get("producedUnit") || "").trim() || null
              : null,
        },
      });
      return;
    }
    throw new Error("Ação inválida.");
  });
}
