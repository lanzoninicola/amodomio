import { createFirestoreModel } from "~/lib/firestore-model/src";
import { PizzaSlice } from "../pizza-al-taglio/pizza-al-taglio.model.server";

export interface CardapioPizzaSlice extends PizzaSlice {
  isAvailable: boolean;
  quantity: string;
  value?: string;
}

interface CardapioPizzaAlTaglio {
  id?: string;
  slices: CardapioPizzaSlice[];
  public: boolean;
  name?: string;
}

const CardapioPizzaAlTaglioModel = createFirestoreModel<CardapioPizzaAlTaglio>(
  "cardapio-pizza-al-taglio"
);

export { CardapioPizzaAlTaglioModel, type CardapioPizzaAlTaglio };
