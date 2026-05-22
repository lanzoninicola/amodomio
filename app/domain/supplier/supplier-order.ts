const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export type SupplierOrderItem = {
  itemId: string;
  itemName: string;
  unit: string | null;
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

export function buildSupplierOrderMessage(supplierName: string, items: SupplierOrderItem[]) {
  const date = new Date().toLocaleDateString("pt-BR");
  const lines = items.map((item) => {
    const qty = item.qty.trim();
    const unit = item.unit ? ` ${item.unit}` : "";
    return `- ${item.itemName} - ${qty}${unit}`;
  });

  return `Pedido de compra - ${supplierName}\nData: ${date}\n\n${lines.join("\n")}`;
}

export function parseSupplierOrderSelection(searchParams: URLSearchParams) {
  const itemIds = searchParams.getAll("itemId").map((value) => value.trim()).filter(Boolean);
  const qtyValues = searchParams.getAll("qty");
  const unitValues = searchParams.getAll("unit");

  return itemIds.map((itemId, index) => ({
    itemId,
    qty: String(qtyValues[index] || "").trim(),
    unit: String(unitValues[index] || "").trim() || null,
  }));
}

