import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { Check, Minus, Package, Plus, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  fmtSupplierOrderDate,
  fmtSupplierOrderMoney,
  parseSupplierOrderSelection,
} from "~/domain/supplier/supplier-order";
import {
  getSupplierPurchaseOrder,
  listSupplierOrderProducts,
} from "~/domain/supplier/supplier-order.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const supplierId = String(params.supplierId || "");
  const result = await listSupplierOrderProducts(supplierId);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const order = orderId ? await getSupplierPurchaseOrder(orderId) : null;
  const selection =
    order?.supplierId === supplierId
      ? order.Items.map((item: any) => ({
          itemId: item.itemId,
          qty: String(item.quantity),
          unit: item.unit,
          supplierItemName: item.supplierItemName || item.Item?.name || "",
        }))
      : parseSupplierOrderSelection(url.searchParams);
  return ok({ supplierId, orderId: order?.id || null, selection, ...result });
}

type ProductSelection = { qty: string; unit: string; supplierItemName: string };

export default function AdminMobilePedidoFornecedorProdutos() {
  const { payload } = useLoaderData<typeof loader>();
  const {
    supplier,
    itemRows,
    globalUnitOptions,
    supplierId,
    orderId,
    selection,
  } = payload as any;
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";
  const [itemQuery, setItemQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<
    Record<string, ProductSelection>
  >(() => {
    const rowsById = new Map(
      (itemRows as any[]).map((row) => [row.itemId, row])
    );
    return Object.fromEntries(
      (selection as any[])
        .map((entry) => {
          const row = rowsById.get(entry.itemId);
          const unitOptions = getRowUnitOptions(row, globalUnitOptions);
          if (!row || unitOptions.length === 0) return null;
          const requestedUnit = String(entry.unit || "").toUpperCase();
          const defaultUnit = unitOptions.includes(
            String(row.lastPurchaseUnit || "").toUpperCase()
          )
            ? String(row.lastPurchaseUnit).toUpperCase()
            : unitOptions[0];
          return [
            entry.itemId,
            {
              qty: entry.qty || "1",
              unit: unitOptions.includes(requestedUnit)
                ? requestedUnit
                : defaultUnit,
              supplierItemName:
                String(entry.supplierItemName || "").trim() || row.itemName,
            },
          ];
        })
        .filter(Boolean)
    );
  });

  const visibleItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    if (!query) return itemRows as any[];
    return (itemRows as any[]).filter((row) =>
      String(row.itemName || "")
        .toLowerCase()
        .includes(query)
    );
  }, [itemQuery, itemRows]);

  function toggleItem(itemId: string) {
    const row = (itemRows as any[]).find((item) => item.itemId === itemId);
    const unitOptions = getRowUnitOptions(row, globalUnitOptions);
    if (!row || unitOptions.length === 0) return;

    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        const lastPurchaseUnit = String(
          row.lastPurchaseUnit || ""
        ).toUpperCase();
        next[itemId] = {
          qty: "1",
          unit: unitOptions.includes(lastPurchaseUnit)
            ? lastPurchaseUnit
            : unitOptions[0],
          supplierItemName: row.itemName,
        };
      }
      return next;
    });
  }

  function updateSelection(itemId: string, patch: Partial<ProductSelection>) {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  }

  function changeQuantity(itemId: string, delta: number) {
    const current = Number(
      String(selectedItems[itemId]?.qty || "0").replace(",", ".")
    );
    updateSelection(itemId, {
      qty: String(
        Math.max(1, (Number.isFinite(current) ? current : 0) + delta)
      ),
    });
  }

  const selectedCount = Object.keys(selectedItems).length;

  if (!supplier) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <p>Fornecedor não encontrado.</p>
        <Link
          to="/admin/mobile/pedido-fornecedor"
          className="font-semibold underline underline-offset-2"
        >
          Selecionar outro fornecedor
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fornecedor
          </p>
          <p className="text-base font-semibold text-slate-900">
            {supplier.name}
          </p>
          {supplier.phoneNumber ? (
            <p className="text-xs text-slate-500">{supplier.phoneNumber}</p>
          ) : null}
        </div>
        <Link
          to="/admin/mobile/pedido-fornecedor"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          Trocar
        </Link>
      </div>

      {itemRows.length > 0 ? (
        <>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={itemQuery}
              onChange={(event) => setItemQuery(event.target.value)}
              placeholder="Buscar produto..."
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-slate-900"
            />
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            {visibleItems.length}{" "}
            {visibleItems.length === 1 ? "produto" : "produtos"} de{" "}
            <span className="font-semibold text-slate-900">
              {supplier.name}
            </span>
          </p>

          <Form
            method="post"
            action="/admin/mobile/pedido-fornecedor"
            className="space-y-2"
          >
            <input type="hidden" name="_intent" value="save-order" />
            <input type="hidden" name="supplierId" value={supplierId} />
            {orderId ? (
              <input type="hidden" name="orderId" value={orderId} />
            ) : null}
            {Object.entries(selectedItems).map(([itemId, item]) => (
              <div key={itemId}>
                <input type="hidden" name="itemId" value={itemId} />
                <input type="hidden" name="qty" value={item.qty} />
                <input type="hidden" name="unit" value={item.unit} />
                <input
                  type="hidden"
                  name="supplierItemName"
                  value={item.supplierItemName}
                />
              </div>
            ))}

            {visibleItems.map((row: any) => {
              const selected = selectedItems[row.itemId];
              const isSelected = Boolean(selected);
              const unitGroups = getUnitOptionGroups(row, globalUnitOptions);
              const unitOptions = flattenUnitOptionGroups(unitGroups);
              const hasAvailableUnits = unitOptions.length > 0;
              return (
                <article
                  key={row.itemId}
                  onClick={() => toggleItem(row.itemId)}
                  className={`rounded-xl border bg-white px-4 py-3 transition-colors ${
                    hasAvailableUnits ? "cursor-pointer" : "opacity-60"
                  } ${
                    isSelected
                      ? "border-green-500 bg-green-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center">
                        <Link
                          to={`/admin/items/${row.itemId}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-sm font-semibold leading-tight text-slate-900 underline-offset-2 hover:underline"
                        >
                          {row.itemName}
                        </Link>
                      </div>
                      {row.otherSupplierCosts?.length > 0 ? (
                        <div className="mt-1.5 space-y-0.5">
                          {row.otherSupplierCosts.map((other: any) => (
                            <div
                              key={other.supplierName}
                              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[10px] leading-tight text-slate-500"
                            >
                              <span className="truncate font-medium text-slate-600">
                                {other.supplierName}
                              </span>
                              <span className="text-right tabular-nums">
                                {fmtSupplierOrderMoney(other.costAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Última compra:{" "}
                        {fmtSupplierOrderDate(row.lastMovementAt)}
                        {row.totalMovements > 1 ? (
                          <span className="ml-2 text-slate-300">
                            · {row.totalMovements}x
                          </span>
                        ) : null}
                      </p>
                      {!hasAvailableUnits ? (
                        <p className="mt-1 text-[11px] font-medium text-amber-700">
                          Sem UM disponível
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-start gap-2">
                      <div className="text-right">
                        <p className="text-base font-bold leading-none text-slate-900">
                          {fmtSupplierOrderMoney(row.lastCost)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {row.consumptionUm || row.lastCostUnit || ""}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </div>
                  </div>

                  {selected ? (
                    <div
                      className="mt-3 grid grid-cols-[104px_minmax(0,1fr)] gap-2 border-t border-green-200 pt-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          UM
                        </span>
                        <Select
                          value={selected.unit}
                          onValueChange={(unit) =>
                            updateSelection(row.itemId, {
                              unit,
                            })
                          }
                        >
                          <SelectTrigger className="h-11 min-w-0 rounded-xl border-slate-300 bg-white px-2 text-sm font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="end">
                            {unitGroups.lastPurchase.map((unit: string) => (
                              <SelectItem
                                key={unit}
                                value={unit}
                                className="py-3 text-base"
                              >
                                {unit}
                              </SelectItem>
                            ))}
                            {needsUnitSeparator(
                              unitGroups.lastPurchase,
                              unitGroups.itemUnits,
                              unitGroups.globalUnits
                            ) ? (
                              <SelectSeparator />
                            ) : null}
                            {unitGroups.itemUnits.map((unit: string) => (
                              <SelectItem
                                key={unit}
                                value={unit}
                                className="py-3 text-base"
                              >
                                {unit}
                              </SelectItem>
                            ))}
                            {unitGroups.itemUnits.length > 0 &&
                            unitGroups.globalUnits.length > 0 ? (
                              <SelectSeparator />
                            ) : null}
                            {unitGroups.globalUnits.map((unit: string) => (
                              <SelectItem
                                key={unit}
                                value={unit}
                                className="py-3 text-base"
                              >
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0">
                        <span className="mb-1 block text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Quantidade
                        </span>
                        <div className="ml-auto flex h-11 min-w-0 items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={selected.qty}
                            onChange={(event) =>
                              updateSelection(row.itemId, {
                                qty: event.target.value,
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent text-center text-base font-semibold outline-none"
                            aria-label={`Quantidade de ${row.itemName}`}
                          />
                          <button
                            type="button"
                            onClick={() => changeQuantity(row.itemId, -1)}
                            className="flex h-full w-10 shrink-0 items-center justify-center text-slate-700"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => changeQuantity(row.itemId, 1)}
                            className="flex h-full w-10 shrink-0 items-center justify-center text-slate-700"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <label className="col-span-2 block min-w-0">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Nome no fornecedor
                        </span>
                        <input
                          type="text"
                          value={selected.supplierItemName}
                          onChange={(event) =>
                            updateSelection(row.itemId, {
                              supplierItemName: event.target.value,
                            })
                          }
                          className="h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
                          aria-label={`Nome no fornecedor para ${row.itemName}`}
                        />
                      </label>
                    </div>
                  ) : null}
                </article>
              );
            })}

            {selectedCount > 0 ? (
              <div className="sticky bottom-4 z-10 flex justify-center">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-xl"
                >
                  <Send className="h-4 w-4" />
                  {orderId ? "Salvar pedido" : "Criar pedido"} ({selectedCount}{" "}
                  {selectedCount === 1 ? "item" : "itens"})
                </button>
              </div>
            ) : null}
          </Form>
        </>
      ) : !isLoading ? (
        <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
          <Package size={32} strokeWidth={1.5} />
          <p className="text-sm">
            Nenhuma entrada encontrada para este fornecedor.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function getRowUnitOptions(row: any, globalUnitOptions: string[] = []) {
  if (!row) return [];
  return flattenUnitOptionGroups(getUnitOptionGroups(row, globalUnitOptions));
}

function getUnitOptionGroups(row: any, globalUnitOptions: string[] = []) {
  if (!row) {
    return { lastPurchase: [], itemUnits: [], globalUnits: [] };
  }

  const seen = new Set<string>();
  const lastPurchase = addUniqueUnits(
    [row.lastPurchaseUnit].filter(Boolean),
    seen
  );
  const itemUnits = addUniqueUnits(row.linkedUnitOptions || [], seen);
  const globalUnits = addUniqueUnits(globalUnitOptions || [], seen);

  return { lastPurchase, itemUnits, globalUnits };
}

function addUniqueUnits(units: string[], seen: Set<string>) {
  const result: string[] = [];
  for (const unit of units) {
    const normalized = normalizeUnit(unit);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function flattenUnitOptionGroups(groups: {
  lastPurchase: string[];
  itemUnits: string[];
  globalUnits: string[];
}) {
  return [...groups.lastPurchase, ...groups.itemUnits, ...groups.globalUnits];
}

function needsUnitSeparator(
  firstGroup: string[],
  secondGroup: string[],
  thirdGroup: string[]
) {
  return (
    firstGroup.length > 0 && (secondGroup.length > 0 || thirdGroup.length > 0)
  );
}

function normalizeUnit(unit: unknown) {
  return String(unit || "")
    .trim()
    .toUpperCase();
}
