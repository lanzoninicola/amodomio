const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export type SupplierOrderItem = {
  itemId: string | null;
  itemName: string;
  supplierItemName?: string | null;
  unit: string | null;
  unitOptions?: string[];
  qty: string;
};

export function fmtSupplierOrderMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? BRL.format(n) : "-";
}

export function fmtSupplierOrderDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

export function buildSupplierOrderMessage(
  supplierName: string,
  items: SupplierOrderItem[]
) {
  const date = new Date().toLocaleDateString("pt-BR");
  const lines = items.map((item) => {
    const qty = item.qty.trim();
    const unit = item.unit ? ` ${item.unit}` : "";
    const itemName = String(item.supplierItemName || item.itemName).trim();
    return `- ${itemName} - ${qty}${unit}`;
  });

  return `Pedido de compra - ${supplierName}\nData: ${date}\n\n${lines.join(
    "\n"
  )}`;
}

export function parseSupplierOrderSelection(searchParams: URLSearchParams) {
  const itemIds = searchParams.getAll("itemId");
  const freeItemNames = searchParams.getAll("freeItemName");
  const qtyValues = searchParams.getAll("qty");
  const unitValues = searchParams.getAll("unit");
  const supplierItemNameValues = searchParams.getAll("supplierItemName");
  const itemCount = Math.max(itemIds.length, freeItemNames.length);

  return Array.from({ length: itemCount }, (_, index) => ({
    itemId: String(itemIds[index] || "").trim() || null,
    freeItemName: String(freeItemNames[index] || "").trim() || null,
    qty: String(qtyValues[index] || "").trim(),
    unit: String(unitValues[index] || "").trim() || null,
    supplierItemName: String(supplierItemNameValues[index] || "").trim(),
  })).filter((item) => item.itemId || item.freeItemName);
}
