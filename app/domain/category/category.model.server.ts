import { createFirestoreModel } from "~/lib/firestore-model/src";

interface Category {
  id?: string;
  name: string;
  type: "generic" | "menu";
  sortOrder?: number;
  visible: boolean;
  default?: boolean;
}

const CategoryModel = createFirestoreModel<Category>("categories");

export { CategoryModel, type Category };
