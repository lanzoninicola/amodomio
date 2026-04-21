import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Copy, ListFilter, RefreshCw, Search, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DecimalInput } from "~/components/inputs/inputs";
import { Badge } from "~/components/ui/badge";
import { SearchableSelect } from "~/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  recalculateItemCostSheetsInBulk,
  scanItemCostSheetsForBulkRecalculation,
  type ItemCostSheetBulkRecalculateResult,
  type ItemCostSheetBulkScanResult,
} from "~/domain/costs/item-cost-sheet-bulk-recalculate.server";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";
import {
  buildFilterOptions,
  buildFiltersQuery,
  getInitialFilterValue,
  parseRouteFilters,
  type FilterOption,
  type RouteFilters,
  type RootSheetOption,
} from "~/domain/item-cost-sheet/recalculate-filters";

type LoaderData = {
  scan: ItemCostSheetBulkScanResult;
  filters: RouteFilters;
  rootSheetOptions: RootSheetOption[];
};

type ActionData = {
  bulk: ItemCostSheetBulkRecalculateResult;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const url = new URL(request.url);
  const filters = parseRouteFilters(url.searchParams);

  const rawSheets = await db.itemCostSheet.findMany({
    where: { baseItemCostSheetId: null },
    select: {
      id: true,
      itemId: true,
      name: true,
      Item: { select: { name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
  });

  const rootSheetOptions: RootSheetOption[] = rawSheets.map((sheet: any) => ({
    id: String(sheet.id || ""),
    name: String(sheet.name || "").trim(),
    itemName: String(sheet.Item?.name || ""),
    itemId: String(sheet.itemId || ""),
  }));

  const scan = await scanItemCostSheetsForBulkRecalculation({
    rootSheetId: filters.filterKind === "sheet" ? filters.rootSheetId : undefined,
    itemId: filters.filterKind === "item" ? filters.itemId : undefined,
    search:
      filters.filterKind === "sheet" || filters.filterKind === "item"
        ? undefined
        : filters.search,
    onlyActive: filters.onlyActive,
    onlyWithComponents: filters.onlyWithComponents,
  });

  return ok<LoaderData>({ scan, filters, rootSheetOptions });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const rootSheetIds = String(formData.get("rootSheetIds") || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const bulk = await recalculateItemCostSheetsInBulk(rootSheetIds);
    return ok<ActionData>({ bulk });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminRecalculateItemCostSheetsIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const { scan, filters, rootSheetOptions } = loaderData.payload;
  const filterOptions = useMemo(() => buildFilterOptions(rootSheetOptions), [rootSheetOptions]);

  const [selectedFilterValue, setSelectedFilterValue] = useState(() =>
    getInitialFilterValue(filters)
  );
  const [onlyActive, setOnlyActive] = useState(filters.onlyActive);
  const [onlyWithComponents, setOnlyWithComponents] = useState(filters.onlyWithComponents);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedFilter = useMemo(
    () => filterOptions.find((o) => o.value === selectedFilterValue) ?? null,
    [filterOptions, selectedFilterValue]
  );

  useEffect(() => {
    setSelectedFilterValue(getInitialFilterValue(filters));
    setOnlyActive(filters.onlyActive);
    setOnlyWithComponents(filters.onlyWithComponents);
  }, [filters]);

  useEffect(() => {
    setSelected(
      new Set(
        scan.sheets.filter((s) => s.componentCount > 0).map((s) => s.rootSheetId)
      )
    );
  }, [scan]);

  function toggleSheet(id: string) {
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sheets = scan.sheets;
  const allSelected =
    sheets.length > 0 && sheets.every((s) => selected.has(s.rootSheetId));
  const selectedCount = selected.size;
  const selectedIds = Array.from(selected).join(",");
  const bulk = (actionData as any)?.payload?.bulk ?? null;

  const filterSelectOptions: FilterOption[] = [
    { value: "", label: "Todas as fichas e itens", searchText: "todas", kind: "sheet" },
    ...filterOptions,
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Result banner */}
      {bulk ? (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${bulk.totals.errors > 0
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
        >
          <CheckCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold">
              {bulk.results.length} ficha(s) processada(s)
            </p>
            <p>
              {bulk.totals.updated} variação(ões) recalculada(s)
              {bulk.totals.publishedSnapshots > 0
                ? ` · ${bulk.totals.publishedSnapshots} snapshot(s) republicado(s)`
                : ""}
              {bulk.totals.errors > 0 ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="underline hover:opacity-70"
                    onClick={() => setErrorModalOpen(true)}
                  >
                    {bulk.totals.errors} erro(s)
                  </button>
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      {/* Error modal */}
      {bulk ? (
        <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Erros no recálculo</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
              {bulk.results
                .filter((r: any) => r.errors > 0)
                .map((r: any) => (
                  <div key={r.rootSheetId} className="rounded-md border border-red-100 bg-red-50 p-3 text-sm">
                    <p className="font-semibold text-red-800">{r.sheetName}</p>
                    {r.log.map((line: string, i: number) => (
                      <p key={i} className="mt-1 text-red-700">{line}</p>
                    ))}
                  </div>
                ))}
            </div>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                const text = bulk.results
                  .filter((r: any) => r.errors > 0)
                  .map((r: any) => `${r.sheetName}:\n${r.log.join("\n")}`)
                  .join("\n\n");
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copiado!" : "Copiar erros"}
            </button>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{scan.totalSheets} ficha(s)</span>
        <span>·</span>
        <span>{scan.sheetsWithComponents} com composição</span>
        <span>·</span>
        <span>{scan.activeSheets} ativa(s)</span>
      </div>

      {/* Filter bar */}
      <Form method="get" className="flex flex-wrap items-center gap-4">
        <input type="hidden" name="filterKind" value={selectedFilter?.kind ?? ""} />
        <input type="hidden" name="rootSheetId" value={selectedFilter?.rootSheetId ?? ""} />
        <input type="hidden" name="itemId" value={selectedFilter?.itemId ?? ""} />
        <input
          type="hidden"
          name="selectedFilterLabel"
          value={selectedFilter?.label ?? ""}
        />
        <input type="hidden" name="onlyActive" value={onlyActive ? "1" : "0"} />
        <input
          type="hidden"
          name="onlyWithComponents"
          value={onlyWithComponents ? "1" : "0"}
        />

        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <SearchableSelect
            value={selectedFilterValue}
            onValueChange={setSelectedFilterValue}
            options={filterSelectOptions}
            placeholder="Selecionar ficha ou item"
            searchPlaceholder="Buscar ficha ou item..."
            emptyText="Nenhuma ficha encontrada."
            triggerClassName="h-9 w-full max-w-none justify-between rounded-md border-slate-300 bg-white pl-10 pr-3 text-sm shadow-none"
            contentClassName="w-[420px] max-w-[calc(100vw-2rem)]"
            renderOption={(option, isSelected) => {
              const kind = filterSelectOptions.find((o) => o.value === option.value)
                ?.kind;
              return (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${isSelected ? "bg-emerald-500" : "bg-transparent"
                      }`}
                  />
                  <span className="truncate">{option.label}</span>
                  {kind && option.value ? (
                    <Badge
                      variant="outline"
                      className={`ml-auto shrink-0 text-[10px] uppercase tracking-wide ${kind === "sheet"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-300 bg-amber-100 text-amber-800"
                        }`}
                    >
                      {kind === "sheet" ? "Ficha" : "Item"}
                    </Badge>
                  ) : null}
                </div>
              );
            }}
          />
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.currentTarget.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-amber-500"
          />
          Apenas ativas
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyWithComponents}
            onChange={(e) => setOnlyWithComponents(e.currentTarget.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-amber-500"
          />
          Com composição
        </label>

        <button
          type="submit"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ListFilter className="h-3.5 w-3.5" />
          filtrar
        </button>

        <Link
          to="/admin/recalculate-item-cost-sheets"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
        >
          <XCircle className="h-3.5 w-3.5" />
          limpar
        </Link>
      </Form>

      {/* Bulk action bar */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 transition-all ${selectedCount > 0
            ? "opacity-100"
            : "pointer-events-none h-0 overflow-hidden border-0 py-0 opacity-0"
          }`}
      >
        <span className="text-xs font-medium text-slate-500">
          {selectedCount} selecionada(s)
        </span>
        <Form method="post" className="flex items-center gap-2">
          <input type="hidden" name="rootSheetIds" value={selectedIds} />
          <button
            type="submit"
            disabled={submitting || selectedCount === 0}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-900 px-3 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            {submitting ? "Recalculando..." : `Recalcular (${selectedCount})`}
          </button>
        </Form>
        <button
          type="button"
          className="text-xs text-slate-400 underline hover:text-slate-600"
          onClick={() => setSelected(new Set())}
        >
          Limpar seleção
        </button>
        <button
          type="button"
          className="text-xs font-medium text-amber-700 hover:underline"
          onClick={() =>
            setSelected(
              new Set(
                sheets.filter((s) => s.componentCount > 0).map((s) => s.rootSheetId)
              )
            )
          }
        >
          Selecionar com composição
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden bg-white">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 w-12 px-4 text-slate-500">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.currentTarget.checked)
                      setSelected(new Set(sheets.map((s) => s.rootSheetId)));
                    else setSelected(new Set());
                  }}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-500"
                />
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Ficha
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Item
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                Componentes
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                Variações
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                Custo atual
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Status
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sheets.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  Nenhuma ficha encontrada para os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              sheets.map((sheet) => {
                const isSelected = selected.has(sheet.rootSheetId);
                return (
                  <TableRow
                    key={sheet.rootSheetId}
                    onClick={() => toggleSheet(sheet.rootSheetId)}
                    className={`cursor-pointer border-slate-100 transition-colors hover:bg-slate-50/50 ${isSelected ? "bg-blue-50/50" : ""
                      }`}
                  >
                    <TableCell className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSheet(sheet.rootSheetId)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-500"
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <a
                          href={`/admin/item-cost-sheets/${sheet.rootSheetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="truncate font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {sheet.sheetName}
                        </a>
                        <span className="text-xs text-slate-500">
                          ID: {sheet.rootSheetId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-slate-700">
                      {sheet.itemName}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-slate-800">
                      {sheet.componentCount}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium text-slate-800">
                      {sheet.variationCount}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <DecimalInput
                          name={`cost-${sheet.rootSheetId}`}
                          defaultValue={sheet.costAmount}
                          fractionDigits={2}
                          readOnly
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {sheet.isActive ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          Ativa
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-100 text-slate-700"
                        >
                          Inativa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div
                        className="flex items-center justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Form method="post">
                          <input
                            type="hidden"
                            name="rootSheetIds"
                            value={sheet.rootSheetId}
                          />
                          <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Recalcular
                          </button>
                        </Form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
