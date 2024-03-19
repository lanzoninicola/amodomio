import { CardapioPizzaAlTaglioEntityFirestore } from "./cardapio-pizza-al-taglio.entity.firestore.server";
import {
  CardapioPizzaAlTaglio,
  CardapioPizzaAlTaglioModel,
} from "./cardapio-pizza-al-taglio.model.server";
import { FirestoreModel } from "~/lib/firestore-model/src/lib/firestore-model.server";

/*
const dbEngine = process.env.CARDAPIO_PIZZA_AL_TAGLIO_DB_ENGINE;

let cardapioPizzaAlTaglioEntity:
  | CardapioPizzaAlTaglioEntityMongo
  | CardapioPizzaAlTaglioEntityFirestore;

if (!dbEngine) {
  throw new Error("CardapioPizzaAlTaglioEntity - DB_ENGINE not defined");
}

if (dbEngine === "mongo") {
  cardapioPizzaAlTaglioEntity = new CardapioPizzaAlTaglioEntityMongo({
    model: CardapioPizzaAlTaglioModel as Collection,
  });
}

if (dbEngine === "firestore") {
  cardapioPizzaAlTaglioEntity = new CardapioPizzaAlTaglioEntityFirestore(
    CardapioPizzaAlTaglioModel as FirestoreModel<CardapioPizzaAlTaglio>
  );
}
 */

const cardapioPizzaAlTaglioEntity = new CardapioPizzaAlTaglioEntityFirestore(
  CardapioPizzaAlTaglioModel as FirestoreModel<CardapioPizzaAlTaglio>
);

export { cardapioPizzaAlTaglioEntity };
