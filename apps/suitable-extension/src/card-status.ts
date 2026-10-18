type Identity = {
  commandNumber: number;
  date: string;
  customerPhone?: string;
};
type State = "unknown" | "sending" | "sent" | "missing" | "failed";
const states = new Map<
  string,
  { state: State; date: string; checkedAt: number; error?: string }
>();
type Candidate = { commandNumber: number; customerPhone: string };
type StatusResponse = {
  ok: boolean;
  date?: string;
  error?: string;
  statuses?: (Candidate & { exists: boolean })[];
};
let queryStatuses:
  | ((
      date: string,
      orders: Candidate[],
      force: boolean
    ) => Promise<StatusResponse>)
  | undefined;
const visibleOrders = new Map<string, Candidate>();
const forcedChecks = new Set<string>();
let checkingBatch = false;
let checkTimer: ReturnType<typeof setTimeout> | undefined;
function today() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function configureCardStatusChecks(query: typeof queryStatuses) {
  queryStatuses = query;
  window.addEventListener(
    "scroll",
    () => {
      if (!document.hidden && indicatorsEnabled) scanCardStatuses();
    },
    { capture: true, passive: true }
  );
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && indicatorsEnabled) scanCardStatuses();
  });
}
function scheduleChecks() {
  if (
    !queryStatuses ||
    checkingBatch ||
    checkTimer ||
    !indicatorsEnabled ||
    document.hidden
  )
    return;
  const date = today();
  const due = [...visibleOrders]
    .filter(([key]) => {
      const current = states.get(`${date}:${key}`);
      return (
        current?.state !== "sending" && (!current || forcedChecks.has(key))
      );
    })
    .slice(0, 50);
  if (!due.length) return;
  checkTimer = setTimeout(async () => {
    checkTimer = undefined;
    if (!indicatorsEnabled || document.hidden || !queryStatuses) return;
    // Re-read the visible cards after the debounce, including recycled list rows.
    const batch = due.filter(([key]) => {
      const current = states.get(`${date}:${key}`);
      return (
        visibleOrders.has(key) &&
        current?.state !== "sending" &&
        (!current || forcedChecks.has(key))
      );
    });
    if (!batch.length) return;
    const snapshots = new Map(
      batch.map(([key]) => [key, states.get(`${date}:${key}`)])
    );
    checkingBatch = true;
    try {
      const result = await queryStatuses(
        date,
        batch.map(([, order]) => order),
        batch.some(([key]) => forcedChecks.has(key))
      );
      if (!result.ok || result.date !== date || !result.statuses)
        throw new Error(
          result.error ||
            "Consulta automática indisponível. Confira a conexão e a versão do servidor."
        );
      for (const [key, order] of batch) {
        if (states.get(`${date}:${key}`) !== snapshots.get(key)) continue;
        const status = result.statuses.find(
          (item) =>
            phoneKey(item.commandNumber, item.customerPhone) ===
            phoneKey(order.commandNumber, order.customerPhone)
        );
        states.set(`${date}:${key}`, {
          state: status ? (status.exists ? "sent" : "missing") : "unknown",
          date,
          checkedAt: Date.now(),
        });
      }
    } catch (error) {
      for (const [key] of batch) {
        if (states.get(`${date}:${key}`) !== snapshots.get(key)) continue;
        states.set(`${date}:${key}`, {
          state: "unknown",
          date,
          checkedAt: Date.now(),
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível consultar o KDS.",
        });
      }
    } finally {
      for (const [key] of batch) forcedChecks.delete(key);
      checkingBatch = false;
      scanCardStatuses();
    }
  }, 400);
}
const labels: Record<State, string> = {
  unknown: "Aguardando verificação do KDS",
  sending: "Enviando ao KDS…",
  sent: "Envio ao KDS confirmado pelo servidor",
  missing: "Não enviado ao KDS",
  failed: "Falha no envio ao KDS — confira os detalhes",
};
const colors: Record<State, string> = {
  unknown: "#64748b",
  sending: "#a16207",
  sent: "#15803d",
  missing: "#b91c1c",
  failed: "#b91c1c",
};
const surfaces: Record<State, { background: string; border: string }> = {
  unknown: { background: "#f1f5f9", border: "#cbd5e1" },
  sending: { background: "#fffbeb", border: "#fde68a" },
  sent: { background: "#f0fdf4", border: "#bbf7d0" },
  missing: { background: "#fef2f2", border: "#fecaca" },
  failed: { background: "#fef2f2", border: "#fecaca" },
};
const phoneKey = (number: number, phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const local =
    digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return local.length >= 10 ? `${number}:phone:${local}` : null;
};
export function updateCardStatus(order: Identity, state: State) {
  const result = { state, date: order.date, checkedAt: Date.now() };
  const phone = phoneKey(order.commandNumber, order.customerPhone || "");
  if (phone) states.set(`${order.date}:${phone}`, result);
  scanCardStatuses();
}
let indicatorsEnabled = false;
export function scanCardStatuses(enabled = indicatorsEnabled) {
  indicatorsEnabled = enabled;
  visibleOrders.clear();
  if (!enabled) {
    document
      .querySelectorAll("[data-amodomio-card-status]")
      .forEach((element) => element.remove());
    return;
  }
  // Use semantic card content, never Suitable's generated jss class names.
  for (const heading of document.querySelectorAll("h6")) {
    const match = heading.textContent?.trim().match(/^#\s*(\d+)$/);
    if (!match || heading.closest('[role="dialog"]')) continue;
    const header = heading.closest(".MuiPaper-root");
    const card = header?.parentElement;
    if (!header || !card || !/Ações/.test(header.textContent || "")) continue;
    let badge = header.querySelector<HTMLElement>(
      "[data-amodomio-card-status]"
    );
    if (!badge) {
      const actions = [...header.querySelectorAll("span")].find(
        (element) => element.textContent?.trim() === "Ações"
      );
      const slot = actions?.parentElement?.parentElement;
      if (!slot) continue;
      badge = document.createElement("button");
      (badge as HTMLButtonElement).type = "button";
      badge.dataset.amodomioCardStatus = "true";
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const key = badge!.dataset.orderKey;
        if (!key || checkingBatch) return;
        forcedChecks.add(key);
        scheduleChecks();
      });
      badge.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;gap:4px;box-sizing:border-box;height:22px;padding:0 7px;border:1px solid;border-radius:999px;white-space:nowrap;font:700 10px/1 sans-serif;letter-spacing:0.2px;margin-right:8px;flex-shrink:0;vertical-align:middle;cursor:pointer";
      slot.style.display = "flex";
      slot.style.alignItems = "center";
      slot.prepend(badge);
    }
    const number = Number(match[1]);
    const phoneText = [...card.querySelectorAll("span, p")]
      .map((element) => element.textContent?.trim() || "")
      .find((text) =>
        /^(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}$/.test(text)
      );
    const phone = phoneKey(number, phoneText || "");
    if (
      phone &&
      card.getClientRects().length &&
      card.getBoundingClientRect().bottom > 0 &&
      card.getBoundingClientRect().top < window.innerHeight
    ) {
      visibleOrders.set(phone, {
        commandNumber: number,
        customerPhone: phoneText!,
      });
    }
    badge.dataset.orderKey = phone || "";
    (badge as HTMLButtonElement).disabled = !phone || checkingBatch;
    // Include the date so yesterday's cache never colors today's orders.
    const result = phone ? states.get(`${today()}:${phone}`) : undefined;
    const state = result?.state || "unknown";
    const label =
      (result?.error ||
        (phone
          ? labels[state]
          : "Telefone ausente — não foi possível verificar o KDS")) +
      (result ? ` (${result.date})` : "") +
      " — Clique para verificar novamente";
    if (badge.title === label) continue;
    badge.title = label;
    badge.setAttribute("aria-label", label);
    badge.dataset.state = state;
    badge.style.color = colors[state];
    badge.style.backgroundColor = surfaces[state].background;
    badge.style.borderColor = surfaces[state].border;
    badge.replaceChildren();
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;width:10px;height:10px;font:700 12px/1 sans-serif";
    dot.textContent =
      state === "sent"
        ? "✓"
        : state === "unknown"
        ? "?"
        : state === "sending"
        ? "…"
        : "!";
    badge.append(dot, document.createTextNode("KDS"));
  }
  scheduleChecks();
}
