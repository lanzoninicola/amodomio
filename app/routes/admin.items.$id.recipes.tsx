import { Link, useOutletContext } from "@remix-run/react";
import type { AdminItemOutletContext } from "./admin.items.$id";

function formatRecipeCreatedAt(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("pt-BR");
}

export default function AdminItemRecipesTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const recipes = item.Recipe || [];
  const ingredientUsage = item._ingredientRecipeUsage || [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Receitas vinculadas</h2>
            <p className="text-sm text-slate-600">{recipes.length} receita(s)</p>
          </div>
          <Link to="/admin/recipes" className="text-sm underline">
            Abrir módulo de receitas
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {recipes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma receita vinculada a este item.</p>
          ) : (
            recipes.map((recipe: any) => {
              const createdAtLabel = formatRecipeCreatedAt(recipe.createdAt);

              return (
                <div key={recipe.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{recipe.name}</div>
                      {createdAtLabel ? <div className="text-xs text-slate-500">Criada em {createdAtLabel}</div> : null}
                    </div>
                    <Link to={`/admin/recipes/${recipe.id}`} className="text-xs underline">
                      Abrir
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 w-full">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Uso como ingrediente</h2>
            <p className="text-sm text-slate-600">{ingredientUsage.length} receita(s)</p>
          </div>

          <div className="mt-4 space-y-2">
            {ingredientUsage.length === 0 ? (
              <p className="text-sm text-slate-500">Este item não está sendo usado como ingrediente em receitas.</p>
            ) : (
              ingredientUsage.map((usage: any) => {
                const recipe = usage.Recipe;
                const createdAtLabel = formatRecipeCreatedAt(recipe?.createdAt);

                return (
                  <div key={usage.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">{recipe?.name || "Receita"}</div>
                        <div className="text-xs text-slate-500">
                          Item usado como ingrediente
                          {createdAtLabel ? ` · Criada em ${createdAtLabel}` : ""}
                        </div>
                      </div>
                      {recipe?.id ? (
                        <Link to={`/admin/recipes/${recipe.id}`} className="text-xs underline">
                          Abrir
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
