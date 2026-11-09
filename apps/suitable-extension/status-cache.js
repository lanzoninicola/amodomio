const STORAGE_KEY = "kdsCardStatusCacheV1";
let writes = Promise.resolve();
function phone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}
function key(server, date, order) {
  return JSON.stringify([
    server,
    date,
    order.commandNumber,
    phone(order.customerPhone),
  ]);
}
export async function readStatusCache(server, date, orders) {
  await writes;
  const stored =
    (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
  return orders.map((order) => {
    const entry = stored[key(server, date, order)];
    return typeof entry?.exists === "boolean"
      ? { ...order, exists: entry.exists }
      : null;
  });
}
export function writeStatusCache(server, date, statuses, startedAt = Infinity) {
  const operation = writes.then(async () => {
    const stored =
      (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
    const now = Date.now();
    for (const status of statuses) {
      if (
        !/^\d{10,11}$/.test(phone(status.customerPhone)) ||
        typeof status.exists !== "boolean"
      )
        continue;
      const id = key(server, date, status);
      if (stored[id]?.updatedAt > startedAt) continue;
      stored[id] = { exists: status.exists, updatedAt: now };
    }
    const entries = Object.entries(stored)
      .filter(([, entry]) => now - entry.updatedAt < 7 * 86400000)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, 1000);
    await chrome.storage.local.set({
      [STORAGE_KEY]: Object.fromEntries(entries),
    });
  });
  writes = operation.catch(() => {});
  return operation;
}
