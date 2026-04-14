import type { ActionFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  recalculateItemCostSheetsInBulk,
  scanItemCostSheetsForBulkRecalculation,
} from "~/domain/costs/item-cost-sheet-bulk-recalculate.server";
import type {
  ItemCostSheetBulkRecalculateResult,
  ItemCostSheetBulkScanResult,
} from "~/domain/costs/item-cost-sheet-bulk-recalculate.server";
import { ok, serverError } from "~/utils/http-response.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const formAction = String(formData.get("_action") || "").trim();

    if (formAction === "scan") {
      const search = String(formData.get("search") || "").trim() || undefined;
      const onlyActive = formData.get("onlyActive") === "on";
      const onlyWithComponents = formData.get("onlyWithComponents") === "on";

      const scan = await scanItemCostSheetsForBulkRecalculation({
        search,
        onlyActive,
        onlyWithComponents,
      });

      return ok({
        phase: "scanned",
        scan,
        filters: { search, onlyActive, onlyWithComponents },
      });
    }

    if (formAction === "apply") {
      const rootSheetIds = String(formData.get("rootSheetIds") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const bulk = await recalculateItemCostSheetsInBulk(rootSheetIds);
      return ok({ phase: "done", bulk });
    }

    return ok({ phase: "idle" });
  } catch (error) {
    return serverError(error);
  }
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          highlight ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function IdlePanel({ submitting }: { submitting: boolean }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          Como funciona
        </p>
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
          <li>
            <strong>Verificar</strong> as fichas raiz para localizar quais
            possuem composição e podem ser recalculadas.
          </li>
          <li>
            <strong>Selecionar</strong> as fichas desejadas. Por padrão, a
            tela marca as que possuem composição cadastrada.
          </li>
          <li>
            <strong>Aplicar</strong> o recálculo. O sistema recompõe os custos
            das variações com base na composição atual da ficha e publica os
            snapshots ativos quando necessário.
          </li>
        </ol>
      </div>

      <Form method="post" className="space-y-4">
        <input type="hidden" name="_action" value="scan" />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="search"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
          >
            Ficha ou item
          </label>
          <input
            id="search"
            name="search"
            type="text"
            placeholder="Filtrar por nome da ficha ou do item"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-700">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="onlyActive"
              defaultChecked
              className="h-4 w-4 rounded border-slate-300 accent-amber-500"
            />
            Mostrar apenas fichas ativas
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="onlyWithComponents"
              defaultChecked
              className="h-4 w-4 rounded border-slate-300 accent-amber-500"
            />
            Mostrar apenas fichas com composição cadastrada
          </label>
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Verificando..." : "Verificar fichas"}
        </Button>
      </Form>
    </div>
  );
}

function ScannedPanel({
  scan,
  filters,
  submitting,
}: {
  scan: ItemCostSheetBulkScanResult;
  filters: {
    search?: string;
    onlyActive?: boolean;
    onlyWithComponents?: boolean;
  };
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(
      new Set(
        scan.sheets
          .filter((sheet) => sheet.componentCount > 0)
          .map((sheet) => sheet.rootSheetId)
      )
    );
  }, [scan]);

  const toggleSheet = (rootSheetId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(rootSheetId)) {
        next.delete(rootSheetId);
      } else {
        next.add(rootSheetId);
      }
      return next;
    });
  };

  const selectedIds = Array.from(selected).join(",");
  const activeFilters = [
    filters.search ? `Busca: "${filters.search}"` : null,
    filters.onlyActive ? "Apenas ativas" : null,
    filters.onlyWithComponents ? "Apenas com composição" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox label="Fichas encontradas" value={scan.totalSheets} />
        <StatBox label="Fichas ativas" value={scan.activeSheets} />
        <StatBox
          label="Com composição"
          value={scan.sheetsWithComponents}
          highlight={scan.sheetsWithComponents > 0}
        />
        <StatBox
          label="Componentes"
          value={scan.totalComponents}
          highlight={scan.totalComponents > 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span className="font-semibold text-slate-500">Filtros ativos:</span>
        {activeFilters.length === 0 ? (
          <span className="text-slate-400">nenhum</span>
        ) : (
          activeFilters.map((filterValue) => (
            <span
              key={filterValue}
              className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700"
            >
              {filterValue}
            </span>
          ))
        )}
        <Form method="post" className="ml-auto">
          <input type="hidden" name="_action" value="scan" />
          <button
            type="submit"
            className="font-medium text-blue-600 hover:underline"
          >
            Nova busca
          </button>
        </Form>
      </div>

      {scan.totalSheets === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-emerald-800">
            Nenhuma ficha encontrada para os filtros atuais.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>O que será feito:</strong> cada ficha raiz selecionada terá
            seus componentes recalculados com base na composição atual. Linhas
            do tipo <code className="rounded bg-amber-100 px-1 font-mono">recipe</code>
            usam o custo derivado da composição da receita; linhas{" "}
            <code className="rounded bg-amber-100 px-1 font-mono">recipeSheet</code>
            usam o total da ficha referenciada. Ao final, os totais das
            variações são atualizados e snapshots ativos podem ser republicados.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSelected(
                  new Set(
                    scan.sheets
                      .filter((sheet) => sheet.componentCount > 0)
                      .map((sheet) => sheet.rootSheetId)
                  )
                )
              }
              className="text-xs font-medium text-amber-700 hover:underline"
            >
              Selecionar todas com composição
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-slate-500 hover:underline"
            >
              Limpar seleção
            </button>
            <span className="ml-auto text-xs text-slate-500">
              {selected.size} selecionada{selected.size !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 font-semibold text-slate-600">
                    Ficha
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-600">
                    Item
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">
                    Componentes
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">
                    Variações
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">
                    Custo atual
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scan.sheets.map((sheet) => {
                  const isSelected = selected.has(sheet.rootSheetId);
                  return (
                    <tr
                      key={sheet.rootSheetId}
                      onClick={() => toggleSheet(sheet.rootSheetId)}
                      className={[
                        "cursor-pointer transition-colors",
                        sheet.componentCount > 0 ? "bg-amber-50/30" : "",
                        isSelected
                          ? "border-l-2 border-l-blue-400 bg-blue-50/30"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSheet(sheet.rootSheetId)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <a
                          href={`/admin/item-cost-sheets/${sheet.rootSheetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {sheet.sheetName}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {sheet.itemName}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {sheet.componentCount}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {sheet.variationCount}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {sheet.costAmount.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="px-3 py-2">
                        {sheet.isActive ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            ativa
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-600"
                          >
                            inativa
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Form method="post" className="flex items-center gap-3">
            <input type="hidden" name="_action" value="apply" />
            <input type="hidden" name="rootSheetIds" value={selectedIds} />
            <Button type="submit" disabled={submitting || selected.size === 0}>
              {submitting
                ? "Aplicando recálculo..."
                : `Recalcular fichas selecionadas (${selected.size})`}
            </Button>
          </Form>
        </>
      )}
    </div>
  );
}

function DonePanel({
  bulk,
}: {
  bulk: ItemCostSheetBulkRecalculateResult;
}) {
  const withChanges = bulk.results.filter(
    (row) => row.updatedSheets > 0 || row.errors > 0
  );
  const withoutChanges = bulk.results.filter(
    (row) => row.updatedSheets === 0 && row.errors === 0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox
          label="Fichas recalculadas"
          value={bulk.totals.updated}
          highlight={bulk.totals.updated > 0}
        />
        <StatBox label="Sem alteração" value={bulk.totals.skipped} />
        <StatBox
          label="Snapshots publicados"
          value={bulk.totals.publishedSnapshots}
          highlight={bulk.totals.publishedSnapshots > 0}
        />
        <StatBox
          label="Erros"
          value={bulk.totals.errors}
          highlight={bulk.totals.errors > 0}
        />
      </div>

      {withChanges.length === 0 && withoutChanges.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhuma ficha foi processada.
          </p>
        </div>
      ) : (
        <>
          {withChanges.length > 0 && (
            <div className="space-y-3">
              {withChanges.map((row) => (
                <div
                  key={row.rootSheetId}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <a
                      href={`/admin/item-cost-sheets/${row.rootSheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-slate-800 hover:text-blue-600 hover:underline"
                    >
                      {row.sheetName}
                    </a>
                    {row.updatedSheets > 0 && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {row.updatedSheets} variacao{row.updatedSheets !== 1 ? "es" : ""}
                      </Badge>
                    )}
                    {row.publishedSnapshots > 0 && (
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700"
                      >
                        {row.publishedSnapshots} snapshot{row.publishedSnapshots !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {row.errors > 0 && (
                      <Badge
                        variant="outline"
                        className="border-red-200 bg-red-50 text-red-700"
                      >
                        erro
                      </Badge>
                    )}
                  </div>

                  {row.log.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {row.log.map((line, index) => (
                        <li
                          key={index}
                          className="font-mono text-[11px] text-slate-500"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {withoutChanges.length > 0 && (
            <details className="rounded-lg border border-slate-100">
              <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700">
                {withoutChanges.length} ficha
                {withoutChanges.length !== 1 ? "s" : ""} sem alteração
              </summary>
              <ul className="divide-y divide-slate-50 px-4 pb-3">
                {withoutChanges.map((row) => (
                  <li key={row.rootSheetId} className="py-1.5 text-xs text-slate-500">
                    <a
                      href={`/admin/item-cost-sheets/${row.rootSheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 hover:underline"
                    >
                      {row.sheetName}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <Form method="post">
        <input type="hidden" name="_action" value="scan" />
        <Button type="submit" variant="outline">
          Nova verificacao
        </Button>
      </Form>
    </div>
  );
}

export default function AdminItemCostSheetsRecalculatePage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const payload = (actionData as any)?.payload;
  const phase = payload?.phase ?? "idle";
  const scan: ItemCostSheetBulkScanResult | null = payload?.scan ?? null;
  const bulk: ItemCostSheetBulkRecalculateResult | null = payload?.bulk ?? null;
  const filters = payload?.filters ?? {};

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          to="/admin/item-cost-sheets"
          className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
        >
          <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
            <ChevronLeft size={12} />
          </span>
          voltar
        </Link>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Ferramentas
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Recalcular fichas tecnicas
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Recalcula o custo das fichas tecnicas com base na composicao atual de
          cada ficha.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          A operação recompõe componentes do tipo{" "}
          <code className="rounded bg-slate-100 px-1 font-mono">recipe</code> e{" "}
          <code className="rounded bg-slate-100 px-1 font-mono">recipeSheet</code>,
          atualiza os totais por variação e republica snapshots ativos quando
          houver mudança.
        </p>
      </div>

      {phase === "idle" && <IdlePanel submitting={submitting} />}

      {phase === "scanned" && scan && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Resultado da verificacao
          </p>
          <ScannedPanel scan={scan} filters={filters} submitting={submitting} />
        </>
      )}

      {phase === "done" && bulk && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Resultado do recalculo
          </p>
          <DonePanel bulk={bulk} />
        </>
      )}
    </div>
  );
}
