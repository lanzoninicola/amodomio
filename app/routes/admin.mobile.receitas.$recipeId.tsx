import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  BookOpen,
  Calculator,
  ChevronLeft,
  Clock3,
  Info,
  Thermometer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";
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

export async function loader({ params }: LoaderFunctionArgs) {
  const recipeId = String(params.recipeId || "").trim();
  if (!recipeId) throw new Response("Receita inválida", { status: 400 });

  const db = prismaClient as any;
  const [recipe, measurementUnits, measurementConversions] = await Promise.all([
    db.recipe.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        name: true,
        description: true,
        costingMode: true,
        yieldQuantity: true,
        yieldUnit: true,
        productionProcedure: true,
        productionNotes: true,
        RecipePreheating: {
          select: {
            upperTemperatureCelsius: true,
            lowerTemperatureCelsius: true,
            durationMinutes: true,
            notes: true,
          },
        },
        RecipeBaking: {
          select: {
            upperTemperatureCelsius: true,
            lowerTemperatureCelsius: true,
            durationMinutes: true,
            notes: true,
          },
        },
        ItemVariations: {
          where: { deletedAt: null },
          select: { id: true, isReference: true, createdAt: true },
          orderBy: [{ createdAt: "asc" }],
        },
        RecipeIngredient: {
          orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            notes: true,
            IngredientItem: {
              select: {
                name: true,
                consumptionUm: true,
                ItemUnit: { select: { unitCode: true } },
                Recipe: {
                  select: { id: true, name: true },
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                },
              },
            },
            RecipeVariationIngredient: {
              select: {
                itemVariationId: true,
                quantity: true,
                unit: true,
              },
            },
          },
        },
      },
    }),
    db.measurementUnit.findMany({
      where: { active: true },
      select: { code: true, scope: true },
    }),
    db.measurementUnitConversion.findMany({
      where: { active: true },
      select: {
        factor: true,
        FromUnit: { select: { code: true } },
        ToUnit: { select: { code: true } },
      },
    }),
  ]);

  if (!recipe) throw new Response("Receita não encontrada", { status: 404 });

  const referenceVariation =
    recipe.ItemVariations.find((variation) => variation.isReference) ||
    recipe.ItemVariations[0];
  const ingredients = recipe.RecipeIngredient.map((ingredient) => {
    const lines = ingredient.RecipeVariationIngredient;
    const line =
      lines.find((entry) => entry.itemVariationId === referenceVariation?.id) ||
      lines[0];
    const sourceUnit = String(line?.unit || "UN").toUpperCase();
    const linkedUnits = new Set(
      ingredient.IngredientItem.ItemUnit.map((entry) =>
        String(entry.unitCode || "").toUpperCase()
      )
    );
    const allowedUnits = new Set<string>([
      sourceUnit,
      String(ingredient.IngredientItem.consumptionUm || "").toUpperCase(),
      ...measurementUnits
        .filter(
          (unit) =>
            unit.scope === "global" ||
            linkedUnits.has(String(unit.code || "").toUpperCase())
        )
        .map((unit) => String(unit.code || "").toUpperCase()),
    ]);
    const displayUnits = [{ unit: sourceUnit, factor: 1 }];

    for (const conversion of measurementConversions) {
      const fromUnit = String(conversion.FromUnit?.code || "").toUpperCase();
      const toUnit = String(conversion.ToUnit?.code || "").toUpperCase();
      const factor = Number(conversion.factor);
      if (!(factor > 0)) continue;

      if (fromUnit === sourceUnit && allowedUnits.has(toUnit)) {
        displayUnits.push({ unit: toUnit, factor });
      } else if (toUnit === sourceUnit && allowedUnits.has(fromUnit)) {
        displayUnits.push({ unit: fromUnit, factor: 1 / factor });
      }
    }

    return {
      id: ingredient.id,
      name: ingredient.IngredientItem.name,
      quantity: line?.quantity ?? 0,
      unit: sourceUnit,
      notes: ingredient.notes,
      subRecipe: ingredient.IngredientItem.Recipe[0] || null,
      displayUnits: Array.from(
        new Map(displayUnits.map((entry) => [entry.unit, entry])).values()
      ),
    };
  });

  return ok({
    recipe: {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      costingMode: recipe.costingMode,
      yieldQuantity: recipe.yieldQuantity,
      yieldUnit: recipe.yieldUnit,
      productionProcedure: recipe.productionProcedure,
      productionNotes: recipe.productionNotes,
      preheating: recipe.RecipePreheating,
      baking: recipe.RecipeBaking,
      ingredients,
    },
  });
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
}: {
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
}) {
  const sourceUnit = String(ingredient.unit || "UN").toUpperCase();
  const [displayUnit, setDisplayUnit] = useState(sourceUnit);
  const [notesOpen, setNotesOpen] = useState(false);
  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [availableQuantityInput, setAvailableQuantityInput] = useState("");
  const [availableUnit, setAvailableUnit] = useState(sourceUnit);
  const [isAdded, setIsAdded] = useState(false);
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
    setDisplayUnit(availableUnit);
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
            onClick={() => setIsAdded((current) => !current)}
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
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-1 text-right text-lg font-semibold text-violet-700 active:bg-violet-50"
          >
            {formatIngredientQuantity(displayQuantity)}
            <Calculator className="h-4 w-4" />
          </button>
        ) : (
          <p className="shrink-0 text-right text-lg font-semibold text-violet-700">
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
                onClick={() => setDisplayUnit(unit)}
                aria-pressed={displayUnit === unit}
                className={`min-h-11 min-w-14 rounded-md px-4 text-sm font-bold transition-colors ${
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
          <span className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-md bg-slate-100 px-4 text-sm font-bold text-slate-700">
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
                      className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${
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
            <label className="block min-w-0">
              <span className="text-sm font-medium text-slate-700">
                Quanto você tem em {availableUnit}?
              </span>
              <div className="mt-2 flex w-full min-w-0 items-center overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-violet-200">
                <input
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
                <span className="px-4 text-sm font-bold text-slate-600">
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
            </label>
            <DialogFooter className="block w-full sm:space-x-0">
              <button
                type="button"
                onClick={applyAvailableQuantity}
                className="inline-flex min-h-14 w-full max-w-full items-center justify-center rounded-lg bg-violet-700 px-4 text-base font-semibold text-white"
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
  const recipe = data.payload.recipe;
  const baseYield =
    recipe.costingMode === "yield" && Number(recipe.yieldQuantity) > 0
      ? Number(recipe.yieldQuantity)
      : null;
  const yieldUnit = String(recipe.yieldUnit || "").toUpperCase();
  const [desiredYieldInput, setDesiredYieldInput] = useState(
    baseYield == null ? "" : String(baseYield).replace(".", ",")
  );
  const desiredYield = Number(desiredYieldInput.replace(",", "."));
  const yieldScaleFactor = baseYield
    ? calculateRecipeScaleFromYield({
        baseYield,
        desiredYield,
      })
    : 1;

  function applyIngredientScale(scaleFactor: number) {
    if (!baseYield) return;
    const nextYield = scaleRecipeQuantity(baseYield, scaleFactor);
    setDesiredYieldInput(
      String(Number(nextYield.toFixed(3))).replace(".", ",")
    );
  }

  return (
    <div className="pb-6">
      <Link
        to="/admin/mobile/receitas"
        className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-slate-600"
      >
        <ChevronLeft className="h-4 w-4" /> Todas as receitas
      </Link>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold leading-tight text-slate-950">
          {recipe.name}
        </h2>
        {recipe.description ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {recipe.description}
          </p>
        ) : null}
        {baseYield ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <label
                htmlFor="desired-recipe-yield"
                className="block text-sm font-semibold text-violet-950"
              >
                Rendimento desejado
              </label>
              <p className="mt-0.5 text-xs text-violet-700">
                Receita-base: {formatQuantity(baseYield)} {yieldUnit}
              </p>
            </div>
            <div className="flex items-center rounded-lg border border-violet-200 bg-white focus-within:ring-2 focus-within:ring-violet-200">
              <input
                id="desired-recipe-yield"
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
                scaleFactor={yieldScaleFactor}
                onScaleFromIngredient={
                  baseYield ? applyIngredientScale : undefined
                }
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
