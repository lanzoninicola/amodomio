import { json } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
import { getMobileRecipe } from "./mobile-recipe.server";
import { createRecipeTemplateSnapshot } from "./recipe-template";
import type { RecipeTemplateSnapshot } from "./recipe-template";

export async function getTemplateRecipe(recipeId: string) {
  if (!recipeId) throw new Response("Receita inválida", { status: 400 });
  const recipe = await prismaClient.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, name: true },
  });
  if (!recipe) throw new Response("Receita não encontrada", { status: 404 });
  return recipe;
}

export async function listRecipeTemplates(recipeId: string) {
  return prismaClient.recipeTemplate.findMany({
    where: { recipeId },
    select: { id: true, name: true, description: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function getRecipeTemplate(recipeId: string, templateId: string) {
  const template = await prismaClient.recipeTemplate.findFirst({
    where: { id: templateId, recipeId },
  });
  if (!template) throw new Response("Template não encontrado", { status: 404 });
  return { ...template, snapshot: template.snapshot as RecipeTemplateSnapshot };
}

export async function saveRecipeDisplayUnit(recipeId: string, form: FormData) {
  const ingredientId = String(form.get("ingredientId") || "");
  const unit = String(form.get("unit") || "");
  const recipe = await getMobileRecipe(recipeId);
  const ingredient = recipe.ingredients.find(
    (entry) => entry.id === ingredientId
  );
  if (
    !ingredient ||
    !ingredient.displayUnits.some(
      (entry) =>
        entry.unit === unit && Number.isFinite(entry.factor) && entry.factor > 0
    )
  ) {
    return json(
      { error: "Ingrediente ou unidade inválidos para esta receita." },
      { status: 400 }
    );
  }
  const result = await prismaClient.recipeIngredient.updateMany({
    where: { id: ingredientId, recipeId },
    data: { mobileDisplayUnit: unit },
  });
  if (!result.count)
    return json({ error: "Ingrediente não encontrado." }, { status: 404 });
  return json({ savedDisplayUnit: unit, ingredientId });
}

export async function deleteRecipeTemplate(recipeId: string, form: FormData) {
  const templateId = String(form.get("templateId") || "").trim();
  if (!templateId)
    return json({ error: "Template inválido." }, { status: 400 });
  const result = await prismaClient.recipeTemplate.deleteMany({
    where: { id: templateId, recipeId },
  });
  if (!result.count)
    return json({ error: "Template não encontrado." }, { status: 404 });
  return json({ deletedTemplateId: templateId });
}

export async function createRecipeTemplate(recipeId: string, form: FormData) {
  const name = String(form.get("name") || "").trim();
  const description = String(form.get("description") || "").trim();
  const scaleFactor = Number(form.get("scaleFactor"));
  if (!name || name.length > 120 || description.length > 2000) {
    return json(
      {
        error:
          "Informe um nome de até 120 caracteres e uma descrição de até 2000 caracteres.",
      },
      { status: 400 }
    );
  }
  const recipe = await getMobileRecipe(recipeId);
  let snapshot: RecipeTemplateSnapshot;
  try {
    const selectedUnits = JSON.parse(String(form.get("selectedUnits") || "{}"));
    if (
      !selectedUnits ||
      typeof selectedUnits !== "object" ||
      Array.isArray(selectedUnits) ||
      Object.values(selectedUnits).some((unit) => typeof unit !== "string")
    ) {
      return json(
        { error: "Unidades selecionadas inválidas." },
        { status: 400 }
      );
    }
    snapshot = createRecipeTemplateSnapshot(recipe, scaleFactor, selectedUnits);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Quantidades inválidas.",
      },
      { status: 400 }
    );
  }
  const template = await prismaClient.recipeTemplate.create({
    data: { recipeId, name, description: description || null, snapshot },
    select: { id: true },
  });
  return json({ createdTemplateId: template.id });
}
