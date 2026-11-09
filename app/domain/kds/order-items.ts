export const KDS_PIZZA_SIZES = ["F", "M", "P", "I", "FT"] as const;
export type KdsPizzaSize = (typeof KDS_PIZZA_SIZES)[number];

/** Snapshot of the external order, without linking or creating menu items. */
export type KdsOrderItem = {
  name: string;
  quantity: number;
  size: KdsPizzaSize | null;
  flavors: string[];
  notes: string[];
};

export function parseOrderItems(value: unknown): KdsOrderItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("Informe entre 1 e 100 itens do pedido.");
  }
  const text = (value: unknown, limit: number) => {
    if (typeof value !== "string" || !value.trim() || value.length > limit) {
      throw new Error("Texto de item inválido.");
    }
    return value.trim();
  };
  const lines = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 100) {
      throw new Error("Detalhes de item inválidos.");
    }
    return value.map((line) => text(line, 1000));
  };
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Item inválido.");
    }
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 1000
    ) {
      throw new Error("Quantidade de item inválida.");
    }
    if (item.size !== null && !KDS_PIZZA_SIZES.includes(item.size)) {
      throw new Error("Tamanho de pizza inválido.");
    }
    const name = text(item.name, 300);
    if (/\bpizzas?\b/i.test(name) && item.size === null) {
      throw new Error("Confira o tamanho de todas as pizzas.");
    }
    return {
      name,
      quantity: item.quantity,
      size: item.size,
      flavors: lines(item.flavors),
      notes: lines(item.notes),
    };
  });
}

export function countOrderItemSizes(items: KdsOrderItem[]) {
  const sizes = { F: 0, M: 0, P: 0, I: 0, FT: 0 };
  for (const item of items) {
    if (item.size) sizes[item.size] += item.quantity;
  }
  return sizes;
}

export function readStoredOrderItems(value: unknown): KdsOrderItem[] {
  if (value == null) return [];
  try {
    return parseOrderItems(value);
  } catch {
    return [];
  }
}
