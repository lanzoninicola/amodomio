import { Link, useOutletContext } from "@remix-run/react";
import type { AdminItemOutletContext } from "./admin.items.$id";

export default function AdminItemRecipesTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const recipes = item.Recipe || [];

  return (
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
          recipes.map((recipe: any) => (
            <div key={recipe.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-slate-900">{recipe.name}</div>
                <Link to={`/admin/recipes/${recipe.id}`} className="text-xs underline">
                  Abrir
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

