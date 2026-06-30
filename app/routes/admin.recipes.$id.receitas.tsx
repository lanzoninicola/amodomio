import { defer, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, useLoaderData } from "@remix-run/react";
import { ExternalLink } from "lucide-react";
import { Suspense } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { listParentRecipes, type RecipeLink } from "~/domain/recipe/recipe-links.server";
import { badRequest } from "~/utils/http-response.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const recipeId = params?.id;
  if (!recipeId) return badRequest({ message: "Receita inválida" });

  const db = prismaClient as any;
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { itemId: true },
  });

  return defer({
    recipes: listParentRecipes(db, String(recipe?.itemId || "") || null),
  });
}

function RecipeLinkRow({ recipe, showSeparator }: { recipe: RecipeLink; showSeparator: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${showSeparator ? "border-b border-slate-100" : ""}`}>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
            recipe.type === "pizzaTopping"
              ? "bg-orange-50 text-orange-700 ring-orange-200"
              : "bg-blue-50 text-blue-700 ring-blue-200"
          }`}
        >
          {recipe.type === "pizzaTopping" ? "Sabor Pizza" : "Produzido"}
        </span>
        <span className="text-sm font-medium text-slate-900">{recipe.name}</span>
      </div>
      <Link
        to={`/admin/recipes/${recipe.id}`}
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition"
      >
        Abrir
        <ExternalLink size={12} />
      </Link>
    </div>
  );
}

export default function AdminRecipeReceitasTab() {
  const { recipes } = useLoaderData<typeof loader>() as { recipes: Promise<RecipeLink[]> };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Usada em</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Receitas que usam esta receita como ingrediente.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-slate-400">Carregando...</p>}>
        <Await
          resolve={recipes}
          errorElement={<p className="text-sm text-red-500">Erro ao carregar.</p>}
        >
          {(list) =>
            list.length === 0 ? (
              <p className="text-sm text-slate-400">
                Esta receita não é usada como ingrediente em nenhuma outra receita.
              </p>
            ) : (
              <div>
                {list.map((r: RecipeLink, i: number) => (
                  <RecipeLinkRow
                    key={r.id}
                    recipe={r}
                    showSeparator={list.length > 1 && i < list.length - 1}
                  />
                ))}
              </div>
            )
          }
        </Await>
      </Suspense>
    </div>
  );
}
