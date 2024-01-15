import { createFirestoreModel } from "~/lib/firestore-model/src";

export interface Setting {
  id?: string;
  context: string;
  name: string;
  type?: "boolean" | "string" | "number" | "array" | "object";
  value: string;
}

const OptionModel = createFirestoreModel<Setting>("settings");

export { OptionModel };
