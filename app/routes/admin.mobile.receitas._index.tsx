import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ChevronRight, Monitor, Search } from "lucide-react";
import { useMemo, useState } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Receitas" }];

export async function loader(_: LoaderFunctionArgs) {
  const recipes = await prismaClient.recipe.findMany({
    where: { status: "active" },
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

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getInitialLetter(name: string) {
  return normalize(name.trim()).charAt(0).toUpperCase();
}

export default function AdminMobileRecipesIndex() {
  const data = useLoaderData<typeof loader>();
  const recipes = data.payload.recipes;
  const [query, setQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const availableLetters = useMemo(
    () => new Set(recipes.map((recipe) => getInitialLetter(recipe.name))),
    [recipes]
  );
  const filteredRecipes = useMemo(() => {
    const term = normalize(query.trim());
    return recipes.filter(
      (recipe) =>
        (!selectedLetter || getInitialLetter(recipe.name) === selectedLetter) &&
        (!term ||
          normalize(
            [recipe.name, recipe.Item?.name, recipe.description]
              .filter(Boolean)
              .join(" ")
          ).includes(term))
    );
  }, [query, recipes, selectedLetter]);

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
        <div
          className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-md border bg-white px-3 py-2"
          role="group"
          aria-label="Filtrar receitas pela letra inicial"
        >
          <button
            type="button"
            onClick={() => setSelectedLetter(null)}
            aria-pressed={selectedLetter === null}
            className={cn(
              "rounded px-2 py-1 text-xs font-semibold",
              selectedLetter === null
                ? "bg-slate-900 text-white"
                : "hover:bg-slate-100"
            )}
          >
            Todos
          </button>
          {alphabet.map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={!availableLetters.has(letter)}
              aria-pressed={selectedLetter === letter}
              onClick={() =>
                setSelectedLetter((current) =>
                  current === letter ? null : letter
                )
              }
              className={cn(
                "rounded px-1.5 py-1 text-xs font-semibold disabled:text-muted-foreground/50",
                selectedLetter === letter
                  ? "bg-slate-900 text-white"
                  : "enabled:hover:bg-slate-100"
              )}
            >
              {letter}
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs font-medium text-slate-500">
        {filteredRecipes.length}{" "}
        {filteredRecipes.length === 1 ? "receita" : "receitas"}
      </p>

      <section className="space-y-2" aria-live="polite">
        {filteredRecipes.map((recipe) => (
          <div key={recipe.id} className="flex items-center gap-2">
            <Link
              to={`/admin/mobile/receitas/${recipe.id}`}
              className="flex min-h-16 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm active:bg-slate-50"
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
            <Link
              to={`/admin/receitas-tv/${recipe.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver ${recipe.name} na TV (nova aba)`}
              className="inline-flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50"
            >
              <Monitor className="h-5 w-5" />
              Ver na TV
            </Link>
          </div>
        ))}

        {filteredRecipes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-600">
            {query.trim()
              ? `Nenhuma receita encontrada para “${query}”${
                  selectedLetter ? ` com a letra ${selectedLetter}` : ""
                }.`
              : selectedLetter
              ? `Nenhuma receita encontrada com a letra ${selectedLetter}.`
              : "Nenhuma receita encontrada."}
          </div>
        ) : null}
      </section>
    </div>
  );
}
