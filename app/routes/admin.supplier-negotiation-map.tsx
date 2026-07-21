import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Download, ExternalLink, Filter, Printer, Search } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SearchableMultiSelect } from "~/components/ui/searchable-multi-select";
import { calculateItemCostMetrics } from "~/domain/item/item-cost-metrics.server";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Admin | Mapa de negociação de insumos" },
];

const REPORT_WINDOW_DAYS = 90;
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type NegotiationRow = {
  id: string;
  name: string;
  classification: string;
  category: { id: string; name: string } | null;
  unit: string | null;
  averageCost90Days: number | null;
  latestCost: number | null;
  latestCostDate: string | null;
  samplesCount: number;
  purchaseSuppliers: { id: string; name: string }[];
};

async function loadNegotiationReport(
  selectedSupplierIds: string[],
  selectedCategoryIds: string[],
  hideWithoutHistory: boolean
) {
  const items = await prismaClient.item.findMany({
    where: {
      active: true,
      canPurchase: true,
      classification: { not: "semi_acabado" },
      ...(selectedCategoryIds.length > 0
        ? { categoryId: { in: selectedCategoryIds } }
        : {}),
      ...(selectedSupplierIds.length > 0
        ? {
            StockMovement: {
              some: {
                supplierId: { in: selectedSupplierIds },
                direction: "entry",
                deletedAt: null,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      classification: true,
      Category: { select: { id: true, name: true } },
      purchaseUm: true,
      consumptionUm: true,
      purchaseToConsumptionFactor: true,
      ItemPurchaseConversion: {
        select: { purchaseUm: true, factor: true },
      },
      ItemVariation: {
        where: { deletedAt: null },
        orderBy: [{ isReference: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          ItemCostVariationHistory: {
            orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
            take: 500,
            select: {
              costAmount: true,
              unit: true,
              validFrom: true,
              createdAt: true,
              source: true,
              metadata: true,
            },
          },
        },
      },
      StockMovement: {
        where: {
          supplierId: { in: selectedSupplierIds },
          direction: "entry",
          deletedAt: null,
        },
        select: {
          supplierId: true,
          Supplier: { select: { name: true } },
        },
        distinct: ["supplierId"],
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const rows: NegotiationRow[] = items.map((item) => {
    const history = item.ItemVariation[0]?.ItemCostVariationHistory ?? [];
    const metrics = calculateItemCostMetrics({
      item,
      history,
      averageWindowDays: REPORT_WINDOW_DAYS,
    });
    const latestDate =
      metrics.latestCost?.validFrom ?? metrics.latestCost?.createdAt ?? null;

    return {
      id: item.id,
      name: item.name,
      classification: item.classification,
      category: item.Category,
      unit: item.consumptionUm ?? item.purchaseUm ?? null,
      averageCost90Days: metrics.averageCostPerConsumptionUnit,
      latestCost: metrics.latestCostPerConsumptionUnit,
      latestCostDate: latestDate ? new Date(latestDate).toISOString() : null,
      samplesCount: metrics.averageSamplesCount,
      purchaseSuppliers: item.StockMovement.flatMap((movement) =>
        movement.supplierId && movement.Supplier
          ? [{ id: movement.supplierId, name: movement.Supplier.name }]
          : []
      ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    };
  });
  const filteredRows = hideWithoutHistory
    ? rows.filter((row) => row.latestCost != null)
    : rows;

  return {
    generatedAt: new Date().toISOString(),
    windowDays: REPORT_WINDOW_DAYS,
    selectedSupplierIds,
    selectedCategoryIds,
    hideWithoutHistory,
    rows: filteredRows,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const requestedSupplierIds = [
    ...new Set(url.searchParams.getAll("supplierId").filter(Boolean)),
  ];
  const requestedCategoryIds = [
    ...new Set(url.searchParams.getAll("categoryId").filter(Boolean)),
  ];
  const hideWithoutHistory = url.searchParams.get("hideWithoutHistory") === "1";
  const [suppliers, categories] = await Promise.all([
    prismaClient.supplier.findMany({
      where: {
        StockMovement: { some: { direction: "entry", deletedAt: null } },
      },
      select: { id: true, name: true, cnpj: true },
      orderBy: [{ name: "asc" }],
    }),
    prismaClient.category.findMany({
      where: {
        Items: {
          some: {
            active: true,
            canPurchase: true,
            classification: { not: "semi_acabado" },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);
  const validSupplierIds = new Set(suppliers.map((supplier) => supplier.id));
  const selectedSupplierIds = requestedSupplierIds.filter((id) =>
    validSupplierIds.has(id)
  );
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const selectedCategoryIds = requestedCategoryIds.filter((id) =>
    validCategoryIds.has(id)
  );

  return defer({
    suppliers,
    categories,
    selectedSupplierIds,
    selectedCategoryIds,
    payload: loadNegotiationReport(
      selectedSupplierIds,
      selectedCategoryIds,
      hideWithoutHistory
    ),
  });
}

function formatMoney(value: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : BRL.format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Report({
  report,
  suppliers,
  categories,
}: {
  report: Awaited<ReturnType<typeof loadNegotiationReport>>;
  suppliers: { id: string; name: string; cnpj: string | null }[];
  categories: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState(
    report.selectedSupplierIds
  );
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(report.rows.map((row) => row.id))
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(
    report.selectedCategoryIds
  );
  const [hideWithoutHistory, setHideWithoutHistory] = useState(
    report.hideWithoutHistory
  );
  const navigation = useNavigation();
  const appliedFilterKey = `${report.selectedSupplierIds.join(
    "|"
  )}::${report.selectedCategoryIds.join("|")}::${report.hideWithoutHistory}`;

  useEffect(() => {
    setSelectedSupplierIds(report.selectedSupplierIds);
    setSelectedCategoryIds(report.selectedCategoryIds);
    setHideWithoutHistory(report.hideWithoutHistory);
    setSelectedItemIds(new Set(report.rows.map((row) => row.id)));
    // O conteúdo do filtro aplicado, e não a identidade dos arrays serializados,
    // define quando a seleção deve ser reiniciada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilterKey]);

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const rows = useMemo(
    () =>
      report.rows.filter((row) =>
        `${row.name} ${row.classification} ${row.category?.name ?? ""} ${
          row.unit ?? ""
        }`
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedQuery)
      ),
    [normalizedQuery, report.rows]
  );
  const activeSuppliers = suppliers.filter((supplier) =>
    report.selectedSupplierIds.includes(supplier.id)
  );
  const activeCategories = categories.filter((category) =>
    report.selectedCategoryIds.includes(category.id)
  );
  const selectedRows = rows.filter((row) => selectedItemIds.has(row.id));

  const exportPayload = useMemo(
    () => ({
      schemaVersion: 1,
      report: "supplier_input_negotiation",
      title: "Mapa de negociação de insumos",
      purpose:
        "Comparar custos históricos de insumos para apoiar uma negociação de preços com fornecedores.",
      generatedAt: report.generatedAt,
      currency: "BRL",
      averageWindowDays: report.windowDays,
      filters: {
        search: query.trim() || null,
        suppliers: activeSuppliers.map(({ id, name }) => ({ id, name })),
        categories: activeCategories.map(({ id, name }) => ({ id, name })),
        hideWithoutHistory: report.hideWithoutHistory,
      },
      fieldGuide: {
        unit: "Unidade de consumo usada para comparar os custos.",
        averageCost90Days:
          "Média aritmética dos custos normalizados registrados nos últimos 90 dias.",
        latestCost: "Custo mais recente normalizado para a unidade de consumo.",
        latestCostDate: "Data de vigência do custo mais recente.",
        samplesCount:
          "Quantidade de registros válidos usados na média de 90 dias.",
        purchaseSuppliers:
          "Fornecedores selecionados com compras registradas para o insumo.",
      },
      items: selectedRows,
    }),
    [
      activeSuppliers,
      activeCategories,
      query,
      report.generatedAt,
      report.windowDays,
      selectedRows,
    ]
  );

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.id,
    label: supplier.name,
    searchText: `${supplier.name} ${supplier.cnpj ?? ""}`,
  }));
  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
    searchText: category.name,
  }));

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectVisibleItems() {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      rows.forEach((row) => next.add(row.id));
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <Form
        method="get"
        className="print:hidden flex flex-col gap-2 border-b border-slate-200 pb-3 xl:flex-row xl:items-center"
      >
        {selectedSupplierIds.map((supplierId) => (
          <input
            key={supplierId}
            type="hidden"
            name="supplierId"
            value={supplierId}
          />
        ))}
        {selectedCategoryIds.map((categoryId) => (
          <input
            key={categoryId}
            type="hidden"
            name="categoryId"
            value={categoryId}
          />
        ))}
        <div className="flex min-w-0 flex-[1.35] items-center gap-1.5">
          <label className="block min-w-0 flex-1">
            <span className="sr-only">Fornecedores de compra</span>
            <SearchableMultiSelect
              values={selectedSupplierIds}
              onValuesChange={setSelectedSupplierIds}
              options={supplierOptions}
              placeholder="Todos os fornecedores"
              searchPlaceholder="Buscar fornecedor..."
              emptyText="Nenhum fornecedor encontrado."
              triggerClassName="!min-h-9 rounded-md bg-white py-1"
              contentClassName="w-[var(--radix-popover-trigger-width)]"
              summarizeSelection
            />
          </label>
          <label className="block min-w-0 flex-1">
            <span className="sr-only">Categorias de produtos</span>
            <SearchableMultiSelect
              values={selectedCategoryIds}
              onValuesChange={setSelectedCategoryIds}
              options={categoryOptions}
              placeholder="Todas as categorias"
              searchPlaceholder="Buscar categoria..."
              emptyText="Nenhuma categoria encontrada."
              triggerClassName="!min-h-9 rounded-md bg-white py-1"
              contentClassName="w-[var(--radix-popover-trigger-width)]"
              summarizeSelection
            />
          </label>
          <label className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-600">
            <input
              type="checkbox"
              name="hideWithoutHistory"
              value="1"
              checked={hideWithoutHistory}
              onChange={(event) => setHideWithoutHistory(event.target.checked)}
            />
            Ocultar sem histórico
          </label>
          {report.selectedSupplierIds.length > 0 ||
          report.selectedCategoryIds.length > 0 ||
          report.hideWithoutHistory ? (
            <Link
              to="/admin/supplier-negotiation-map"
              className="inline-flex h-9 shrink-0 items-center px-2 text-xs font-medium text-slate-600 hover:text-slate-950"
            >
              Limpar
            </Link>
          ) : null}
          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-950 px-4 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Filter className="h-4 w-4" />
            {navigation.state === "loading" ? "Filtrando…" : "Aplicar filtro"}
          </button>
        </div>

        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar insumo, classificação ou unidade"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </label>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            aria-label="Exportar JSON"
            title="Exportar JSON"
            disabled={selectedRows.length === 0}
            onClick={() =>
              downloadJson(
                `mapa-negociacao-insumos-${new Date()
                  .toISOString()
                  .slice(0, 10)}.json`,
                exportPayload
              )
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Imprimir"
            title="Imprimir"
            disabled={selectedRows.length === 0}
            onClick={() => window.print()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </Form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          {selectedRows.length} selecionado
          {selectedRows.length === 1 ? "" : "s"} · {rows.length} de{" "}
          {report.rows.length} insumos
          {activeSuppliers.length > 0
            ? ` · ${activeSuppliers
                .map((supplier) => supplier.name)
                .join(", ")}`
            : ""}
          {activeCategories.length > 0
            ? ` · ${activeCategories.length} categoria${
                activeCategories.length === 1 ? "" : "s"
              }`
            : ""}
          {report.hideWithoutHistory ? " · somente com histórico" : ""}
        </div>
        <div className="print:hidden flex gap-3">
          <button
            type="button"
            onClick={selectVisibleItems}
            className="text-slate-600 hover:text-slate-950"
          >
            Selecionar visíveis
          </button>
          <button
            type="button"
            onClick={() => setSelectedItemIds(new Set())}
            className="text-slate-600 hover:text-slate-950"
          >
            Limpar seleção
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 print:overflow-visible print:rounded-none">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="print:hidden w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os resultados visíveis"
                  checked={
                    rows.length > 0 &&
                    rows.every((row) => selectedItemIds.has(row.id))
                  }
                  onChange={(event) => {
                    if (event.target.checked) selectVisibleItems();
                    else {
                      setSelectedItemIds((current) => {
                        const next = new Set(current);
                        rows.forEach((row) => next.delete(row.id));
                        return next;
                      });
                    }
                  }}
                />
              </th>
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3 text-right">Média 3 meses</th>
              <th className="px-4 py-3 text-right">Último custo</th>
              <th className="px-4 py-3 text-right">Data</th>
              <th className="print:hidden px-4 py-3 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`break-inside-avoid ${
                  selectedItemIds.has(row.id) ? "" : "print:hidden"
                }`}
              >
                <td className="print:hidden px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${row.name}`}
                    checked={selectedItemIds.has(row.id)}
                    onChange={() => toggleItem(row.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/items/${row.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-slate-950 underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    {row.category ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 print:border print:border-slate-300 print:bg-transparent">
                        {row.category.name}
                      </span>
                    ) : null}
                    <span>
                      {row.classification} · {row.samplesCount} registro
                      {row.samplesCount === 1 ? "" : "s"} na média
                    </span>
                  </div>
                  {row.purchaseSuppliers.length > 0 ? (
                    <div className="mt-1 text-xs text-slate-500">
                      Comprado de:{" "}
                      {row.purchaseSuppliers.map(({ name }) => name).join(", ")}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.unit ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {formatMoney(row.averageCost90Days)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {formatMoney(row.latestCost)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {formatDate(row.latestCostDate)}
                </td>
                <td className="print:hidden px-4 py-3 text-right">
                  <Link
                    to={`/admin/items/${row.id}/costs`}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-950"
                  >
                    Histórico <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Nenhum insumo encontrado para os fornecedores selecionados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SupplierNegotiationMapRoute() {
  const { payload, suppliers, categories } = useLoaderData<typeof loader>();

  return (
    <main
      id="supplier-negotiation-print-root"
      className="mx-auto w-full max-w-7xl px-4 py-4 print:max-w-none print:px-0 print:py-0"
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; }
          body > * header,
          body > * footer,
          [data-sidebar="sidebar"],
          [data-sidebar="trigger"] {
            display: none !important;
          }
          [data-element="outer-div-admin-outlet"] {
            margin: 0 !important;
            padding: 0 !important;
          }
          #supplier-negotiation-print-root {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
          }
          #supplier-negotiation-print-root > .supplier-negotiation-print-header {
            display: flex !important;
          }
          #supplier-negotiation-print-root thead {
            display: table-header-group;
          }
        }
      `}</style>
      <header className="supplier-negotiation-print-header mb-3 flex flex-col gap-1 border-b border-slate-200 pb-3 lg:flex-row lg:items-baseline lg:gap-4">
        <h1 className="shrink-0 text-xl font-semibold tracking-tight text-slate-950">
          Mapa de negociação de insumos
        </h1>
        <p className="max-w-3xl text-xs text-slate-500">
          Custos normalizados por unidade de consumo para comparar propostas de
          fornecedores. A média considera os últimos três meses.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-slate-500">
            Carregando custos dos insumos…
          </div>
        }
      >
        <Await
          resolve={payload}
          errorElement={
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar o mapa de negociação.
            </div>
          }
        >
          {(report) => (
            <Report
              report={report}
              suppliers={suppliers}
              categories={categories}
            />
          )}
        </Await>
      </Suspense>
    </main>
  );
}
