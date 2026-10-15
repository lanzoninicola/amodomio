import {
  defer,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, Link, useLoaderData } from "@remix-run/react";
import { Suspense, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Monitor, Search } from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "Receitas | TV" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  return defer(
    {
      recipes: Promise.resolve(
        prismaClient.recipe.findMany({
          where: { status: "active" },
          select: {
            id: true,
            name: true,
            description: true,
            Item: {
              select: { name: true, Category: { select: { name: true } } },
            },
          },
          orderBy: [{ name: "asc" }],
        })
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

type RecipeSummary = {
  id: string;
  name: string;
  description: string | null;
  Item: { name: string; Category: { name: string } | null } | null;
};
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

export default function RecipeTvListRoute() {
  const { recipes } = useLoaderData<typeof loader>();
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 lg:p-10">
      <header className="mb-8 border-b border-slate-700 pb-6">
        <Link
          to="/admin/recipes"
          className="mb-5 inline-flex items-center gap-2 text-lg text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar à administração
        </Link>
        <h1 className="flex items-center gap-4 text-4xl font-bold xl:text-5xl">
          <Monitor className="h-10 w-10" />
          Receitas
        </h1>
      </header>
      <Suspense
        fallback={
          <p role="status" className="text-2xl text-slate-300">
            Carregando receitas…
          </p>
        }
      >
        <Await
          resolve={recipes}
          errorElement={
            <p
              role="alert"
              className="rounded-xl border border-red-800 bg-red-950 p-6 text-2xl"
            >
              Não foi possível carregar as receitas. Atualize a página para
              tentar novamente.
            </p>
          }
        >
          {(items) => <RecipeTvList recipes={items} />}
        </Await>
      </Suspense>
    </main>
  );
}

function RecipeTvList({ recipes }: { recipes: RecipeSummary[] }) {
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
            [
              recipe.name,
              recipe.Item?.name,
              recipe.Item?.Category?.name,
              recipe.description,
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(term))
    );
  }, [query, recipes, selectedLetter]);
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside
        aria-label="Pesquisar e filtrar receitas"
        className="space-y-5 lg:sticky lg:top-8"
      >
        <label
          htmlFor="tv-recipe-search"
          className="block text-2xl font-semibold"
        >
          Pesquisar receita
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400"
          />
          <input
            id="tv-recipe-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome da receita"
            autoComplete="off"
            className="min-h-16 w-full rounded-xl border border-slate-600 bg-slate-900 py-4 pl-12 pr-4 text-xl text-white placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
          />
        </div>
        <div
          role="group"
          aria-label="Filtrar receitas pela letra inicial"
          className="grid grid-cols-5 gap-3"
        >
          {[null, ...alphabet].map((letter) => (
            <button
              key={letter || "all"}
              type="button"
              disabled={letter !== null && !availableLetters.has(letter)}
              aria-pressed={selectedLetter === letter}
              onClick={() =>
                setSelectedLetter((current) =>
                  current === letter ? null : letter
                )
              }
              className={cn(
                "flex min-h-14 min-w-0 items-center justify-center rounded-lg border px-2 text-3xl font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-30",
                letter === null && "col-span-5 text-2xl",
                selectedLetter === letter
                  ? "border-violet-400 bg-violet-600 text-white"
                  : "border-slate-600 bg-slate-900 text-slate-200 enabled:hover:bg-slate-800"
              )}
            >
              {letter || "Todos"}
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        <p role="status" className="mb-5 text-lg text-slate-300">
          {filteredRecipes.length}{" "}
          {filteredRecipes.length === 1 ? "receita" : "receitas"}
        </p>
        <section
          aria-label="Lista de receitas"
          className="grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredRecipes.map((recipe) => (
            <Link
              key={recipe.id}
              to={`/admin/receitas-tv/${recipe.id}`}
              className="group flex h-full min-h-52 items-start gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 hover:border-violet-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
            >
              <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <h2 className="break-words pb-6 text-2xl font-bold leading-snug text-white xl:text-3xl">
                  {recipe.name}
                </h2>
                {recipe.Item ? (
                  <div className="mt-auto space-y-3 border-t border-slate-700 pt-4">
                    <p className="break-words text-xl font-medium leading-relaxed text-slate-300">
                      {recipe.Item.name}
                    </p>
                    {recipe.Item.Category ? (
                      <p className="w-fit max-w-full break-words rounded-md bg-slate-800 px-3 py-1.5 text-base font-medium leading-relaxed text-slate-400">
                        {recipe.Item.Category.name}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <ChevronRight
                aria-hidden="true"
                className="mt-1 h-6 w-6 shrink-0 text-slate-500 group-hover:text-violet-300"
              />
            </Link>
          ))}
          {!filteredRecipes.length ? (
            <p className="col-span-full rounded-2xl border border-dashed border-slate-600 p-10 text-center text-2xl text-slate-300">
              Nenhuma receita encontrada. Tente outro nome ou letra.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
