import { RecipeFontSizeControls } from "~/domain/recipe/components/recipe-font-size-controls";
import { RecipePendingIngredientsAlert } from "~/domain/recipe/components/recipe-pending-ingredients-alert";
import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Calculator,
  FilePlus2,
  Files,
  Settings2,
  Trash2,
} from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import {
  calculateRecipeScaleFromIngredient,
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

import { saveRecipeDisplayUnit } from "~/domain/recipe/recipe-templates.server";
import {
  RecipeDisplayUnitDialog,
  type DisplayUnitPrompt,
} from "~/domain/recipe/components/recipe-display-unit-dialog";
import {
  readRecipeTemplateConfiguration,
  getRecipeTemplateSearch,
  type RecipeTemplateConfiguration,
} from "~/domain/recipe/recipe-template-navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

export async function action({ request, params }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const recipeId = String(params.recipeId || "");
  if (!recipeId) return json({ error: "Receita inválida." }, { status: 400 });
  const form = await request.formData();
  if (form.get("intent") !== "save-display-unit")
    return json({ error: "Ação inválida." }, { status: 400 });
  return saveRecipeDisplayUnit(recipeId, form);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  let configuration: RecipeTemplateConfiguration;
  try {
    configuration = readRecipeTemplateConfiguration(
      new URL(request.url).searchParams
    );
  } catch {
    configuration = { scaleFactor: 1, selectedUnits: {} };
  }
  // A tela inteira depende desta receita para renderizar.
  return json(
    {
      recipe: await getMobileRecipe(String(params.recipeId || "")),
      configuration,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.recipe.name || "Receita"} | TV` },
  { name: "robots", content: "noindex" },
];

import { formatRecipeTvNumber } from "~/domain/recipe/recipe-tv-format";

export default function RecipeTvRoute() {
  const { recipe, configuration } = useLoaderData<typeof loader>();
  return (
    <RecipeTv key={recipe.id} recipe={recipe} configuration={configuration} />
  );
}

export function RecipeTv({
  recipe,
  configuration,
  template,
}: {
  template?: {
    recipeName: string;
    backUrl: string;
    onDelete: () => void;
    checklist: {
      addedIds: string[];
      toggle: (id: string) => void;
      reset: () => void;
    };
  };
  configuration: RecipeTemplateConfiguration;
  recipe: Awaited<ReturnType<typeof getMobileRecipe>>;
}) {
  const baseYield =
    recipe.costingMode === "yield" && Number(recipe.yieldQuantity) > 0
      ? Number(recipe.yieldQuantity)
      : null;
  const [desiredYield, setDesiredYield] = useState(
    baseYield == null
      ? ""
      : String(baseYield * configuration.scaleFactor).replace(".", ",")
  );
  const [units, setUnits] = useState<Record<string, string>>(
    configuration.selectedUnits
  );
  const navigate = useNavigate();
  const [ingredientScale, setIngredientScale] = useState(
    configuration.scaleFactor
  );
  const [fontScale, setFontScale] = useState(100);
  const listFont = (size: number) => ({
    fontSize: `${(size * fontScale) / 100}rem`,
  });
  const [showPreparation, setShowPreparation] = useState(false);
  const [showDecimals, setShowDecimals] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const quantity = (value: number) => formatRecipeTvNumber(value, showDecimals);
  const [localAddedIds, setLocalAddedIds] = useState<string[]>([]);
  const addedIds = template?.checklist.addedIds || localAddedIds;
  function toggleAdded(id: string) {
    if (template) template.checklist.toggle(id);
    else
      setLocalAddedIds((current) =>
        current.includes(id)
          ? current.filter((entry) => entry !== id)
          : [...current, id]
      );
  }
  function resetAdded() {
    if (template) template.checklist.reset();
    else setLocalAddedIds([]);
  }
  const remainingIngredients = recipe.ingredients.filter(
    (ingredient) => !addedIds.includes(ingredient.id)
  ).length;
  const [unitPrompt, setUnitPrompt] = useState<DisplayUnitPrompt | null>(null);
  const [recalculation, setRecalculation] = useState<{
    ingredientId: string;
    unit: string;
    value: string;
  } | null>(null);
  const [recalculationError, setRecalculationError] = useState("");
  function changeUnit(ingredientId: string, name: string, unit: string) {
    const ingredient = recipe.ingredients.find(
      (entry) => entry.id === ingredientId
    );
    if (
      unit ===
      (units[ingredientId] || ingredient?.preferredUnit || ingredient?.unit)
    )
      return;
    setUnits((current) => ({ ...current, [ingredientId]: unit }));
    setUnitPrompt({ ingredientId, name, unit });
  }
  function applyRecalculation() {
    const ingredient = recipe.ingredients.find(
      (entry) => entry.id === recalculation?.ingredientId
    );
    if (!ingredient || !recalculation) return;
    const factor =
      ingredient.displayUnits.find((entry) => entry.unit === recalculation.unit)
        ?.factor || 1;
    const nextScale = calculateRecipeScaleFromIngredient({
      baseQuantity: Number(ingredient.quantity) * factor,
      availableQuantity: Number(recalculation.value.trim().replace(",", ".")),
    });
    if (!nextScale) {
      setRecalculationError(
        "Informe uma quantidade maior que zero para um ingrediente com quantidade-base maior que zero."
      );
      return;
    }
    if (baseYield)
      setDesiredYield(
        String(
          Number(scaleRecipeQuantity(baseYield, nextScale).toFixed(3))
        ).replace(".", ",")
      );
    else setIngredientScale(nextScale);
    changeUnit(ingredient.id, ingredient.name, recalculation.unit);
    setRecalculation(null);
  }
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
      : ingredientScale;
  const canCreateTemplate =
    validYield &&
    recipe.ingredients.length > 0 &&
    Number.isFinite(scale) &&
    scale > 0;
  const templateSearch = getRecipeTemplateSearch({
    scaleFactor: scale,
    selectedUnits: units,
  });
  const recalculationIngredient = recipe.ingredients.find(
    (entry) => entry.id === recalculation?.ingredientId
  );

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
      <RecipePendingIngredientsAlert remaining={remainingIngredients} />
      <header className="mb-6 flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-slate-700 pb-6">
        <div className="min-w-0 flex-1">
          <Link
            to={template?.backUrl || "/admin/receitas-tv"}
            className="mb-3 inline-flex items-center gap-2 text-base text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />{" "}
            {template ? "Voltar aos templates" : "Receitas"}
          </Link>
          <h1 className="break-words text-4xl font-bold leading-tight xl:text-5xl">
            {recipe.name}
          </h1>
          {template ? (
            <p className="mt-3 text-xl text-slate-300">
              {template.recipeName}
              {baseYield ? (
                <>
                  {" "}
                  · Rendimento:{" "}
                  <span className="font-mono tabular-nums">
                    {quantity(baseYield)}
                  </span>{" "}
                  {recipe.yieldUnit}
                </>
              ) : null}
            </p>
          ) : null}
          {recipe.description ? (
            <p className="mt-3 text-xl text-slate-300">{recipe.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RecipeFontSizeControls
            value={fontScale}
            onChange={setFontScale}
            dark
          />
          {template ? (
            <Button
              variant="outline"
              onClick={template.onDelete}
              className="h-14 gap-2 border-red-600 bg-slate-900 text-lg text-red-300 hover:bg-red-950 hover:text-red-100"
            >
              <Trash2 className="h-5 w-5" />
              Excluir template
            </Button>
          ) : (
            <Button
              className="h-14 gap-2 text-lg"
              disabled={!canCreateTemplate}
              onClick={() =>
                navigate(
                  `/admin/receitas-tv/${recipe.id}/templates/novo${templateSearch}`
                )
              }
            >
              <FilePlus2 className="h-5 w-5" />
              Criar template
            </Button>
          )}
          <Button
            className="h-14 gap-2 text-lg"
            onClick={() =>
              navigate(
                template?.backUrl ||
                  `/admin/receitas-tv/${recipe.id}/templates${templateSearch}`
              )
            }
          >
            <Files className="h-5 w-5" />
            Templates
          </Button>
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
          <Button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="h-14 gap-2 px-5 text-lg"
          >
            <Settings2 className="h-5 w-5" />
            Opções
          </Button>
        </div>
      </header>
      <div
        className={`grid min-h-0 flex-1 gap-6 ${
          showPreparation
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
            : "mx-auto w-full max-w-5xl grid-cols-1"
        }`}
      >
        <section
          aria-labelledby="tv-ingredients"
          className="flex min-h-0 flex-col rounded-2xl border border-slate-700 bg-slate-900"
        >
          <h2
            id="tv-ingredients"
            className="shrink-0 border-b border-slate-700 px-6 py-4 text-2xl font-bold"
          >
            Ingredientes
            {addedIds.length > 0 ? (
              <button
                type="button"
                onClick={resetAdded}
                className="ml-4 text-base font-medium text-violet-300"
              >
                Reiniciar marcações ({addedIds.length}/
                {recipe.ingredients.length})
              </button>
            ) : null}
          </h2>
          <div
            tabIndex={0}
            aria-label="Lista de ingredientes"
            className="min-h-0 overflow-auto px-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            {recipe.ingredients.length === 0 ? (
              <p className="py-6 text-xl text-slate-300">
                Sem ingredientes cadastrados.
              </p>
            ) : (
              <table
                className="w-full min-w-[40rem] border-collapse text-left"
                aria-label="Composição da receita"
              >
                <thead
                  style={listFont(1)}
                  className="sticky top-0 z-10 bg-slate-900 text-base text-slate-400"
                >
                  <tr>
                    <th scope="col" className="py-3 font-medium">
                      Ingrediente
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-3 text-center font-medium"
                    >
                      UM
                    </th>
                    <th
                      scope="col"
                      className="py-3 pl-16 text-right font-medium"
                    >
                      Quantidade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.ingredients.map((ingredient) => {
                    const unit =
                      units[ingredient.id] ||
                      ingredient.preferredUnit ||
                      ingredient.unit;
                    const conversion =
                      ingredient.displayUnits.find(
                        (entry) => entry.unit === unit
                      )?.factor || 1;
                    return (
                      <tr
                        key={ingredient.id}
                        className={`border-b border-slate-700 last:border-0 ${
                          addedIds.includes(ingredient.id)
                            ? "opacity-[0.45]"
                            : ""
                        }`}
                      >
                        <td className="py-5 pr-6 align-middle">
                          <label
                            style={listFont(1.5)}
                            className="flex cursor-pointer items-start gap-3 text-2xl font-semibold"
                          >
                            <input
                              type="checkbox"
                              checked={addedIds.includes(ingredient.id)}
                              onChange={() => toggleAdded(ingredient.id)}
                              aria-label={`${ingredient.name}: ${
                                addedIds.includes(ingredient.id)
                                  ? "adicionado"
                                  : "pendente"
                              }`}
                              className="mt-1 h-6 w-6 shrink-0 accent-violet-500"
                            />
                            <span
                              className={`break-words ${
                                addedIds.includes(ingredient.id)
                                  ? "line-through"
                                  : ""
                              }`}
                            >
                              {ingredient.name}
                            </span>
                          </label>
                          {ingredient.subRecipe ? (
                            <Link
                              style={listFont(1.125)}
                              className="mt-2 inline-block text-lg text-violet-300 underline"
                              to={`/admin/receitas-tv/${ingredient.subRecipe.id}`}
                            >
                              Ver sub-receita
                            </Link>
                          ) : null}
                          {ingredient.notes ? (
                            <p
                              style={listFont(1.125)}
                              className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-slate-300"
                            >
                              {ingredient.notes}
                            </p>
                          ) : null}
                        </td>
                        <td className="w-24 px-2 py-5 align-middle">
                          <div className="flex justify-center">
                            {ingredient.displayUnits.length > 1 ? (
                              <Select
                                value={unit}
                                onValueChange={(value) =>
                                  changeUnit(
                                    ingredient.id,
                                    ingredient.name,
                                    value
                                  )
                                }
                              >
                                <SelectTrigger
                                  aria-label={`Unidade de ${ingredient.name}`}
                                  style={listFont(1.125)}
                                  className="h-10 w-20 border-violet-400 bg-violet-950 px-2 text-lg font-semibold text-white focus:ring-violet-400"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ingredient.displayUnits.map((entry) => (
                                    <SelectItem
                                      key={entry.unit}
                                      value={entry.unit}
                                      style={listFont(1.125)}
                                      className="py-2 text-lg font-semibold"
                                    >
                                      {entry.unit}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span
                                style={listFont(1.125)}
                                className="inline-flex h-10 w-20 items-center justify-center rounded-md border border-violet-400 bg-violet-950 px-2 text-lg font-semibold text-white"
                              >
                                {unit}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="w-px py-5 pl-16 text-right align-middle">
                          <button
                            type="button"
                            disabled={Boolean(template)}
                            aria-label={
                              template
                                ? `Quantidade de ${ingredient.name}`
                                : `Recalcular receita pela quantidade de ${ingredient.name}`
                            }
                            onClick={() => {
                              setRecalculationError("");
                              setRecalculation({
                                ingredientId: ingredient.id,
                                unit,
                                value: String(
                                  Number(
                                    (
                                      scaleRecipeQuantity(
                                        Number(ingredient.quantity),
                                        scale
                                      ) * conversion
                                    ).toFixed(3)
                                  )
                                ).replace(".", ","),
                              });
                            }}
                            style={listFont(3)}
                            className="inline-flex min-h-12 items-center justify-end whitespace-nowrap gap-2 font-mono text-5xl font-bold tabular-nums text-violet-300"
                          >
                            {!template ? (
                              <Calculator className="h-5 w-5" />
                            ) : null}
                            {validYield
                              ? quantity(
                                  scaleRecipeQuantity(
                                    Number(ingredient.quantity),
                                    scale
                                  ) * conversion
                                )
                              : "—"}
                          </button>{" "}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
        {showPreparation ? (
          <section
            id="tv-preparation"
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
                              : `${quantity(
                                  Number(phase.upperTemperatureCelsius)
                                )} °C`,
                          ],
                          [
                            "Inferior",
                            phase.lowerTemperatureCelsius == null
                              ? "—"
                              : `${quantity(
                                  Number(phase.lowerTemperatureCelsius)
                                )} °C`,
                          ],
                          [
                            "Tempo",
                            phase.durationMinutes == null
                              ? "—"
                              : `${quantity(
                                  Number(phase.durationMinutes)
                                )} min`,
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="flex justify-between gap-3"
                          >
                            <dt className="text-slate-300">{label}</dt>
                            <dd className="font-mono font-bold tabular-nums">
                              {value}
                            </dd>
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
        ) : null}
      </div>
      <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-700 bg-slate-950 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Opções da receita</DialogTitle>
            <DialogDescription className="text-slate-300">
              Ajuste a visualização e o rendimento da receita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {baseYield ? (
              <div>
                <label
                  htmlFor="tv-yield"
                  className="mb-2 block text-lg font-semibold"
                >
                  {template ? "Rendimento salvo" : "Rendimento desejado"} (
                  {recipe.yieldUnit})
                </label>
                <input
                  id="tv-yield"
                  readOnly={Boolean(template)}
                  inputMode="decimal"
                  value={desiredYield}
                  onChange={(event) => setDesiredYield(event.target.value)}
                  aria-invalid={!validYield}
                  className="h-14 w-44 rounded-lg border border-slate-500 bg-slate-900 px-4 font-mono text-3xl font-bold tabular-nums text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                />
                <p className="mt-2 text-base text-slate-300">
                  Base:{" "}
                  <span className="font-mono tabular-nums">
                    {quantity(baseYield)}
                  </span>{" "}
                  {recipe.yieldUnit}
                </p>
                {!validYield ? (
                  <p role="alert" className="mt-2 text-base text-amber-300">
                    Informe um rendimento maior que zero.
                  </p>
                ) : null}
              </div>
            ) : null}
            <label className="flex min-h-14 cursor-pointer items-center gap-3 text-lg">
              <input
                type="checkbox"
                checked={showDecimals}
                onChange={(event) => setShowDecimals(event.target.checked)}
                className="h-6 w-6 accent-violet-500"
              />{" "}
              Mostrar decimais (até 2 casas)
            </label>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 text-lg">
              <input
                type="checkbox"
                checked={showPreparation}
                onChange={(event) => setShowPreparation(event.target.checked)}
                aria-controls="tv-preparation"
                className="h-6 w-6 accent-violet-500"
              />{" "}
              Mostrar preparo
            </label>
          </div>
        </DialogContent>
      </Dialog>
      {unitPrompt ? (
        <RecipeDisplayUnitDialog
          prompt={unitPrompt}
          recipeName={template?.recipeName || recipe.name}
          action={`/admin/receitas-tv/${recipe.id}`}
          onClose={() => setUnitPrompt(null)}
        />
      ) : null}
      <Dialog
        open={Boolean(recalculation)}
        onOpenChange={(open) => {
          if (!open) setRecalculation(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Quantidade disponível
            </DialogTitle>
            <DialogDescription>
              Use {recalculationIngredient?.name} para recalcular o rendimento e
              todos os ingredientes.
            </DialogDescription>
          </DialogHeader>
          {recalculation && recalculationIngredient ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                applyRecalculation();
              }}
              className="space-y-5"
            >
              <label
                htmlFor="tv-available-unit"
                className="block text-lg font-semibold"
              >
                Unidade disponível
              </label>
              <Select
                value={recalculation.unit}
                onValueChange={(unit) => {
                  const oldFactor =
                    recalculationIngredient.displayUnits.find(
                      (entry) => entry.unit === recalculation.unit
                    )?.factor || 1;
                  const newFactor =
                    recalculationIngredient.displayUnits.find(
                      (entry) => entry.unit === unit
                    )?.factor || 1;
                  const currentValue = Number(
                    recalculation.value.replace(",", ".")
                  );
                  setRecalculation({
                    ...recalculation,
                    unit,
                    value:
                      recalculation.value.trim() &&
                      Number.isFinite(currentValue)
                        ? String(
                            Number(
                              ((currentValue / oldFactor) * newFactor).toFixed(
                                3
                              )
                            )
                          ).replace(".", ",")
                        : recalculation.value,
                  });
                }}
              >
                <SelectTrigger id="tv-available-unit" className="h-14 text-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recalculationIngredient.displayUnits.map((entry) => (
                    <SelectItem key={entry.unit} value={entry.unit}>
                      {entry.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label
                htmlFor="tv-available-quantity"
                className="block text-lg font-semibold"
              >
                Quanto você tem em {recalculation.unit}?
              </label>
              <input
                id="tv-available-quantity"
                autoFocus
                inputMode="decimal"
                value={recalculation.value}
                onChange={(event) =>
                  setRecalculation({
                    ...recalculation,
                    value: event.target.value,
                  })
                }
                className="h-14 w-full rounded-lg border border-slate-300 px-4 font-mono text-2xl tabular-nums text-slate-950"
              />
              <p className="text-slate-600">
                Receita-base:{" "}
                {quantity(
                  Number(recalculationIngredient.quantity) *
                    (recalculationIngredient.displayUnits.find(
                      (entry) => entry.unit === recalculation.unit
                    )?.factor || 1)
                )}{" "}
                {recalculation.unit}
              </p>
              {recalculationError ? (
                <p role="alert" className="text-red-600">
                  {recalculationError}
                </p>
              ) : null}
              <Button type="submit" className="h-14 w-full text-lg">
                Recalcular receita
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
