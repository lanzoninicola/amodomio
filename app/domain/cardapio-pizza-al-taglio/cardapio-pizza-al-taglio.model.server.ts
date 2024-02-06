import createMongoCollection from "~/lib/atlas-mongodb/create-mongo-collection.server";
import { createFirestoreModel } from "~/lib/firestore-model/src";

export type ToppingTaglio = string;

interface CardapioPizzaAlTaglio {
  id?: string;
  // dayjs date format DD/MM/YYYY
  date: string;
  sabores?: ToppingTaglio[] | null;
  // dayjs date format DD/MM/YYYY HH:mm:ss
  fullDate: string;
}

// const CardapioPizzaAlTaglioModel = createFirestoreModel<CardapioPizzaAlTaglio>(
//   "daily_pizza_al_taglio"
// );

const CardapioPizzaAlTaglioModel = createMongoCollection<CardapioPizzaAlTaglio>(
  "daily_pizza_al_taglio"
);

export { CardapioPizzaAlTaglioModel, type CardapioPizzaAlTaglio };
