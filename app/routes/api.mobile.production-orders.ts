import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import {
  applyOrderAction, createProductionOrder, definePreparations, getPreparationSuggestions, getProductionOrder, getRecipeProduction,
  listProductionOrders, listProductionRecipes, planForRecipe, saveRecipeProduction,
} from "~/domain/production/production-order.server";
import { convertQuantity } from "~/domain/production/production-order-calc";
import { readJsonBody } from "~/domain/z-api/security.server";
import { ValidationError } from "~/domain/z-api/errors";

const headers = { "Cache-Control": "no-store" };
const reply = (data: unknown, status = 200) => json(data, { status, headers });
async function failure(error: unknown) {
  if (error instanceof Response) return reply({ message: await error.text() }, error.status);
  if (error instanceof ValidationError) return reply({ message: error.message }, error.status);
  if (error instanceof Error && error.constructor === Error)
    return reply({ message: error.message }, 400);
  console.error("Mobile production orders", error);
  return reply({ message: "Não foi possível atualizar a produção. Atualize a tela antes de tentar novamente." }, 500);
}
async function authorized(request: Request) {
  const { user } = await getAuthenticatedBearerSession(request);
  return user ? null : reply({ message: "Sessão expirada." }, 401);
}
function required(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} inválido.`);
  return value.trim();
}
function productionDate(value: unknown) {
  const raw = required(value, "Dia de produção");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Dia de produção inválido.");
  const date = new Date(`${raw}T12:00:00-03:00`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw)
    throw new Error("Dia de produção inválido.");
  return date;
}
async function orderWithSuggestions(id: string) {
  const order = await getProductionOrder(id);
  return { order, suggestions: await getPreparationSuggestions(order) };
}
async function quantityForRecipe(recipeId: string, baseIngredientId: unknown, quantity: unknown, unit: unknown) {
  const recipe = await getRecipeProduction(recipeId);
  const baseId = typeof baseIngredientId === "string" && baseIngredientId ? baseIngredientId : recipe.baseIngredientId;
  const base = recipe.ingredients.find((i) => i.id === baseId);
  if (!base) throw new Error("Escolha o ingrediente-base.");
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0)
    throw new Error("Informe uma quantidade maior que zero.");
  const converted = convertQuantity(quantity, required(unit, "Unidade"), base.unit);
  if (converted == null) throw new Error("Escolha uma unidade compatível com o ingrediente principal.");
  return { recipe, base, baseQuantity: converted };
}
export async function loader({ request }: LoaderFunctionArgs) {
  const denied = await authorized(request);
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    if (params.get("id")) return reply(await orderWithSuggestions(params.get("id")!));
    if (params.get("recipeId")) return reply({ recipe: await getRecipeProduction(params.get("recipeId")!) });
    if (params.get("recipes") === "1") return reply({ recipes: await listProductionRecipes() });
    const date = params.get("date");
    const midday = date ? productionDate(date) : null;
    const range = midday ? {
      gte: new Date(midday.getTime() - 12 * 60 * 60 * 1000),
      lt: new Date(midday.getTime() + 12 * 60 * 60 * 1000),
    } : undefined;
    const orders = await listProductionOrders(params.get("status") || undefined, range);
    return reply({ orders: orders.map(({ plan, ...order }) => order) });
  } catch (error) { return failure(error); }
}
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return reply({ message: "Método não permitido." }, 405);
  const denied = await authorized(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request, 65536);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Dados inválidos.");
    if (body.intent === "preview" || body.intent === "create") {
      const recipeId = required(body.recipeId, "Receita");
      const { recipe, base, baseQuantity } = await quantityForRecipe(recipeId, body.baseIngredientId, body.quantity, body.unit);
      if (body.intent === "preview") return reply({ plan: planForRecipe(recipe, baseQuantity, base.id), baseQuantity });
      const created = await createProductionOrder({
        recipeId, baseIngredientId: base.id, baseQuantity, productionDate: productionDate(body.date),
        usageDate: body.usageDate ? productionDate(body.usageDate) : null,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      });
      return reply(await orderWithSuggestions(created.id), 201);
    }
    if (body.intent === "save-recipe") {
      const recipeId = required(body.recipeId, "Receita");
      if (!Array.isArray(body.preparations)) throw new Error("Preparações inválidas.");
      const preparations = body.preparations.map((p: any) => {
        if (!p || !Array.isArray(p.ingredients)) throw new Error("Preparação inválida.");
        return {
          name: required(p.name, "Nome da preparação"),
          notes: typeof p.notes === "string" ? p.notes : "",
          ingredients: p.ingredients.map((line: any) => {
            if (!line || typeof line.quantity !== "number") throw new Error("Quantidade inválida.");
            return { recipeIngredientId: required(line.recipeIngredientId, "Ingrediente"),
              quantity: line.quantity, unit: required(line.unit, "Unidade") };
          }),
        };
      });
      await saveRecipeProduction(recipeId, {
        baseIngredientId: required(body.baseIngredientId, "Ingrediente principal"), preparations,
      });
      return reply({ recipe: await getRecipeProduction(recipeId) });
    }
    if (body.intent === "define-preparations") {
      const id = required(body.id, "Produção");
      if (!Array.isArray(body.preparations)) throw new Error("Preparações inválidas.");
      const preparations = body.preparations.map((p: any) => {
        if (!p || !Array.isArray(p.ingredients)) throw new Error("Preparação inválida.");
        return {
          name: required(p.name, "Nome da preparação"),
          notes: typeof p.notes === "string" ? p.notes : "",
          ingredients: p.ingredients.map((line: any) => {
            if (!line || typeof line.quantity !== "number") throw new Error("Quantidade inválida.");
            return { recipeIngredientId: required(line.recipeIngredientId, "Ingrediente"),
              quantity: line.quantity, unit: required(line.unit, "Unidade") };
          }),
        };
      });
      await definePreparations(id, preparations, { saveToRecipe: body.saveToRecipe === true });
      return reply(await orderWithSuggestions(id));
    }
    if (!["start", "step", "finish", "cancel", "reorder"].includes(body.intent)) throw new Error("Ação inválida.");
    const id = required(body.id, "Produção");
    const form = new FormData();
    for (const key of ["intent", "stepId", "to", "producedQuantity", "producedUnit"])
      if (body[key] != null) form.set(key, String(body[key]));
    if (body.intent === "reorder") {
      if (!Array.isArray(body.stepIds) || body.stepIds.some((x: unknown) => typeof x !== "string"))
        throw new Error("Ordem das etapas inválida.");
      form.set("stepIds", body.stepIds.join(","));
    }
    await applyOrderAction(id, form);
    return reply(await orderWithSuggestions(id));
  } catch (error) { return failure(error); }
}
