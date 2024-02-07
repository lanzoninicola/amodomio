import { ObjectId } from "mongodb";
import createMongoCollection from "~/lib/atlas-mongodb/create-mongo-collection.server";

export type SliceTaglioCategory = "margherita" | "vegetariana" | "carne";

export type SliceTaglio = {
  topping: string;
  category: SliceTaglioCategory;
  amount: number;
};

interface CardapioPizzaAlTaglio {
  _id?: ObjectId;
  // dayjs date format DD/MM/YYYY
  date: string;
  slices: SliceTaglio[];
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
