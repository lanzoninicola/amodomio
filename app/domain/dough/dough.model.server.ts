import { createFirestoreModel } from "~/lib/firestore-model/src";

interface Dough {
  id?: string;
  name: string;
  note: string;
  flourTotalGrams: number;
  waterTotalPercentage: number;
  currentTemperature: number;
  biga?: Biga;
  closure?: DoughClosure;
}

interface Biga {
  bigaPercentage: number;
  flourGrams: number;
  waterPercentage: number;
  yeastGrams: number;
}

interface DoughClosure {
  waterPercentage: number;
  yeastGrams: number;
  saltGrams: number;
  flours: FlourPartition[];
}

interface FlourPartition {
  grams: number;
  type: Flour;
}

type Flour = "00" | "riso" | "Tipo 1";

const DoughModel = createFirestoreModel<Dough>("doughs");

export { DoughModel, type Dough };
