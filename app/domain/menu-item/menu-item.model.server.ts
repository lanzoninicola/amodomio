import { createFirestoreModel } from "~/lib/firestore-model/src";
import { PizzaSizeVariation } from "../pizza/pizza.entity.server";

export interface MenuItemPrice {
  label: "media" | "familia" | "fatia" | "individual";
  amount: number;
}

export interface MenuItem {
  id?: string;
  name?: string;
  description?: string;
  ingredients?: string[];
  prices?: MenuItemPrice[];
  visible?: boolean;
  category?: {
    id: string;
  };
  sortOrder?: number;
}

const MenuItemModel = createFirestoreModel<MenuItem>("menu_items");

export { MenuItemModel };
