import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Maximize, Minimize } from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import {
  calculateRecipeScaleFromYield,
  scaleRecipeQuantity,
} from "~/domain/recipe/recipe-scaling";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  // A tela inteira depende desta receita para renderizar.
  return json(
    { recipe: await getMobileRecipe(String(params.recipeId || "")) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.recipe.name || "Receita"} | TV` },
  { name: "robots", content: "noindex" },
];

const quantity = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export default function RecipeTvRoute() {
  const { recipe } = useLoaderData<typeof loader>();
  return <RecipeTv key={recipe.id} recipe={recipe} />;
}

function RecipeTv({
  recipe,
}: {
  recipe: Awaited<ReturnType<typeof getMobileRecipe>>;
}) {
  const baseYield =
    recipe.costingMode === "yield" && Number(recipe.yieldQuantity) > 0
      ? Number(recipe.yieldQuantity)
      : null;
  const [desiredYield, setDesiredYield] = useState(
    baseYield == null ? "" : String(baseYield).replace(".", ",")
  );
  const [units, setUnits] = useState<Record<string, string>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const parsedYield = Number(desiredYield.replace(",", "."));
  const validYield =
    !baseYield || (Number.isFinite(parsedYield) && parsedYield > 0);
  const scale =
    baseYield && validYield
      ? calculateRecipeScaleFromYield({ baseYield, desiredYield: parsedYield })
      : 1;

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError("");
    } catch {
      setFullscreenError(
        "Tela cheia indisponível neste navegador. Use F11 no computador."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden lg:p-8">
      <header className="mb-6 flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-slate-700 pb-6">
        <div className="min-w-0 flex-1">
          <Link
            to="/admin/mobile/receitas"
            className="mb-3 inline-flex items-center gap-2 text-base text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" /> Receitas
          </Link>
          <h1 className="break-words text-4xl font-bold leading-tight xl:text-5xl">
            {recipe.name}
          </h1>
          {recipe.description ? (
            <p className="mt-3 text-xl text-slate-300">{recipe.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {baseYield ? (
            <div>
              <label
                htmlFor="tv-yield"
                className="mb-2 block text-lg font-semibold"
              >
                Rendimento desejado ({recipe.yieldUnit})
              </label>
              <input
                id="tv-yield"
                inputMode="decimal"
                value={desiredYield}
                onChange={(event) => setDesiredYield(event.target.value)}
                aria-invalid={!validYield}
                className="h-14 w-44 rounded-lg border border-slate-500 bg-slate-900 px-4 text-3xl font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
              />
              <p className="mt-2 text-base text-slate-300">
                Base: {quantity(baseYield)} {recipe.yieldUnit}
              </p>
              {!validYield ? (
                <p role="alert" className="mt-2 text-base text-amber-300">
                  Informe um rendimento maior que zero.
                </p>
              ) : null}
            </div>
          ) : null}
          <Button
            variant="outline"
            onClick={toggleFullscreen}
            className="h-14 gap-2 border-slate-500 bg-slate-900 px-5 text-lg text-white hover:bg-slate-800 hover:text-white"
          >
            {fullscreen ? <Minimize /> : <Maximize />}
            {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          </Button>
          {fullscreenError ? (
            <p role="status" className="text-base text-amber-300">
              {fullscreenError}
            </p>
          ) : null}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section
          aria-labelledby="tv-ingredients"
          className="flex min-h-0 flex-col rounded-2xl border border-slate-700 bg-slate-900"
        >
          <h2
            id="tv-ingredients"
            className="shrink-0 border-b border-slate-700 px-6 py-4 text-2xl font-bold"
          >
            Ingredientes
          </h2>
          <div
            tabIndex={0}
            aria-label="Lista de ingredientes"
            className="min-h-0 overflow-y-auto px-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            {recipe.ingredients.length === 0 ? (
              <p className="py-6 text-xl text-slate-300">
                Sem ingredientes cadastrados.
              </p>
            ) : (
              recipe.ingredients.map((ingredient) => {
                const unit =
                  units[ingredient.id] ||
                  ingredient.preferredUnit ||
                  ingredient.unit;
                const conversion =
                  ingredient.displayUnits.find((entry) => entry.unit === unit)
                    ?.factor || 1;
                return (
                  <div
                    key={ingredient.id}
                    className="border-b border-slate-700 py-5 last:border-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-2xl font-semibold">
                          {ingredient.name}
                        </h3>
                        {ingredient.subRecipe ? (
                          <Link
                            className="mt-2 inline-block text-lg text-violet-300 underline"
                            to={`/admin/receitas-tv/${ingredient.subRecipe.id}`}
                          >
                            Ver sub-receita
                          </Link>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold tabular-nums text-violet-300">
                          {validYield
                            ? quantity(
                                scaleRecipeQuantity(
                                  Number(ingredient.quantity),
                                  scale
                                ) * conversion
                              )
                            : "—"}
                        </span>
                        {ingredient.displayUnits.length > 1 ? (
                          <Select
                            value={unit}
                            onValueChange={(value) =>
                              setUnits((current) => ({
                                ...current,
                                [ingredient.id]: value,
                              }))
                            }
                          >
                            <SelectTrigger
                              aria-label={`Unidade de ${ingredient.name}`}
                              className="h-12 w-24 border-slate-500 bg-slate-950 text-xl"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ingredient.displayUnits.map((entry) => (
                                <SelectItem key={entry.unit} value={entry.unit}>
                                  {entry.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xl font-semibold text-slate-300">
                            {unit}
                          </span>
                        )}
                      </div>
                    </div>
                    {ingredient.notes ? (
                      <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-slate-300">
                        {ingredient.notes}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
        <section
          tabIndex={0}
          aria-label="Modo de preparo e informações de produção"
          className="min-h-0 space-y-6 overflow-y-auto rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="mb-4 text-2xl font-bold">Modo de preparo</h2>
            <p className="whitespace-pre-wrap text-2xl leading-relaxed text-slate-200">
              {recipe.productionProcedure ||
                "Modo de preparo ainda não cadastrado."}
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {[
              { label: "Pré-aquecimento", phase: recipe.preheating },
              { label: "Aquecimento", phase: recipe.baking },
            ].map(({ label, phase }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-700 bg-slate-900 p-6"
              >
                <h2 className="mb-4 text-2xl font-bold">{label}</h2>
                {phase ? (
                  <>
                    <dl className="space-y-3 text-xl">
                      {[
                        [
                          "Superior",
                          phase.upperTemperatureCelsius == null
                            ? "—"
                            : `${phase.upperTemperatureCelsius} °C`,
                        ],
                        [
                          "Inferior",
                          phase.lowerTemperatureCelsius == null
                            ? "—"
                            : `${phase.lowerTemperatureCelsius} °C`,
                        ],
                        [
                          "Tempo",
                          phase.durationMinutes == null
                            ? "—"
                            : `${phase.durationMinutes} min`,
                        ],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3">
                          <dt className="text-slate-300">{label}</dt>
                          <dd className="font-bold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {phase.notes ? (
                      <p className="mt-4 whitespace-pre-wrap text-lg text-slate-300">
                        {phase.notes}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xl text-slate-300">
                    Ainda não cadastrado.
                  </p>
                )}
              </div>
            ))}
          </div>
          {recipe.productionNotes ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="mb-4 text-2xl font-bold">Observações</h2>
              <p className="whitespace-pre-wrap text-xl leading-relaxed text-slate-200">
                {recipe.productionNotes}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
