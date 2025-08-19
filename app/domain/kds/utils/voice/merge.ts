import type { Lexicon, StatusId } from "./types";

function uniq(a: string[]) {
  return Array.from(new Set(a));
}

export function mergeLexica(...lexica: Partial<Lexicon>[]): Lexicon {
  const empty: Record<StatusId, string[]> = {
    novoPedido: [],
    emProducao: [],
    aguardandoForno: [],
    assando: [],
    finalizado: [],
  };
  const out: Lexicon = { intents: { ...empty } };
  for (const lx of lexica) {
    if (!lx?.intents) continue;
    for (const key of Object.keys(empty) as StatusId[]) {
      const add = lx.intents[key] ?? [];
      out.intents[key] = uniq([...(out.intents[key] || []), ...add]);
    }
  }
  return out;
}
