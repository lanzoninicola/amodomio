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
