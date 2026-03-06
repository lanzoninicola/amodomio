import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

function redirectToRecipe(params: LoaderFunctionArgs["params"]) {
  const recipeId = String(params.id || "").trim();
  if (!recipeId) return "/admin/recipes";
  return `/admin/recipes/${recipeId}`;
}

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(redirectToRecipe(params));
}

export async function action({ params }: ActionFunctionArgs) {
  return redirect(redirectToRecipe(params));
}

export default function RecipeCompositionBuilderRoute() {
  return null;
}
