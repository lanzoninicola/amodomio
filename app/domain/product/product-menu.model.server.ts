import { createFirestoreModel } from "~/lib/firestore-model/src";
import { Category } from "../category/category.model.server";

interface ProductMenu {
  id?: string;
  productId: string;
  show: boolean;
  category: Category;
  description: string;
  italianProductName: string;
  isVegetarian: boolean;
  isGlutenFree: boolean;
}

const ProductMenuModel = createFirestoreModel<ProductMenu>("products_menu");

export { ProductMenuModel, type ProductMenu };
