import type { Lexicon } from "../types";

export const LEXICON_IT_IT: Lexicon = {
  intents: {
    novoPedido: ["nuovo", "apri", "nuovo ordine"],
    emProducao: ["produzione", "preparazione", "prepara", "cucina", "cucinare"],
    aguardandoForno: [
      "forno",
      "in forno",
      "pronto per il forno",
      "metti al forno",
    ],
    assando: ["cuocere", "inforna", "metti a cuocere", "butta in forno"],
    finalizado: ["finito", "chiudi", "concluso", "terminato", "pronto"],
  },
};
