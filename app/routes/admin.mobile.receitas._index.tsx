import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Receitas" }];

export async function loader(_: LoaderFunctionArgs) {
  const recipes = await prismaClient.recipe.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      Item: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  return ok({ recipes });
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export default function AdminMobileRecipesIndex() {
  const data = useLoaderData<typeof loader>();
  const recipes = data.payload.recipes;
  const [query, setQuery] = useState("");
  const filteredRecipes = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return recipes;
    return recipes.filter((recipe) =>
      normalize(
        [recipe.name, recipe.Item?.name, recipe.description]
          .filter(Boolean)
          .join(" ")
      ).includes(term)
    );
  }, [query, recipes]);

  return (
    <div className="space-y-4 pb-6">
      <section>
        <label
          htmlFor="recipe-search"
          className="text-lg font-semibold text-slate-900"
        >
          Pesquisar receita
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="recipe-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite o nome da receita"
            autoComplete="off"
            className="min-h-14 w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </section>

      <p className="text-xs font-medium text-slate-500">
        {filteredRecipes.length}{" "}
        {filteredRecipes.length === 1 ? "receita" : "receitas"}
      </p>

      <section className="space-y-2" aria-live="polite">
        {filteredRecipes.map((recipe) => (
          <Link
            key={recipe.id}
            to={`/admin/mobile/receitas/${recipe.id}`}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm active:bg-slate-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-tight text-slate-950">
                {recipe.name}
              </span>
              {recipe.Item?.name && recipe.Item.name !== recipe.name ? (
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {recipe.Item.name}
                </span>
              ) : null}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </Link>
        ))}

        {filteredRecipes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            Nenhuma receita encontrada para “{query}”.
          </div>
        ) : null}
      </section>
    </div>
  );
}
