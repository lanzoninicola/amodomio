import { json, redirect } from "@remix-run/node";
import type {
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigate,
  useLocation,
} from "@remix-run/react";
import { useState } from "react";
import { ChevronLeft, Trash2 } from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import { getRecipeTemplate } from "~/domain/recipe/recipe-templates.server";
import {
  applyTemplateUnitPreference,
  getTemplateIngredientDisplayUnits,
} from "~/domain/recipe/recipe-template";
import { RecipeTemplateIngredients } from "~/domain/recipe/components/recipe-template-ingredients";
import { useRecipeTemplateChecklist } from "~/domain/recipe/components/recipe-template-checklist";
import { DeleteRecipeTemplateDialog } from "~/domain/recipe/components/delete-recipe-template-dialog";
import { Button } from "~/components/ui/button";
import { RecipeDisplayUnitDialog } from "~/domain/recipe/components/recipe-display-unit-dialog";
import type { DisplayUnitPrompt } from "~/domain/recipe/components/recipe-display-unit-dialog";

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

export default function RecipeTemplatePage() {
  const {
    payload: { recipe, template },
  } = useLoaderData<typeof loader>();
  return (
    <RecipeTemplateDetail
      key={template.id}
      recipe={recipe}
      template={template}
    />
  );
}

function RecipeTemplateDetail({
  recipe,
  template,
}: SerializeFrom<typeof loader>["payload"]) {
  const navigate = useNavigate();
  const { addedIds, toggle, reset } = useRecipeTemplateChecklist(template.id);
  const [deleting, setDeleting] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>(
    {}
  );
  const [unitPrompt, setUnitPrompt] = useState<DisplayUnitPrompt | null>(null);
  const { search } = useLocation();
  const listPath = `/admin/mobile/receitas/${recipe.id}/templates`;
  return (
    <div className="space-y-4 pb-6">
      <Link
        to={`${listPath}${search}`}
        className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-slate-600"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar aos templates
      </Link>
      <div>
        <h2 className="break-words text-2xl font-semibold text-slate-950">
          {template.name}
        </h2>
        <p className="mt-1 text-xs text-slate-500">{recipe.name}</p>
        {template.description ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {template.description}
          </p>
        ) : null}
      </div>
      {template.snapshot.yieldQuantity !== null ? (
        <p className="text-sm font-semibold">
          Rendimento:{" "}
          {Number(template.snapshot.yieldQuantity).toLocaleString("pt-BR", {
            maximumFractionDigits: 3,
          })}{" "}
          {template.snapshot.yieldUnit}
        </p>
      ) : null}
      <RecipeTemplateIngredients
        ingredients={template.snapshot.ingredients.map((ingredient) =>
          applyTemplateUnitPreference(
            ingredient,
            recipe.ingredients.find((current) => current.id === ingredient.id),
            selectedUnits[ingredient.id] ||
              recipe.ingredients.find((current) => current.id === ingredient.id)
                ?.preferredUnit
          )
        )}
        addedIds={addedIds}
        onToggle={toggle}
        onReset={reset}
        displayUnits={Object.fromEntries(
          template.snapshot.ingredients.map((ingredient) => [
            ingredient.id,
            getTemplateIngredientDisplayUnits(
              ingredient,
              recipe.ingredients.find((current) => current.id === ingredient.id)
            ),
          ])
        )}
        onUnitChange={(ingredientId, unit) => {
          const ingredient = template.snapshot.ingredients.find(
            (entry) => entry.id === ingredientId
          );
          if (!ingredient) return;
          const current = recipe.ingredients.find(
            (entry) => entry.id === ingredientId
          );
          const displayed = applyTemplateUnitPreference(
            ingredient,
            current,
            selectedUnits[ingredientId] || current?.preferredUnit
          );
          if (displayed.unit === unit) return;
          setSelectedUnits((selections) => ({
            ...selections,
            [ingredientId]: unit,
          }));
          setUnitPrompt({ ingredientId, name: ingredient.name, unit });
        }}
      />
      {unitPrompt ? (
        <RecipeDisplayUnitDialog
          prompt={unitPrompt}
          recipeName={recipe.name}
          action={`/admin/mobile/receitas/${recipe.id}`}
          onClose={() => setUnitPrompt(null)}
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-11 text-red-600 hover:text-red-700"
        onClick={() => setDeleting(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Excluir template
      </Button>
      <DeleteRecipeTemplateDialog
        template={deleting ? { id: template.id, name: template.name } : null}
        recipeName={recipe.name}
        action={listPath}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate(`${listPath}${search}`)}
      />
    </div>
  );
}
