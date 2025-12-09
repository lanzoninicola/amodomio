// app/domain/kds/prediction/types.ts
export type SizeCounts = {
  F: number;
  M: number;
  P: number;
  I: number;
  FT: number;
};

export type DzTime = {
  deliveryZoneId: string | null;
  estimatedTimeInMin: number | null;
  distanceInKm: number | null;
};

export type ReadyPrediction = {
  id: string;
  readyAtMs: number;
  isDelivery: boolean;
  dzId?: string | null;
};

export type ArrivalPrediction = {
  id: string;
  arriveAtMs: number | null;
};

export type MinimalOrderRow = {
  id: string;
  createdAt: string | Date;
  finalizadoAt?: string | Date | null;
  size: any;
  hasMoto?: boolean | null;
  takeAway?: boolean | null;
  deliveryZoneId?: string | null;
};

export type ReadyAtMap = Map<string, number>;

export type TimelineBucket = {
  slotStartMs: number;
  slotEndMs: number;
  label: string;
  orderIds: string[];
  count: number;
  isPast: boolean;
  isCurrent: boolean;
};
