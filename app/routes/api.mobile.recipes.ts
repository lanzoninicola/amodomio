import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import prismaClient from "~/lib/prisma/client.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import {
  createRecipeTemplate,
  deleteRecipeTemplate,
  getRecipeTemplate,
  listRecipeTemplates,
  saveRecipeDisplayUnit,
} from "~/domain/recipe/recipe-templates.server";
import { readJsonBody } from "~/domain/z-api/security.server";
import { ValidationError } from "~/domain/z-api/errors";

async function access(request: Request) {
  const { user } = await getAuthenticatedBearerSession(request);
  return user ? null : json({ message: "Sessão expirada." }, { status: 401 });
}
function failure(error: unknown) {
  if (error instanceof ValidationError)
    return json({ message: error.message }, { status: error.status });
  if (error instanceof Response)
    return error
      .text()
      .then((message) => json({ message }, { status: error.status }));
  console.error("Mobile recipes", error);
  return json(
    { message: "Não foi possível carregar ou salvar a receita." },
    { status: 500 }
  );
}
export async function loader({ request }: LoaderFunctionArgs) {
  const denied = await access(request);
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const recipeId = params.get("recipeId");
    const headers = { "Cache-Control": "no-store" };
    if (!recipeId)
      return json(
        {
          recipes: await prismaClient.recipe.findMany({
            where: { status: "active" },
            select: {
              id: true,
              name: true,
              description: true,
              Item: { select: { name: true } },
            },
            orderBy: { name: "asc" },
          }),
        },
        { headers }
      );
    const recipe = await getMobileRecipe(recipeId);
    if (params.get("templateId"))
      return json(
        {
          recipe,
          template: await getRecipeTemplate(
            recipeId,
            params.get("templateId")!
          ),
        },
        { headers }
      );
    if (params.get("templates") === "1")
      return json(
        { recipe, templates: await listRecipeTemplates(recipeId) },
        { headers }
      );
    return json({ recipe }, { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ message: "Método não permitido." }, { status: 405 });
  const denied = await access(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request, 16384);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ message: "Dados inválidos." }, { status: 400 });
    if (typeof body.recipeId !== "string" || !body.recipeId)
      return json({ message: "Receita inválida." }, { status: 400 });
    const form = new FormData();
    for (const key of [
      "name",
      "description",
      "scaleFactor",
      "ingredientId",
      "unit",
      "templateId",
    ]) {
      if (body[key] !== undefined) form.set(key, String(body[key]));
    }
    if (body.selectedUnits !== undefined)
      form.set("selectedUnits", JSON.stringify(body.selectedUnits));
    let result: Response;
    switch (body.intent) {
      case "create-template":
        result = await createRecipeTemplate(body.recipeId, form);
        break;
      case "delete-template":
        result = await deleteRecipeTemplate(body.recipeId, form);
        break;
      case "save-display-unit":
        result = await saveRecipeDisplayUnit(body.recipeId, form);
        break;
      default:
        return json({ message: "Operação inválida." }, { status: 400 });
    }
    const data = await result.json();
    return json(
      { ...data, ...(data.error ? { message: data.error } : {}) },
      { status: result.status }
    );
  } catch (error) {
    return failure(error);
  }
}
