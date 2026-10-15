import { RecipeFontSizeControls } from "~/domain/recipe/components/recipe-font-size-controls";
import { RecipePendingIngredientsAlert } from "~/domain/recipe/components/recipe-pending-ingredients-alert";
import { json, redirect } from "@remix-run/node";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import {
  BookOpen,
  Calculator,
  ChevronLeft,
  Clock3,
  FilePlus2,
  Files,
  Info,
  Thermometer,
  X,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { authenticator } from "~/domain/auth/google.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import { saveRecipeDisplayUnit } from "~/domain/recipe/recipe-templates.server";
import {
  readRecipeTemplateConfiguration,
  getRecipeTemplateSearch,
} from "~/domain/recipe/recipe-template-navigation";
import { Button } from "~/components/ui/button";
import { RecipeDisplayUnitDialog } from "~/domain/recipe/components/recipe-display-unit-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  calculateRecipeScaleFromIngredient,
  calculateRecipeScaleFromYield,
  scaleRecipeQuantity,
} from "~/domain/recipe/recipe-scaling";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data?.payload?.recipe?.name
      ? `${data.payload.recipe.name} | Receitas`
      : "Receita | Admin Mobile",
  },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const recipe = await getMobileRecipe(String(params.recipeId || ""));
  let configuration;
  try {
    configuration = readRecipeTemplateConfiguration(
      new URL(request.url).searchParams
    );
  } catch {
    configuration = { scaleFactor: 1, selectedUnits: {} };
  }
  return json({ payload: { recipe, configuration } });
}

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

function formatQuantity(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatIngredientQuantity(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function IngredientReadRow({
  ingredient,
  scaleFactor,
  onScaleFromIngredient,
  displayUnit,
  onDisplayUnitChange,
  isAdded,
  onToggleAdded,
  fontScale,
}: {
  fontScale: number;
  ingredient: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    notes: string | null;
    subRecipe: { id: string; name: string } | null;
    displayUnits: Array<{ unit: string; factor: number }>;
  };
  scaleFactor: number;
  onScaleFromIngredient?: (scaleFactor: number) => void;
  displayUnit: string;
  onDisplayUnitChange: (unit: string) => void;
  isAdded: boolean;
  onToggleAdded: () => void;
}) {
  const listFont = (size: number) => ({
    fontSize: `${(size * fontScale) / 100}rem`,
  });
  const sourceUnit = String(ingredient.unit || "UN").toUpperCase();
  const [notesOpen, setNotesOpen] = useState(false);
  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [availableQuantityInput, setAvailableQuantityInput] = useState("");
  const availableQuantityRef = useRef<HTMLInputElement>(null);
  const [availableUnit, setAvailableUnit] = useState(sourceUnit);
  const selectedDisplayUnit = ingredient.displayUnits.find(
    (entry) => entry.unit === displayUnit
  ) ||
    ingredient.displayUnits[0] || { unit: sourceUnit, factor: 1 };
  const baseDisplayQuantity =
    Number(ingredient.quantity) * selectedDisplayUnit.factor;
  const displayQuantity = scaleRecipeQuantity(baseDisplayQuantity, scaleFactor);

  function openRecalculateDialog() {
    setAvailableUnit(displayUnit);
    setAvailableQuantityInput(
      String(Number(displayQuantity.toFixed(3))).replace(".", ",")
    );
    setRecalculateOpen(true);
  }

  function changeAvailableUnit(nextUnit: string) {
    const currentUnitConfig =
      ingredient.displayUnits.find((entry) => entry.unit === availableUnit) ||
      selectedDisplayUnit;
    const nextUnitConfig = ingredient.displayUnits.find(
      (entry) => entry.unit === nextUnit
    );
    if (!nextUnitConfig) return;

    const currentValue = Number(
      availableQuantityInput.trim().replace(",", ".")
    );
    if (Number.isFinite(currentValue)) {
      const convertedValue =
        (currentValue / currentUnitConfig.factor) * nextUnitConfig.factor;
      setAvailableQuantityInput(
        String(Number(convertedValue.toFixed(3))).replace(".", ",")
      );
    }
    setAvailableUnit(nextUnit);
  }

  function applyAvailableQuantity() {
    const availableQuantity = Number(
      availableQuantityInput.trim().replace(",", ".")
    );
    const availableUnitConfig =
      ingredient.displayUnits.find((entry) => entry.unit === availableUnit) ||
      selectedDisplayUnit;
    const baseQuantityInAvailableUnit =
      Number(ingredient.quantity) * availableUnitConfig.factor;
    const nextScale = calculateRecipeScaleFromIngredient({
      baseQuantity: baseQuantityInAvailableUnit,
      availableQuantity,
    });
    if (!nextScale || !onScaleFromIngredient) return;
    onScaleFromIngredient(nextScale);
    onDisplayUnitChange(availableUnit);
    setRecalculateOpen(false);
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 transition-opacity ${
        isAdded ? "opacity-[0.45]" : "opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-1">
          <button
            type="button"
            onClick={onToggleAdded}
            style={listFont(1)}
            aria-pressed={isAdded}
            aria-label={`${isAdded ? "Desmarcar" : "Marcar"} ${
              ingredient.name
            } como adicionado`}
            className="min-h-10 min-w-0 py-0.5 text-left font-semibold leading-snug text-slate-900"
          >
            {ingredient.name}
          </button>
          {ingredient.notes ? (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              aria-label={`Ler observação de ${ingredient.name}`}
              className="inline-flex h-10 w-10 shrink-0 items-start justify-center rounded-lg pt-0.5 text-violet-700 active:bg-violet-50"
            >
              <Info className="h-4 w-4" />
            </button>
          ) : null}
          {ingredient.subRecipe ? (
            <Link
              to={`/admin/mobile/receitas/${ingredient.subRecipe.id}`}
              aria-label={`Ler sub-receita ${ingredient.subRecipe.name}`}
              title={`Ler sub-receita: ${ingredient.subRecipe.name}`}
              className="inline-flex h-10 w-10 shrink-0 items-start justify-center rounded-lg pt-0.5 text-emerald-700 active:bg-emerald-50"
            >
              <BookOpen className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
        {onScaleFromIngredient ? (
          <button
            type="button"
            onClick={openRecalculateDialog}
            aria-label={`Recalcular receita pela quantidade de ${ingredient.name}`}
            style={listFont(1.125)}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-1 text-right text-lg font-semibold text-violet-700 active:bg-violet-50"
          >
            {formatIngredientQuantity(displayQuantity)}
            <Calculator className="h-4 w-4" />
          </button>
        ) : (
          <p
            style={listFont(1.125)}
            className="shrink-0 text-right text-lg font-semibold text-violet-700"
          >
            {formatIngredientQuantity(displayQuantity)}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-500">Unidade</span>
        {ingredient.displayUnits.length > 1 ? (
          <div
            className="inline-flex rounded-lg bg-slate-100 p-1"
            aria-label={`Unidade de leitura de ${ingredient.name}`}
          >
            {ingredient.displayUnits.map(({ unit }) => (
              <button
                key={unit}
                type="button"
                onClick={() => onDisplayUnitChange(unit)}
                aria-pressed={displayUnit === unit}
                style={listFont(0.875)}
                className={`h-[48px] min-h-[48px] min-w-14 rounded-md px-4 text-sm font-bold transition-colors ${
                  displayUnit === unit
                    ? "bg-white text-violet-700 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        ) : (
          <span
            style={listFont(0.875)}
            className="inline-flex h-[48px] min-h-[48px] min-w-14 items-center justify-center rounded-md bg-slate-100 px-4 text-sm font-bold text-slate-700"
          >
            {sourceUnit}
          </span>
        )}
      </div>

      {ingredient.notes ? (
        <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle>{ingredient.name}</DialogTitle>
              <DialogDescription>Observação do ingrediente</DialogDescription>
            </DialogHeader>
            <div className="whitespace-pre-wrap text-base leading-7 text-slate-700">
              {ingredient.notes}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {onScaleFromIngredient ? (
        <Dialog open={recalculateOpen} onOpenChange={setRecalculateOpen}>
          <DialogContent className="!top-[max(env(safe-area-inset-top),1rem)] !translate-y-0 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Quantidade disponível</DialogTitle>
              <DialogDescription>
                Use {ingredient.name} como referência para recalcular o
                rendimento e toda a composição.
              </DialogDescription>
            </DialogHeader>
            {ingredient.displayUnits.length > 1 ? (
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Unidade disponível
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ingredient.displayUnits.map(({ unit }) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => changeAvailableUnit(unit)}
                      aria-pressed={availableUnit === unit}
                      className={`h-[48px] min-h-[48px] rounded-lg border px-4 text-sm font-semibold ${
                        availableUnit === unit
                          ? "border-violet-600 bg-violet-50 text-violet-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="min-w-0">
              <label
                htmlFor={`available-quantity-${ingredient.id}`}
                className="text-sm font-medium text-slate-700"
              >
                Quanto você tem em {availableUnit}?
              </label>
              <div className="mt-2 flex w-full min-w-0 items-center overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-violet-200">
                <input
                  id={`available-quantity-${ingredient.id}`}
                  ref={availableQuantityRef}
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={availableQuantityInput}
                  onChange={(event) =>
                    setAvailableQuantityInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyAvailableQuantity();
                  }}
                  className="h-12 w-0 min-w-0 flex-1 rounded-l-lg bg-transparent px-4 text-lg font-semibold text-slate-950 outline-none"
                />
                {availableQuantityInput !== "" ? (
                  <button
                    type="button"
                    aria-label="Limpar quantidade disponível"
                    title="Limpar quantidade"
                    onClick={() => {
                      setAvailableQuantityInput("");
                      availableQuantityRef.current?.focus();
                    }}
                    className="inline-flex h-12 w-11 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
                <span className="shrink-0 px-3 text-sm font-bold text-slate-600">
                  {availableUnit}
                </span>
              </div>
              <span className="mt-2 block text-xs text-slate-500">
                Previsto na receita-base:{" "}
                {formatIngredientQuantity(
                  Number(ingredient.quantity) *
                    (ingredient.displayUnits.find(
                      (entry) => entry.unit === availableUnit
                    )?.factor || 1)
                )}{" "}
                {availableUnit}
              </span>
            </div>
            <DialogFooter className="block w-full sm:space-x-0">
              <button
                type="button"
                onClick={applyAvailableQuantity}
                className="inline-flex h-[56px] min-h-[56px] w-full max-w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-base font-semibold text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                Recalcular receita
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

type ThermalPhase = {
  upperTemperatureCelsius: number | null;
  lowerTemperatureCelsius: number | null;
  durationMinutes: number | null;
  notes: string | null;
} | null;

function ThermalPhaseContent({
  phase,
  emptyText,
}: {
  phase: ThermalPhase;
  emptyText: string;
}) {
  if (!phase) return <EmptyContent>{emptyText}</EmptyContent>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <ThermalValue
          icon={Thermometer}
          label="Superior"
          value={
            phase.upperTemperatureCelsius == null
              ? "—"
              : `${phase.upperTemperatureCelsius} °C`
          }
        />
        <ThermalValue
          icon={Thermometer}
          label="Inferior"
          value={
            phase.lowerTemperatureCelsius == null
              ? "—"
              : `${phase.lowerTemperatureCelsius} °C`
          }
        />
        <ThermalValue
          icon={Clock3}
          label="Tempo"
          value={
            phase.durationMinutes == null ? "—" : `${phase.durationMinutes} min`
          }
          wide
        />
      </div>
      {phase.notes ? <TextContent>{phase.notes}</TextContent> : null}
    </div>
  );
}

function ThermalValue({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function TextContent({ children }: { children: string }) {
  return (
    <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-base leading-7 text-slate-800">
      {children}
    </div>
  );
}

function EmptyContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export default function AdminMobileRecipeDetail() {
  const data = useLoaderData<typeof loader>();
  return <RecipeDetail key={data.payload.recipe.id} />;
}

export function RecipeDetail({
  recipeOverride,
  configurationOverride,
  template,
}: {
  recipeOverride?: Awaited<ReturnType<typeof getMobileRecipe>>;
  configurationOverride?: {
    scaleFactor: number;
    selectedUnits: Record<string, string>;
  };
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
} = {}) {
  const data = useLoaderData<typeof loader>();
  const recipe = recipeOverride || data.payload.recipe;
  const configuration = configurationOverride || data.payload.configuration;
  const [fontScale, setFontScale] = useState(100);
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
  const remainingIngredients = recipe.ingredients.filter(
    (ingredient) => !addedIds.includes(ingredient.id)
  ).length;
  const baseYield =
    recipe.costingMode === "yield" && Number(recipe.yieldQuantity) > 0
      ? Number(recipe.yieldQuantity)
      : null;
  const yieldUnit = String(recipe.yieldUnit || "").toUpperCase();
  const [desiredYieldInput, setDesiredYieldInput] = useState(
    baseYield == null
      ? ""
      : String(baseYield * configuration.scaleFactor).replace(".", ",")
  );
  const [ingredientScaleFactor, setIngredientScaleFactor] = useState(
    configuration.scaleFactor
  );
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>(
    configuration.selectedUnits
  );
  const navigate = useNavigate();
  const [unitPrompt, setUnitPrompt] = useState<{
    ingredientId: string;
    name: string;
    unit: string;
  } | null>(null);

  const desiredYield = Number(desiredYieldInput.replace(",", "."));
  const yieldScaleFactor = baseYield
    ? calculateRecipeScaleFromYield({
        baseYield,
        desiredYield,
      })
    : ingredientScaleFactor;
  const canCreateTemplate =
    recipe.ingredients.length > 0 &&
    Number.isFinite(yieldScaleFactor) &&
    yieldScaleFactor > 0 &&
    (!baseYield || (Number.isFinite(desiredYield) && desiredYield > 0));

  function applyIngredientScale(scaleFactor: number) {
    if (!baseYield) {
      setIngredientScaleFactor(scaleFactor);
      return;
    }
    const nextYield = scaleRecipeQuantity(baseYield, scaleFactor);
    setDesiredYieldInput(
      String(Number(nextYield.toFixed(3))).replace(".", ",")
    );
  }

  return (
    <div className="pb-6">
      <RecipePendingIngredientsAlert remaining={remainingIngredients} />
      <Link
        to={template?.backUrl || "/admin/mobile/receitas"}
        className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-slate-600"
      >
        <ChevronLeft className="h-4 w-4" />{" "}
        {template ? "Voltar aos templates" : "Todas as receitas"}
      </Link>
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 break-words text-2xl font-semibold leading-tight text-slate-950">
            {recipe.name}
          </h2>
          {template ? (
            <Button
              type="button"
              variant="ghost"
              onClick={template.onDelete}
              aria-label="Excluir template"
              className="min-h-11 gap-2 text-red-600"
            >
              <Trash2 className="h-5 w-5" />
              Excluir template
            </Button>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-11 flex-col gap-1 px-2 py-1.5"
                aria-label="Criar template"
                disabled={!canCreateTemplate}
                onClick={() =>
                  navigate(
                    `/admin/mobile/receitas/${
                      recipe.id
                    }/templates/novo${getRecipeTemplateSearch({
                      scaleFactor: yieldScaleFactor,
                      selectedUnits,
                    })}`
                  )
                }
              >
                <FilePlus2 className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">
                  Criar template
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-11 flex-col gap-1 px-2 py-1.5"
                aria-label="Ver templates"
                onClick={() =>
                  navigate(
                    `/admin/mobile/receitas/${
                      recipe.id
                    }/templates${getRecipeTemplateSearch({
                      scaleFactor: yieldScaleFactor,
                      selectedUnits,
                    })}`
                  )
                }
              >
                <Files className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">
                  Templates
                </span>
              </Button>
            </div>
          )}
        </div>
        <div className="mt-3">
          <RecipeFontSizeControls value={fontScale} onChange={setFontScale} />
        </div>
        {template ? (
          <p className="mt-2 text-sm text-slate-500">
            {template.recipeName}
            {recipe.description ? ` · ${recipe.description}` : ""}
          </p>
        ) : null}
        {baseYield ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <label
                htmlFor="desired-recipe-yield"
                className="block text-sm font-semibold text-violet-950"
              >
                {template ? "Rendimento salvo" : "Rendimento desejado"}
              </label>
              <p className="mt-0.5 text-xs text-violet-700">
                Receita-base: {formatQuantity(baseYield)} {yieldUnit}
              </p>
            </div>
            <div className="flex items-center rounded-lg border border-violet-200 bg-white focus-within:ring-2 focus-within:ring-violet-200">
              <input
                id="desired-recipe-yield"
                readOnly={Boolean(template)}
                type="text"
                inputMode="decimal"
                value={desiredYieldInput}
                onChange={(event) => setDesiredYieldInput(event.target.value)}
                className="h-11 w-20 rounded-l-lg bg-transparent px-3 text-right text-lg font-bold text-violet-900 outline-none"
              />
              <span className="pr-3 text-xs font-bold text-violet-700">
                {yieldUnit}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {unitPrompt ? (
        <RecipeDisplayUnitDialog
          prompt={unitPrompt}
          recipeName={template?.recipeName || recipe.name}
          action={`/admin/mobile/receitas/${recipe.id}`}
          onClose={() => setUnitPrompt(null)}
        />
      ) : null}

      {template && addedIds.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="mb-3"
          onClick={template.checklist.reset}
        >
          Reiniciar marcações ({addedIds.length}/{recipe.ingredients.length})
        </Button>
      ) : null}
      <Tabs defaultValue="ingredients" className="w-full">
        <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-11 min-w-max justify-start rounded-xl bg-slate-200 p-1">
            <TabsTrigger value="ingredients" className="min-h-9 px-4">
              Ingredientes
            </TabsTrigger>
            <TabsTrigger value="procedure" className="min-h-9 px-4">
              Modo de preparo
            </TabsTrigger>
            <TabsTrigger value="preheating" className="min-h-9 px-4">
              Pré-aquecimento
            </TabsTrigger>
            <TabsTrigger value="baking" className="min-h-9 px-4">
              Aquecimento
            </TabsTrigger>
            <TabsTrigger value="notes" className="min-h-9 px-4">
              Observações
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ingredients" className="mt-3 space-y-2">
          {recipe.ingredients.length ? (
            recipe.ingredients.map((ingredient) => (
              <IngredientReadRow
                key={ingredient.id}
                ingredient={ingredient}
                fontScale={fontScale}
                isAdded={addedIds.includes(ingredient.id)}
                onToggleAdded={() => toggleAdded(ingredient.id)}
                scaleFactor={yieldScaleFactor}
                onScaleFromIngredient={
                  template ? undefined : applyIngredientScale
                }
                displayUnit={
                  selectedUnits[ingredient.id] ||
                  ingredient.preferredUnit ||
                  ingredient.unit
                }
                onDisplayUnitChange={(unit) => {
                  if (
                    unit ===
                    (selectedUnits[ingredient.id] ||
                      ingredient.preferredUnit ||
                      ingredient.unit)
                  )
                    return;
                  setSelectedUnits((current) => ({
                    ...current,
                    [ingredient.id]: unit,
                  }));
                  setUnitPrompt({
                    ingredientId: ingredient.id,
                    name: ingredient.name,
                    unit,
                  });
                }}
              />
            ))
          ) : (
            <EmptyContent>Sem ingredientes cadastrados.</EmptyContent>
          )}
        </TabsContent>
        <TabsContent value="procedure" className="mt-3">
          {recipe.productionProcedure ? (
            <TextContent>{recipe.productionProcedure}</TextContent>
          ) : (
            <EmptyContent>Modo de preparo ainda não cadastrado.</EmptyContent>
          )}
        </TabsContent>
        <TabsContent value="preheating" className="mt-3">
          <ThermalPhaseContent
            phase={recipe.preheating}
            emptyText="Pré-aquecimento ainda não cadastrado."
          />
        </TabsContent>
        <TabsContent value="baking" className="mt-3">
          <ThermalPhaseContent
            phase={recipe.baking}
            emptyText="Aquecimento ainda não cadastrado."
          />
        </TabsContent>
        <TabsContent value="notes" className="mt-3">
          {recipe.productionNotes ? (
            <TextContent>{recipe.productionNotes}</TextContent>
          ) : (
            <EmptyContent>Sem observações cadastradas.</EmptyContent>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
