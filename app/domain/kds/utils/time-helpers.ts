// app/domain/kds/time-helpers.ts
export type KdsPhases =
  | "fila"              // createdAt -> emProducaoAt
  | "producao"          // emProducaoAt -> aguardandoFornoAt
  | "filaForno"         // aguardandoFornoAt -> assandoAt
  | "forno"             // assandoAt -> finalizadoAt
  | "posFinal"          // finalizadoAt -> now (para análises pós-fechamento)
  | "cicloTotal";       // createdAt -> finalizadoAt (ou now)

// Subset mínimo do seu OrderRow com os timestamps de interesse
export type KdsTimestamps = {
  createdAt?: Date | string | null;
  emProducaoAt?: Date | string | null;
  aguardandoFornoAt?: Date | string | null;
  assandoAt?: Date | string | null;
  finalizadoAt?: Date | string | null;
};

const toMs = (d?: Date | string | null) =>
  d ? new Date(d as any).getTime() : undefined;

const diffPos(msStart?: number, msEnd?: number) =>
  msStart == null || msEnd == null ? 0 : Math.max(0, msEnd - msStart);

export const msToMin = (ms: number) => ms / 60000;
export const clampNonNeg = (n: number) => Math.max(0, n);

/** Formata para HH:MM (arredonda para baixo os minutos) */
export function fmtHHMMfromMs(ms: number) {
  const totalMin = Math.floor(msToMin(ms));
  const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const mm = (totalMin % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Formata para MM:SS (útil em contagens curtas) */
export function fmtMMSSfromMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const mm = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const ss = (totalSec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Retorna o "agora" uma única vez – injete em telas para consistência */
export const nowMs = () => Date.now();

/** Calcula intervalos (em ms) de cada fase, respeitando lacunas e regressões */
export function getPhaseDurationsMs(row: KdsTimestamps, now = nowMs()) {
  const c = toMs(row.createdAt);
  const ep = toMs(row.emProducaoAt);
  const af = toMs(row.aguardandoFornoAt);
  const as = toMs(row.assandoAt);
  const fi = toMs(row.finalizadoAt);

  // Encadeamento de “endereços” válidos para cada fase:
  const filaMs       = diffPos(c,  ep ?? fi ?? now);                // até entrar em produção (ou fim/now)
  const producaoMs   = ep ? diffPos(ep,  af ?? fi ?? now) : 0;      // até ir pra fila de forno (ou fim/now)
  const filaFornoMs  = af ? diffPos(af,  as ?? fi ?? now) : 0;      // até começar a assar (ou fim/now)
  const fornoMs      = as ? diffPos(as,  fi ?? now)            : 0; // até finalizar (ou now)
  const posFinalMs   = fi ? diffPos(fi,  now)                  : 0; // após finalizado

  const cicloTotalMs = diffPos(c,  fi ?? now);

  return {
    fila: filaMs,
    producao: producaoMs,
    filaForno: filaFornoMs,
    forno: fornoMs,
    posFinal: posFinalMs,
    cicloTotal: cicloTotalMs,
  } as Record<KdsPhases, number>;
}

/** Mesma função, mas já devolve minutos (float) */
export function getPhaseDurationsMin(row: KdsTimestamps, now = nowMs()) {
  const ms = getPhaseDurationsMs(row, now);
  return Object.fromEntries(
    Object.entries(ms).map(([k, v]) => [k, v / 60000])
  ) as Record<KdsPhases, number>;
}

/** Em qual fase o pedido está agora? */
export function getCurrentPhase(row: KdsTimestamps): Exclude<KdsPhases, "posFinal" | "cicloTotal"> {
  if (row.finalizadoAt) return "posFinal";
  if (row.assandoAt) return "forno";
  if (row.aguardandoFornoAt) return "filaForno";
  if (row.emProducaoAt) return "producao";
  return "fila";
}

/** Tempo decorrido apenas da fase corrente (ms) */
export function getCurrentPhaseElapsedMs(row: KdsTimestamps, now = nowMs()) {
  const c = toMs(row.createdAt);
  const ep = toMs(row.emProducaoAt);
  const af = toMs(row.aguardandoFornoAt);
  const as = toMs(row.assandoAt);
  const fi = toMs(row.finalizadoAt);

  if (fi) return 0;
  if (as) return diffPos(as, now);
  if (af) return diffPos(af, now);
  if (ep) return diffPos(ep, now);
  return diffPos(c, now);
}

/** Tempo total decorrido do ciclo (ms) — do createdAt até finalizado (ou now) */
export function getCycleElapsedMs(row: KdsTimestamps, now = nowMs()) {
  const c = toMs(row.createdAt);
  const fi = toMs(row.finalizadoAt) ?? now;
  return diffPos(c, fi);
}

/** Versão “pronta para UI”: strings por fase em HH:MM, e extras úteis */
export function getHumanDurations(row: KdsTimestamps, now = nowMs()) {
  const dms = getPhaseDurationsMs(row, now);
  const currentMs = getCurrentPhaseElapsedMs(row, now);
  const cycleMs = getCycleElapsedMs(row, now);

  return {
    byPhase: {
      fila: fmtHHMMfromMs(dms.fila),
      producao: fmtHHMMfromMs(dms.producao),
      filaForno: fmtHHMMfromMs(dms.filaForno),
      forno: fmtHHMMfromMs(dms.forno),
    },
    currentPhase: getCurrentPhase(row),
    currentPhaseElapsedHHMM: fmtHHMMfromMs(currentMs),
    cycleHHMM: fmtHHMMfromMs(cycleMs),
    // Originais em ms, caso precise para gráficos
    rawMs: { ...dms, current: currentMs, cycle: cycleMs },
  };
}

/** Avalia SLAs por fase (opcional) e retorna flags de atenção */
export type SlaThresholdsMin = Partial<Record<KdsPhases, number>>;

export function evaluateSLA(
  row: KdsTimestamps,
  thresholdsMin: SlaThresholdsMin,
  now = nowMs()
) {
  const mins = getPhaseDurationsMin(row, now);
  const flags = Object.fromEntries(
    Object.entries(thresholdsMin).map(([phase, t]) => {
      const over = t != null && mins[phase as KdsPhases] > (t as number);
      return [phase, !!over];
    })
  ) as Record<keyof SlaThresholdsMin, boolean>;

  const currentPhase = getCurrentPhase(row);
  const currentOver =
    thresholdsMin[currentPhase as keyof SlaThresholdsMin] != null
      ? mins[currentPhase] >
        (thresholdsMin[currentPhase as keyof SlaThresholdsMin] as number)
      : false;

  return { flags, currentPhase, currentOver };
}
