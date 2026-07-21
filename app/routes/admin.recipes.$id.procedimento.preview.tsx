import { useOutletContext } from "@remix-run/react";
import { Printer } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";

function formatQuantity(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function ThermalPhasePreview({
  title,
  phase,
}: {
  title: string;
  phase?: {
    upperTemperatureCelsius?: number | null;
    lowerTemperatureCelsius?: number | null;
    durationMinutes?: number | null;
    notes?: string | null;
  } | null;
}) {
  if (!phase) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
        {title}
      </h2>
      <div className="mt-2 rounded-md border border-slate-200 p-4 text-sm text-slate-800 print:border-slate-300">
        <div className="grid gap-2 sm:grid-cols-3">
          <p>
            Superior: {phase.upperTemperatureCelsius ?? "-"}
            {phase.upperTemperatureCelsius == null ? "" : " °C"}
          </p>
          <p>
            Inferior: {phase.lowerTemperatureCelsius ?? "-"}
            {phase.lowerTemperatureCelsius == null ? "" : " °C"}
          </p>
          <p>
            Tempo: {phase.durationMinutes ?? "-"}
            {phase.durationMinutes == null ? "" : " min"}
          </p>
        </div>
        {phase.notes ? (
          <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 leading-7">
            {phase.notes}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default function AdminRecipeProcedimentoPreview() {
  const { recipe, recipeLines, linkedVariations } =
    useOutletContext<AdminRecipeOutletContext>();
  const procedure = String((recipe as any)?.productionProcedure || "").trim();
  const preheating = (recipe as any)?.RecipePreheating || null;
  const baking = (recipe as any)?.RecipeBaking || null;
  const productionNotes = String((recipe as any)?.productionNotes || "").trim();
  const referenceVariation =
    linkedVariations.find((variation) => variation.isReference)
      ?.itemVariationId ||
    linkedVariations[0]?.itemVariationId ||
    recipeLines[0]?.ItemVariation?.id ||
    "";
  const ingredientRows = recipeLines
    .filter((line) =>
      referenceVariation
        ? String(line.ItemVariation?.id || "") === referenceVariation
        : true
    )
    .map((line) => ({
      id: line.id,
      itemName: line.Item?.name || "-",
      unit: line.unit || "UN",
      quantity: Number(line.quantity || 0),
      lossPct: line.lossPct == null ? null : Number(line.lossPct || 0),
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName, "pt-BR"));
  const yieldLine =
    (recipe as any).costingMode === "yield" && (recipe as any).yieldQuantity
      ? `${formatQuantity((recipe as any).yieldQuantity)} ${
          (recipe as any).yieldUnit || ""
        }`.trim()
      : "";

  return (
    <div className="space-y-4">
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        @media print {
          body * { visibility: hidden !important; }
          .procedure-print-root, .procedure-print-root * { visibility: visible !important; }
          .procedure-print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; }
          .print-hide { display: none !important; }
          .print-sheet { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
        }
      `}</style>

      <div className="print-hide flex justify-end">
        <Button type="button" onClick={() => window.print()} className="gap-2">
          <Printer size={14} />
          Imprimir ou salvar PDF
        </Button>
      </div>

      <div className="procedure-print-root rounded-md bg-slate-100 p-4 print:bg-white print:p-0">
        <section className="print-sheet mx-auto max-w-4xl rounded-md border border-slate-200 bg-white p-8 shadow-sm">
          <header className="border-b border-slate-300 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Procedimento padrao de producao
            </p>
            <h1 className="mt-1 text-2xl font-bold">{recipe.name}</h1>
            <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                Item vinculado:{" "}
                {(recipe as any).Item?.name || "sem item vinculado"}
              </p>
              <p>
                Tipo:{" "}
                {recipe.type === "pizzaTopping"
                  ? "Sabor de pizza"
                  : "Produzido"}
              </p>
              {yieldLine ? <p>Rendimento: {yieldLine}</p> : null}
              <p>
                Atualizado em:{" "}
                {new Date(recipe.updatedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </header>

          {recipe.description ? (
            <section className="mt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Descricao
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {recipe.description}
              </p>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Ingredientes de referencia
            </h2>
            {ingredientRows.length > 0 ? (
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Ingrediente</th>
                    <th className="py-2 pr-3 text-right">Qtd.</th>
                    <th className="py-2 pr-3">UM</th>
                    <th className="py-2 text-right">Perda</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientRows.map((line) => (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{line.itemName}</td>
                      <td className="py-2 pr-3 text-right">
                        {formatQuantity(line.quantity)}
                      </td>
                      <td className="py-2 pr-3">{line.unit}</td>
                      <td className="py-2 text-right">
                        {line.lossPct == null
                          ? "-"
                          : `${formatQuantity(line.lossPct)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Sem ingredientes cadastrados.
              </p>
            )}
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Procedimento
            </h2>
            <div className="mt-2 min-h-40 whitespace-pre-wrap rounded-md border border-slate-200 p-4 text-sm leading-7 text-slate-800 print:border-slate-300">
              {procedure || "Procedimento ainda nao cadastrado."}
            </div>
          </section>

          <ThermalPhasePreview title="Pré-aquecimento" phase={preheating} />
          <ThermalPhasePreview title="Assamento" phase={baking} />

          {productionNotes ? (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Observacoes
              </h2>
              <div className="mt-2 whitespace-pre-wrap rounded-md border border-slate-200 p-4 text-sm leading-7 text-slate-800 print:border-slate-300">
                {productionNotes}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </div>
  );
}
