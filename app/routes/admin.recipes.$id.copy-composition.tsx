import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import { copyRecipeComposition } from "~/domain/recipe/copy-composition.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, unauthorized } from "~/utils/http-response.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) return unauthorized();
  const candidates = await prismaClient.recipe.findMany({
    where: { id: { not: params.id }, RecipeIngredient: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, version: true, status: true, Item: { select: { name: true } }, _count: { select: { RecipeIngredient: true } } },
  });
  return ok({ candidates });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) return unauthorized();
  const form = await request.formData();
  try {
    const result = await copyRecipeComposition(prismaClient, String(params.id || ""), String(form.get("sourceRecipeId") || ""), form.get("includeVariations") === "yes");
    return ok({ message: "Composição copiada com sucesso.", ...result });
  } catch (error) {
    return badRequest((error as Error).message || "Erro ao copiar composição.");
  }
}
