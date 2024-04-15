import { createFirestoreModel } from "~/lib/firestore-model/src";

type CategoryType = "product" | "menu";

export type TCategory = Record<string, string>;

export type TSubCategory = Record<string, string>;

interface Category {
  id?: string;
  name: string;
  type: CategoryType;
  // the sortOrder should be mandatory when the type is "menu"
  sortOrder?: number;
}

const CategoryModel = createFirestoreModel<Category>("categories");

export { CategoryModel, type Category, type CategoryType };
