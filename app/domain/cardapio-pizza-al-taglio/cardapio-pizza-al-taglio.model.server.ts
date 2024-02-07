import { ObjectId } from "mongodb";
import createMongoCollection from "~/lib/atlas-mongodb/create-mongo-collection.server";

export type SliceTaglioCategory = "margherita" | "vegetariana" | "carne";

export type SliceTaglio = {
  topping: string;
  category: SliceTaglioCategory;
  amount: number;
  outOfStock: boolean;
};

interface CardapioPizzaAlTaglio {
  _id?: ObjectId;
  slices: SliceTaglio[];
  // dayjs date format DD/MM/YYYY HH:mm:ss
  publishedDate: string | null;
  published: boolean;
}

const CardapioPizzaAlTaglioModel = createMongoCollection<CardapioPizzaAlTaglio>(
  "daily_pizza_al_taglio"
);

export { CardapioPizzaAlTaglioModel, type CardapioPizzaAlTaglio };
