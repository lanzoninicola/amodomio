import { Outlet } from "@remix-run/react";
import { RecipeTemplateChecklistProvider } from "~/domain/recipe/components/recipe-template-checklist";

export default function RecipeTvLayout() {
  return (
    <RecipeTemplateChecklistProvider>
      <Outlet />
    </RecipeTemplateChecklistProvider>
  );
}
