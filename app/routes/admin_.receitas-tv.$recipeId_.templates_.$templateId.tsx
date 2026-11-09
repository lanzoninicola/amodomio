import { useLoaderData, useLocation, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { loader } from "./admin.mobile.receitas.$recipeId_.templates_.$templateId";
import { RecipeTv } from "./admin_.receitas-tv.$recipeId";
import { useRecipeTemplateChecklist } from "~/domain/recipe/components/recipe-template-checklist";
import { DeleteRecipeTemplateDialog } from "~/domain/recipe/components/delete-recipe-template-dialog";
import { buildRecipeTemplateView } from "~/domain/recipe/recipe-template-view";
export {
  loader,
  meta,
} from "./admin.mobile.receitas.$recipeId_.templates_.$templateId";

export default function RecipeTvTemplatePage() {
  const {
    payload: { recipe, template },
  } = useLoaderData<typeof loader>();
  const checklist = useRecipeTemplateChecklist(template.id);
  const [deleting, setDeleting] = useState(false);
  const { search } = useLocation();
  const navigate = useNavigate();
  const listPath = `/admin/receitas-tv/${recipe.id}/templates`;
  const savedRecipe = buildRecipeTemplateView(recipe, template);
  return (
    <>
      <RecipeTv
        key={template.id}
        recipe={savedRecipe}
        configuration={{ scaleFactor: 1, selectedUnits: {} }}
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
