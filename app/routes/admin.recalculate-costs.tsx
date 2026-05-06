import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { SearchableSelect } from "~/components/ui/searchable-select";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";
import {
  scanItemsForRecalculationFiltered,
  recalculateAllItemsCostHistory,
} from "~/domain/item/item-cost-recalculate.server";
import type {
  ScanResult,
  BulkRecalculateResult,
  ScanFilters,
} from "~/domain/item/item-cost-recalculate.server";
import { ChevronLeft } from "lucide-react";

type LoaderData = {
  itemOptions: Array<{
    id: string;
    name: string;
    purchaseUm: string | null;
    consumptionUm: string | null;
  }>;
};

export async function loader({ request: _request }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const itemOptions = await db.item.findMany({
    where: { active: true, classification: "insumo" },
    select: {
      id: true,
      name: true,
      purchaseUm: true,
      consumptionUm: true,
    },
    orderBy: [{ name: "asc" }],
    take: 300,
  });

  return ok<LoaderData>({ itemOptions });
}

// ─── action ───────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "");

    if (_action === "scan") {
      const itemId = String(formData.get("itemId") || "").trim() || undefined;
      const search = String(formData.get("search") || "").trim() || undefined;
      const consumptionUm =
        String(formData.get("consumptionUm") || "").trim() || undefined;
      const onlyWithIssues = formData.get("onlyWithIssues") === "on";
      const selectedItemName =
        String(formData.get("selectedItemName") || "").trim() || undefined;

      const filters: ScanFilters = {
        itemId,
        search: itemId ? undefined : search,
        consumptionUm,
        onlyWithIssues: onlyWithIssues || undefined,
      };

      const result = await scanItemsForRecalculationFiltered(filters);
      return ok({
        phase: "scanned",
        scan: result,
        filters: {
          itemId,
          selectedItemName,
          search: itemId ? undefined : search,
          consumptionUm,
          onlyWithIssues,
        },
      });
    }

    if (_action === "apply") {
      const raw = String(formData.get("itemIds") || "");
      const itemIds = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (itemIds.length === 0) {
        return ok({
          phase: "done",
          bulk: { results: [], totals: { updated: 0, skipped: 0, errors: 0 } },
        });
      }

      const bulk = await recalculateAllItemsCostHistory(itemIds);
      return ok({ phase: "done", bulk });
    }

    return ok({ phase: "idle" });
  } catch (err) {
    return serverError(err);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${highlight ? "text-amber-600" : "text-slate-900"
          }`}
      >
        {value}
      </p>
    </div>
  );
}

function RecalculateCostsHowItWorks() {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>
          <strong>Verificar</strong> — analisa os insumos ativos, com filtros
          opcionais, e identifica entradas cujo custo normalizado pela
          configuração atual difere do valor armazenado.
        </li>
        <li>
          <strong>Selecionar</strong> — escolha quais itens devem ser
          recalculados. Itens com problemas são pré-selecionados.
        </li>
        <li>
          <strong>Aplicar</strong> — atualiza os valores de custo e sincroniza
          o custo atual. Somente itens selecionados são processados.
        </li>
      </ol>

      <p className="text-xs text-slate-500">
        Apenas entradas vinculadas a movimentos de estoque (
        <code className="rounded bg-slate-100 px-1 font-mono">
          referenceType = "stock-movement"
        </code>
        ) são processadas. Registros manuais não são modificados.
      </p>
    </div>
  );
}

// ─── idle phase ───────────────────────────────────────────────────────────────

function IdlePanel({
  submitting,
  itemOptions,
  initialItemId,
}: {
  submitting: boolean;
  itemOptions: Array<{
    value: string;
    label: string;
    searchText: string;
  }>;
  initialItemId?: string;
}) {
  const [selectedItemId, setSelectedItemId] = useState("");

  const selectedItem = useMemo(
    () => itemOptions.find((option) => option.value === selectedItemId) ?? null,
    [itemOptions, selectedItemId]
  );

  useEffect(() => {
    setSelectedItemId(initialItemId ?? "");
  }, [initialItemId]);

  return (
    <div className="space-y-6">
      <Form method="post" className="space-y-4">
        <input type="hidden" name="_action" value="scan" />
        <input type="hidden" name="itemId" value={selectedItemId} />
        <input
          type="hidden"
          name="selectedItemName"
          value={selectedItem?.label ?? ""}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Nome do insumo
            </label>
            <SearchableSelect
              value={selectedItemId}
              onValueChange={setSelectedItemId}
              options={[
                {
                  value: "",
                  label: "Todos os insumos",
                  searchText: "todos limpar",
                },
                ...itemOptions,
              ]}
              placeholder="Selecionar insumo"
              searchPlaceholder="Buscar item do sistema..."
              emptyText="Nenhum item encontrado."
              triggerClassName="h-10 w-full max-w-none justify-between px-3 text-sm text-slate-900"
              contentClassName="w-[var(--radix-popover-trigger-width)] min-w-[320px]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="consumptionUm"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Unidade de consumo
            </label>
            <input
              id="consumptionUm"
              name="consumptionUm"
              type="text"
              placeholder="Unidade (KG, UN, L…)"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            name="onlyWithIssues"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 accent-amber-500"
          />
          Mostrar apenas itens com entradas a corrigir
        </label>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Verificando…" : "Verificar itens"}
        </Button>
      </Form>
    </div>
  );
}

// ─── scanned phase ────────────────────────────────────────────────────────────

function ScannedPanel({
  scan,
  filters,
  submitting,
}: {
  scan: ScanResult;
  filters: {
    itemId?: string;
    selectedItemName?: string;
    search?: string;
    consumptionUm?: string;
    onlyWithIssues?: boolean;
  };
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pre-select all items with issues when scan results arrive
  useEffect(() => {
    const initial = new Set(
      scan.items
        .filter((i) => i.recalculableEntries > 0)
        .map((i) => i.itemId)
    );
    setSelected(initial);
  }, [scan]);

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllWithIssues = () => {
    setSelected(
      new Set(
        scan.items
          .filter((i) => i.recalculableEntries > 0)
          .map((i) => i.itemId)
      )
    );
  };

  const clearSelection = () => setSelected(new Set());

  const activeFilters = [
    filters.selectedItemName ? `Item: "${filters.selectedItemName}"` : null,
    !filters.selectedItemName && filters.search
      ? `Nome: "${filters.search}"`
      : null,
    filters.consumptionUm ? `Unidade: "${filters.consumptionUm}"` : null,
    filters.onlyWithIssues ? "Apenas com problemas" : null,
  ].filter(Boolean);

  const selectedIds = Array.from(selected).join(",");
  const selectedCount = selected.size;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Insumos encontrados" value={scan.totalItems} />
        <StatBox
          label="Itens com problemas"
          value={scan.itemsWithChanges}
          highlight={scan.itemsWithChanges > 0}
        />
        <StatBox
          label="Entradas a corrigir"
          value={scan.totalRecalculable}
          highlight={scan.totalRecalculable > 0}
        />
      </div>

      {/* Filter summary bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span className="font-semibold text-slate-500">Filtros ativos:</span>
        {activeFilters.length === 0 ? (
          <span className="text-slate-400">nenhum</span>
        ) : (
          activeFilters.map((f) => (
            <span
              key={f}
              className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700"
            >
              {f}
            </span>
          ))
        )}
        <Form method="post" className="ml-auto">
          <input type="hidden" name="_action" value="scan" />
          <button
            type="submit"
            className="text-blue-600 hover:underline font-medium"
          >
            Nova busca
          </button>
        </Form>
      </div>

      {scan.totalRecalculable === 0 && !scan.items.some(() => true) ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-emerald-800">
            Nenhum item encontrado com os filtros aplicados.
          </p>
        </div>
      ) : scan.totalRecalculable === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-emerald-800">
            Nenhuma entrada precisa de correção.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Todos os registros de custo estão corretamente normalizados com a
            configuração atual dos itens.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>O que será feito:</strong> para cada entrada selecionada, o
            sistema re-normaliza o custo usando a conversão atual do item e
            atualiza{" "}
            <code className="rounded bg-amber-100 px-1 font-mono">
              costAmount
            </code>{" "}
            e{" "}
            <code className="rounded bg-amber-100 px-1 font-mono">unit</code>{" "}
            para a unidade de consumo. O custo atual (
            <code className="rounded bg-amber-100 px-1 font-mono">
              ItemCostVariation
            </code>
            ) também é sincronizado. Esta operação{" "}
            <strong>modifica dados históricos</strong> — execute apenas se as
            conversões do item estiverem corretas.
          </div>

          {/* Selection controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAllWithIssues}
              className="text-xs text-amber-700 font-medium hover:underline"
            >
              Selecionar todos com problemas
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-slate-500 hover:underline"
            >
              Limpar seleção
            </button>
            <span className="ml-auto text-xs text-slate-500">
              {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 font-semibold text-slate-600">
                    Insumo
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-600">
                    Unidade consumo
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">
                    Entradas (mov.)
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">
                    A corrigir
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scan.items.map((item) => {
                  const isSelected = selected.has(item.itemId);
                  const hasIssues = item.recalculableEntries > 0;
                  return (
                    <tr
                      key={item.itemId}
                      onClick={() => toggleItem(item.itemId)}
                      className={[
                        "cursor-pointer transition-colors",
                        hasIssues ? "bg-amber-50/40" : "",
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
                          onChange={() => toggleItem(item.itemId)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <a
                          href={`/admin/items/${item.itemId}/costs`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline hover:text-blue-600"
                        >
                          {item.name}
                        </a>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-500">
                        {item.consumptionUm ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {item.movementLinkedEntries}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.recalculableEntries > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 font-semibold tabular-nums"
                          >
                            {item.recalculableEntries}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Apply form */}
          <Form method="post" className="flex items-center gap-3">
            <input type="hidden" name="_action" value="apply" />
            <input type="hidden" name="itemIds" value={selectedIds} />
            <Button
              type="submit"
              disabled={submitting || selectedCount === 0}
            >
              {submitting
                ? "Aplicando recálculo…"
                : `Aplicar recálculo nos selecionados (${selectedCount})`}
            </Button>
          </Form>
        </>
      )}
    </div>
  );
}

// ─── done phase ───────────────────────────────────────────────────────────────

function DonePanel({ bulk }: { bulk: BulkRecalculateResult }) {
  const { totals, results } = bulk;
  const withChanges = results.filter((r) => r.updated > 0 || r.errors > 0);
  const withoutChanges = results.filter(
    (r) => r.updated === 0 && r.errors === 0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatBox
          label="Entradas atualizadas"
          value={totals.updated}
          highlight={totals.updated > 0}
        />
        <StatBox label="Sem alteração" value={totals.skipped} />
        <StatBox
          label="Erros"
          value={totals.errors}
          highlight={totals.errors > 0}
        />
      </div>

      {withChanges.length === 0 && withoutChanges.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhum item foi processado.
          </p>
        </div>
      ) : (
        <>
          {withChanges.length > 0 && (
            <div className="space-y-3">
              {withChanges.map((r) => (
                <div
                  key={r.itemId}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <a
                      href={`/admin/items/${r.itemId}/costs`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-slate-800 hover:underline hover:text-blue-600"
                    >
                      {r.name}
                    </a>
                    {r.updated > 0 && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {r.updated} atualizada{r.updated !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {r.errors > 0 && (
                      <Badge
                        variant="outline"
                        className="border-red-200 bg-red-50 text-red-700"
                      >
                        {r.errors} erro{r.errors !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  {r.log.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {r.log.map((line, i) => (
                        <li
                          key={i}
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
                {withoutChanges.length} ite
                {withoutChanges.length !== 1 ? "ns" : "m"} sem alterações
              </summary>
              <ul className="divide-y divide-slate-50 px-4 pb-3">
                {withoutChanges.map((r) => (
                  <li key={r.itemId} className="py-1.5 text-xs text-slate-500">
                    <a
                      href={`/admin/items/${r.itemId}/costs`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline hover:text-blue-600"
                    >
                      {r.name}
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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function RecalculateCostsRootPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const payload = (actionData as any)?.payload;
  const phase = payload?.phase ?? "idle";
  const scan: ScanResult | null = payload?.scan ?? null;
  const bulk: BulkRecalculateResult | null = payload?.bulk ?? null;
  const filters = payload?.filters ?? {};
  const itemOptions = (loaderData.payload?.itemOptions || []).map((item: any) => ({
    value: String(item.id || ""),
    label: String(item.name || ""),
    searchText: [item.name, item.purchaseUm, item.consumptionUm]
      .filter(Boolean)
      .join(" "),
  }));

  return (
    <div className="w-full space-y-8">
      {/* Back link */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
        >
          <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
            <ChevronLeft size={12} />
          </span>
          voltar
        </Link>

      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Ferramentas
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Recalculo de Custos
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Recalcula o historico de custo de um item e atualiza o ultimo
            custo.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Apenas entradas vinculadas a movimentos de estoque (
            <code className="rounded bg-slate-100 px-1 font-mono">
              referenceType = "stock-movement"
            </code>
            ) sao processadas. Registros manuais nao sao modificados.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="pt-5 text-sm font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
            >
              Como funciona
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Como funciona o recalculo de custos</DialogTitle>
              <DialogDescription>
                Este atalho tira a explicação do corpo da tela e deixa a página
                livre para a operação principal.
              </DialogDescription>
            </DialogHeader>
            <RecalculateCostsHowItWorks />
          </DialogContent>
        </Dialog>
      </div>

      {phase === "idle" && (
        <IdlePanel
          submitting={submitting}
          itemOptions={itemOptions}
          initialItemId={filters.itemId}
        />
      )}

      {phase === "scanned" && scan && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Resultado da verificacao
          </p>
          <ScannedPanel
            scan={scan}
            filters={filters}
            submitting={submitting}
          />
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
