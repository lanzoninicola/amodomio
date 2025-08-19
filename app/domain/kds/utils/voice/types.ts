export type StatusId = "novoPedido" | "emProducao" | "aguardandoForno" | "assando" | "finalizado";
export type LanguageCode = "pt-BR" | "it-IT";

export type Lexicon = {
  intents: Record<StatusId, string[]>;
};
