import { createFirestoreModel } from "~/lib/firestore-model/src";
import type { Product } from "../product/product.model.server";

export interface GroceryListItem extends Product {
  quantity: number;
  purchased: boolean;
  skipped: boolean;
}

interface GroceryList {
  id?: string;
  name: string;
  items?: GroceryListItem[] | null;
  purchaseDate?: string;
}

const GroceryListModel = createFirestoreModel<GroceryList>("grocery_list");

export { GroceryListModel, type GroceryList };
