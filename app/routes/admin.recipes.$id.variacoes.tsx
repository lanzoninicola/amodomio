import { Form, Link, useOutletContext } from "@remix-run/react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Scale,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
import {
  buildRecipeSectionHref,
  IngredientUnitEditor,
  InlineVariationCellEditor,
} from "./admin.recipes.$id";

function formatQuantity(value: unknown, fractionDigits = 3) {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return "0";
  return quantity.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export default function AdminRecipeVariacoesTab() {
  const { recipe, items, recipeLines, linkedVariations } =
    useOutletContext<AdminRecipeOutletContext>();
  const [hiddenVariationIds, setHiddenVariationIds] = useState<string[]>([]);
  const isYieldMode = String((recipe as any)?.costingMode || "") === "yield";
  const recipeYieldQuantity = Number((recipe as any)?.yieldQuantity || 0);
  const recipeYieldUnit = String((recipe as any)?.yieldUnit || "")
    .trim()
    .toUpperCase();

  const itemById = new Map(items.map((item) => [item.id, item]));
  const baseVariationIds = linkedVariations
    .filter(
      (variation) =>
        variation.variationKind === "base" && variation.variationCode === "base"
    )
    .map((variation) => variation.itemVariationId);
  const hasAnyLinkedVariation = linkedVariations.some((variation) =>
    Boolean(variation.variationId)
  );
  const variationColumns = isYieldMode
    ? []
    : linkedVariations.filter(
      (variation) =>
        variation.variationId &&
        !hiddenVariationIds.includes(variation.itemVariationId)
    );
  const columnToggleVariations = linkedVariations
    .filter((variation) => variation.variationId)
    .sort(
      (a, b) => Number(Boolean(b.isReference)) - Number(Boolean(a.isReference))
    );
  const orderedVariationColumns = [...variationColumns].sort(
    (a, b) => Number(Boolean(b.isReference)) - Number(Boolean(a.isReference))
  );
  const effectiveVariationColumns = isYieldMode
    ? [
      {
        itemVariationId: "__yield__",
        variationId: null,
        variationName: "Qtd usada no lote",
        isReference: false,
      },
    ]
    : orderedVariationColumns.length > 0
      ? orderedVariationColumns
      : hasAnyLinkedVariation
        ? []
        : [
          {
            itemVariationId: "__base__",
            variationId: null,
            variationName: "Base/auto",
          },
        ];
  const compactMatrixWidthClass = isYieldMode
    ? ""
    : effectiveVariationColumns.length <= 1
      ? "max-w-[760px]"
      : effectiveVariationColumns.length === 2
        ? "max-w-[980px]"
        : "";

  const groupedLines = recipeLines.reduce(
    (acc, line) => {
      const key = String(line.recipeIngredientId || line.id);
      const current = acc.get(key) || {
        key,
        recipeIngredientId: line.recipeIngredientId || null,
        itemName: line.Item?.name || "-",
        itemId: line.itemId,
        sortOrderIndex: Number(line.sortOrderIndex || 0),
        linesByVariation: new Map<string, any>(),
      };
      const mapKey = String(line.ItemVariation?.id || "__base__");
      current.linesByVariation.set(mapKey, line);
      acc.set(key, current);
      return acc;
    },
    new Map<
      string,
      {
        key: string;
        recipeIngredientId: string | null;
        itemName: string;
        itemId: string;
        sortOrderIndex: number;
        linesByVariation: Map<string, any>;
      }
    >()
  );

  const compositionRows = Array.from(groupedLines.values()).sort(
    (a, b) =>
      a.sortOrderIndex - b.sortOrderIndex ||
      a.itemName.localeCompare(b.itemName, "pt-BR")
  );
  const getYieldLine = (row: { linesByVariation: Map<string, any> }) =>
    row.linesByVariation.get("__base__") ||
    row.linesByVariation.values().next().value;
  const compositionRowsWithUnit = compositionRows.map((row) => {
    const firstVisibleLine = isYieldMode
      ? getYieldLine(row)
      : effectiveVariationColumns
        .map((variation) =>
          row.linesByVariation.get(String(variation.itemVariationId))
        )
        .find(Boolean);
    const firstLine =
      firstVisibleLine || row.linesByVariation.values().next().value;
    const itemConsumptionUm = String(
      itemById.get(row.itemId)?.consumptionUm || ""
    )
      .trim()
      .toUpperCase();
    const currentLineUnit = String(firstLine?.unit || "")
      .trim()
      .toUpperCase();
    const resolvedUnit = itemConsumptionUm || currentLineUnit || "UN";
    return {
      ...row,
      unit: resolvedUnit,
      itemConsumptionUm,
    };
  });

  const variationMetrics = effectiveVariationColumns.map((variation) => {
    let filledQtyCells = 0;
    for (const row of compositionRowsWithUnit) {
      const line = isYieldMode
        ? getYieldLine(row)
        : row.linesByVariation.get(String(variation.itemVariationId));
      if (!line) continue;
      if (String(line.unit || "").trim() && Number(line.quantity || 0) > 0) {
        filledQtyCells += 1;
      }
    }
    return {
      itemVariationId: variation.itemVariationId,
      filledQtyCells,
    };
  });

  const requiredCellCount = compositionRowsWithUnit.length;
  const hasVariationPendingCells = variationMetrics.some(
    (metric) => metric.filledQtyCells < requiredCellCount
  );
  const completedCellCount = variationMetrics.reduce(
    (acc, metric) => acc + metric.filledQtyCells,
    0
  );
  const yieldExampleRow = isYieldMode
    ? compositionRowsWithUnit.find((row) => {
      const line = getYieldLine(row);
      return Number(line?.quantity || 0) > 0;
    })
    : null;
  const yieldExampleLine = yieldExampleRow
    ? getYieldLine(yieldExampleRow)
    : null;
  const yieldExampleText =
    isYieldMode &&
      yieldExampleRow &&
      yieldExampleLine &&
      Number(yieldExampleLine.quantity || 0) > 0 &&
      recipeYieldQuantity > 0
      ? `Nesta receita: se o lote usa ${formatQuantity(
        yieldExampleLine.quantity
      )} ${yieldExampleRow.unit} de ${yieldExampleRow.itemName
      } e resulta em ${formatQuantity(recipeYieldQuantity)} ${recipeYieldUnit || "UM"
      }, informe ${formatQuantity(yieldExampleLine.quantity)} ${yieldExampleRow.unit
      } na linha de ${yieldExampleRow.itemName}.`
      : "Exemplo: se o lote usa 1,345 KG de um ingrediente e resulta em 0,450 KG, aqui entra 1,345 KG na linha desse ingrediente.";

  const toggleVariationColumn = (itemVariationId: string) => {
    if (baseVariationIds.includes(itemVariationId)) return;
    setHiddenVariationIds((current) =>
      current.includes(itemVariationId)
        ? current.filter((id) => id !== itemVariationId)
        : [...current, itemVariationId]
    );
  };

  return (
    <div className="space-y-4">
      <section className={cn("w-full", compactMatrixWidthClass)}>
        {isYieldMode ? (
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-700 ring-1 ring-slate-200">
                  <Scale size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Receita por rendimento
                    </p>
                    {/* <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      Rendimento final: {formatQuantity(recipeYieldQuantity)}{" "}
                      {recipeYieldUnit || "UM"}
                    </span> */}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Preencha abaixo a quantidade total de cada ingrediente usada
                    para um rendimento de <span className="font-semibold">{formatQuantity(recipeYieldQuantity)}{" "} {recipeYieldUnit || "UM"}</span>.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasVariationPendingCells ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    <CircleAlert size={14} />
                    {completedCellCount}/{requiredCellCount} preenchidos
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <CheckCircle2 size={14} />
                      Pronto para ficha
                    </span>
                    <Button asChild size="sm" className="gap-2">
                      <Link to={buildRecipeSectionHref(recipe.id, "fichas")}>
                        Fichas técnicas
                        <ArrowRight size={14} />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${hasVariationPendingCells ? "bg-amber-400" : "bg-emerald-400"
                  }`}
              />
              <span className="text-sm text-slate-500">
                {isYieldMode
                  ? hasVariationPendingCells
                    ? "Informe as quantidades usadas no lote"
                    : "Ingredientes completos para o rendimento"
                  : hasVariationPendingCells
                    ? "Células sem UM ou quantidade"
                    : "Todas as variações completas"}
              </span>
            </div>
            {!isYieldMode ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Colunas
                </span>
                {columnToggleVariations.length === 0 ? (
                  <span className="text-sm text-slate-400">
                    Nenhuma variação disponível.
                  </span>
                ) : (
                  columnToggleVariations.map((variation) => {
                    const visible = !hiddenVariationIds.includes(
                      variation.itemVariationId
                    );
                    return (
                      <button
                        key={`toggle-${variation.itemVariationId}`}
                        type="button"
                        onClick={() =>
                          toggleVariationColumn(variation.itemVariationId)
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          visible
                            ? "border-slate-200 bg-slate-100 text-slate-900"
                            : "border-transparent bg-white text-slate-400 hover:border-slate-200 hover:text-slate-600"
                        )}
                      >
                        {variation.variationName || "Variação"}
                        {variation.isReference ? (
                          <span className="ml-1 text-slate-400">★</span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          <div />
        </div>

        <div className="overflow-x-auto">
          <table
            className={cn(
              "min-w-[720px] border-separate border-spacing-0 text-sm",
              isYieldMode ? "w-full" : "w-max"
            )}
          >
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[260px] min-w-[260px] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Ingrediente
                </th>
                <th className="w-24 bg-white px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  UM
                </th>
                {effectiveVariationColumns.map((variation, index) => {
                  const metric = variationMetrics[index];
                  const missing = metric.filledQtyCells < requiredCellCount;
                  return (
                    <th
                      key={variation.itemVariationId}
                      className={cn(
                        "px-3 py-3 text-left",
                        isYieldMode
                          ? "min-w-[220px]"
                          : "w-[220px] min-w-[220px]",
                        variation.isReference ? "bg-slate-50" : "bg-white"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                          {variation.variationName || "Base"}
                        </span>
                        {variation.isReference ? (
                          <span className="text-[11px] text-slate-400">★</span>
                        ) : null}
                        {missing ? (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-400"
                            title="Campos pendentes"
                          />
                        ) : null}
                      </div>
                    </th>
                  );
                })}
                <th className="w-8 bg-white px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {compositionRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={effectiveVariationColumns.length + 3}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    Nenhum item na composição. Primeiro monte a base na página
                    Composição.
                  </td>
                </tr>
              ) : (
                compositionRowsWithUnit.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td className="sticky left-0 border-t border-slate-100 bg-white px-4 py-4 align-top">
                      <Link
                        to={`/admin/items/${row.itemId}/main`}
                        target="_blank"
                        rel="noreferrer"
                        className="block max-w-[220px] truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                        title={row.itemName}
                      >
                        {row.itemName}
                      </Link>
                    </td>
                    <td className="border-t border-slate-100 px-3 py-4 align-top">
                      <IngredientUnitEditor
                        recipeId={recipe.id}
                        section="variacoes"
                        recipeIngredientId={row.recipeIngredientId}
                        currentUnit={row.unit}
                        options={(() => {
                          const options = Array.from(
                            new Set(
                              [
                                String(row.itemConsumptionUm || "")
                                  .trim()
                                  .toUpperCase(),
                                String(row.unit || "")
                                  .trim()
                                  .toUpperCase(),
                              ].filter(Boolean)
                            )
                          );
                          return options.length > 0 ? options : ["UN"];
                        })()}
                      />
                    </td>
                    {effectiveVariationColumns.map((variation) => {
                      const line = isYieldMode
                        ? getYieldLine(row)
                        : row.linesByVariation.get(
                          String(variation.itemVariationId)
                        );
                      if (!line) {
                        return (
                          <td
                            key={`${row.key}-${variation.itemVariationId}`}
                            className={`border-t border-slate-100 px-3 py-4 align-top text-sm text-slate-300 ${variation.isReference ? "bg-slate-50" : ""
                              }`}
                          >
                            —
                          </td>
                        );
                      }
                      return (
                        <td
                          key={`${row.key}-${variation.itemVariationId}`}
                          className={`border-t border-slate-100 px-3 py-4 align-top ${variation.isReference ? "bg-slate-50" : ""
                            }`}
                        >
                          <InlineVariationCellEditor
                            recipeId={recipe.id}
                            section="variacoes"
                            line={line}
                            lineUnit={row.unit}
                            showVariationLoss={false}
                            globalLossPct={0}
                          />
                        </td>
                      );
                    })}
                    <td className="border-t border-slate-100 px-3 py-4 align-top text-right">
                      <Form
                        method="post"
                        action=".."
                        preventScrollReset
                        className="inline"
                      >
                        <input
                          type="hidden"
                          name="recipeId"
                          value={recipe.id}
                        />
                        <input type="hidden" name="tab" value="variacoes" />
                        <input
                          type="hidden"
                          name="recipeIngredientId"
                          value={row.recipeIngredientId || ""}
                        />
                        <input
                          type="hidden"
                          name="recipeLineId"
                          value={
                            row.linesByVariation.values().next().value?.id || ""
                          }
                        />
                        <button
                          type="submit"
                          name="_action"
                          value="recipe-ingredient-delete"
                          className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-100 hover:text-red-400"
                          title="Remover ingrediente"
                          aria-label="Remover ingrediente"
                        >
                          <Trash2 size={13} />
                        </button>
                      </Form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
