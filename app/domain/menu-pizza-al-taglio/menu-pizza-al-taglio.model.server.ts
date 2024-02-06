import { createFirestoreModel } from "~/lib/firestore-model/src";

export type ToppingTaglio = string;

interface MenuPizzaAlTaglio {
  id?: string;
  // dayjs date format DD/MM/YYYY
  date: string;
  sabores?: ToppingTaglio[] | null;
  // dayjs date format DD/MM/YYYY HH:mm:ss
  fullDate: string;
}

const MenuPizzaAlTaglioModel = createFirestoreModel<MenuPizzaAlTaglio>(
  "daily_pizza_al_taglio"
);

export { MenuPizzaAlTaglioModel, type MenuPizzaAlTaglio };
