import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useLocation } from "@remix-run/react";
import { useState } from "react";
import { authenticator } from "~/domain/auth/google.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import { getRecipeTemplate } from "~/domain/recipe/recipe-templates.server";
import { useRecipeTemplateChecklist } from "~/domain/recipe/components/recipe-template-checklist";
import { DeleteRecipeTemplateDialog } from "~/domain/recipe/components/delete-recipe-template-dialog";
import { buildRecipeTemplateView } from "~/domain/recipe/recipe-template-view";
import { RecipeDetail } from "./admin.mobile.receitas.$recipeId";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.payload.template.name || "Template"} | Receitas` },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const recipeId = String(params.recipeId || "");
  const templateId = String(params.templateId || "");
  if (!recipeId || !templateId)
    throw new Response("Template inválido", { status: 400 });
  const [recipe, template] = await Promise.all([
    getMobileRecipe(recipeId),
    getRecipeTemplate(recipeId, templateId),
  ]);
  return json({ payload: { recipe, template } });
}

export default function RecipeTemplatePage({
  recipeBasePath = "/admin/mobile/receitas",
}: { recipeBasePath?: string } = {}) {
  const {
    payload: { recipe, template },
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { search } = useLocation();
  const checklist = useRecipeTemplateChecklist(template.id);
  const [deleting, setDeleting] = useState(false);
  const listPath = `${recipeBasePath}/${recipe.id}/templates`;
  const savedRecipe = buildRecipeTemplateView(recipe, template);
  return (
    <>
      <RecipeDetail
        key={template.id}
        recipeOverride={savedRecipe}
        configurationOverride={{ scaleFactor: 1, selectedUnits: {} }}
        template={{
          recipeName: template.snapshot.recipeName,
          backUrl: `${listPath}${search}`,
          onDelete: () => setDeleting(true),
          checklist,
        }}
      />
      <DeleteRecipeTemplateDialog
        template={deleting ? { id: template.id, name: template.name } : null}
        recipeName={template.snapshot.recipeName}
        action={listPath}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate(`${listPath}${search}`)}
      />
    </>
  );
}
