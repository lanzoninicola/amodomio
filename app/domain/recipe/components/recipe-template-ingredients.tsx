import { Check } from "lucide-react";
import type { RecipeTemplateSnapshot } from "../recipe-template";

export function RecipeTemplateIngredients({
  ingredients,
  addedIds,
  onToggle,
  onReset,
  displayUnits,
  onUnitChange,
}: {
  ingredients: RecipeTemplateSnapshot["ingredients"];
  addedIds: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
  displayUnits?: Record<string, string[]>;
  onUnitChange?: (ingredientId: string, unit: string) => void;
}) {
  const addedCount = ingredients.filter((ingredient) =>
    addedIds.includes(ingredient.id)
  ).length;
  const remaining = ingredients.length - addedCount;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2">
        <div aria-live="polite">
          <p className="text-sm font-semibold text-slate-900">
            {remaining === 0
              ? "Todos os ingredientes adicionados"
              : `${remaining === 1 ? "Falta" : "Faltam"} ${remaining} ${
                  remaining === 1 ? "ingrediente" : "ingredientes"
                }`}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {addedCount} de {ingredients.length} adicionados
          </p>
        </div>
        {addedCount > 0 ? (
          <button
            type="button"
            className="h-11 shrink-0 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
            onClick={onReset}
          >
            Reiniciar
          </button>
        ) : null}
      </div>
      <ul className="space-y-3">
        {ingredients.map((ingredient) => {
          const added = addedIds.includes(ingredient.id);
          return (
            <li
              key={ingredient.id}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`min-w-0 flex-1 ${added ? "opacity-[0.45]" : ""}`}
                >
                  <span
                    className={`block text-sm leading-5 ${
                      added ? "text-slate-500 line-through" : "text-slate-900"
                    }`}
                  >
                    {ingredient.name}
                  </span>
                  {ingredient.notes ? (
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {ingredient.notes}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`shrink-0 text-lg font-bold leading-6 ${
                    added ? "text-slate-400" : "text-slate-900"
                  }`}
                >
                  {Number(ingredient.quantity).toLocaleString("pt-BR", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  {ingredient.unit}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                {onUnitChange &&
                (displayUnits?.[ingredient.id]?.length || 0) > 1 ? (
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xs font-medium text-slate-500">
                      Unidade de visualização
                    </p>
                    <div
                      role="group"
                      aria-label={`Unidade de visualização de ${ingredient.name}`}
                      className="flex flex-wrap gap-2"
                    >
                      {displayUnits?.[ingredient.id].map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          aria-pressed={ingredient.unit === unit}
                          onClick={() => onUnitChange(ingredient.id, unit)}
                          className={`h-[48px] min-w-[56px] rounded-lg border px-4 text-sm font-semibold ${
                            ingredient.unit === unit
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1" />
                )}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={added}
                  aria-label={`${ingredient.name}: ${
                    added ? "adicionado" : "pendente"
                  }`}
                  onClick={() => onToggle(ingredient.id)}
                  className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 items-center justify-center rounded border ${
                      added
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-400 bg-white"
                    }`}
                  >
                    {added ? <Check className="h-4 w-4" /> : null}
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
