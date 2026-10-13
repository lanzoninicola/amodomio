type Purchase = {
  date: string;
  total: number;
  active: boolean;
  items: { quantity: number; flavors: string[] }[];
};
export function summarizePurchaseHistory(orders: Purchase[]) {
  const active = orders.filter((order) => order.active);
  const flavors = new Map<
    string,
    { name: string; occurrences: number; orders: number }
  >();
  for (const order of active) {
    const seen = new Set<string>();
    for (const item of order.items) {
      const unique = new Map<string, string>();
      for (const raw of item.flavors) {
        const name = raw
          .replace(/^\s*\d+\s*[x×]\s*/i, "")
          .trim()
          .replace(/\s+/g, " ");
        if (name) unique.set(name.toLocaleLowerCase("pt-BR"), name);
      }
      for (const [key, name] of unique) {
        const entry = flavors.get(key) || { name, occurrences: 0, orders: 0 };
        entry.occurrences += item.quantity;
        if (!seen.has(key)) entry.orders++;
        seen.add(key);
        flavors.set(key, entry);
      }
    }
  }
  const revenue = active.reduce((sum, order) => sum + order.total, 0);
  const dates = active.map((order) => order.date).sort();
  return {
    orders: active.length,
    revenue,
    average: active.length ? revenue / active.length : 0,
    first: dates[0] ?? null,
    last: dates.at(-1) ?? null,
    flavors: [...flavors.values()].sort(
      (a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name)
    ),
  };
}
