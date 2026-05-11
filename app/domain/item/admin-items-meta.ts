import type { MetaFunction } from "@remix-run/node";

type MetaArgs = Parameters<MetaFunction>[0];
type MetaMatches = MetaArgs["matches"];

function getPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const payload = (data as Record<string, unknown>).payload;
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
}

function getItemNameFromPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const item = payload.item;
  if (!item || typeof item !== "object") return null;
  const name = (item as Record<string, unknown>).name;
  const normalized = String(name || "").trim();
  return normalized || null;
}

export function getAdminItemNameFromMatches(matches: MetaMatches | undefined): string | null {
  if (!Array.isArray(matches)) return null;

  for (const match of [...matches].reverse()) {
    const itemName = getItemNameFromPayload(getPayload(match.data));
    if (itemName) return itemName;
  }

  return null;
}

export function buildAdminItemsMeta(title: string, options?: { itemScoped?: boolean }): MetaFunction {
  return ({ matches }) => {
    const itemName = options?.itemScoped === false ? null : getAdminItemNameFromMatches(matches);
    const resolvedTitle = itemName ? `${itemName} • ${title}` : title === "Itens" ? title : `Itens • ${title}`;
    return [{ title: resolvedTitle }];
  };
}
