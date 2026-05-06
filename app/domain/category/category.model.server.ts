type CategoryType = "item" | "menu";

interface Category {
  id?: string;
  name: string;
  type: CategoryType;
  // Legacy callers still treat these as optional in some flows.
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Legacy alias used by Firestore-based catalog modules.
type CategoryMenu = Category;

export { type Category, type CategoryMenu, type CategoryType };
