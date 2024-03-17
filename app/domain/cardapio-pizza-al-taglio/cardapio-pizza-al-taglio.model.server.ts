import { ObjectId } from "mongodb";
import { createFirestoreModel } from "~/lib/firestore-model/src";
import { PizzaSlice } from "../pizza-al-taglio/pizza-al-taglio.model.server";

export interface CardapioPizzaSlice extends PizzaSlice {
  isAvailable: boolean;
}

interface CardapioPizzaAlTaglio {
  _id?: ObjectId;
  slices: CardapioPizzaSlice[];
  // dayjs date format DD/MM/YYYY HH:mm:ss
  validFrom: string;
  validTo: string;
}

const CardapioPizzaAlTaglioModel = createFirestoreModel<CardapioPizzaAlTaglio>(
  "daily_pizza_al_taglio"
);

export { CardapioPizzaAlTaglioModel, type CardapioPizzaAlTaglio };
