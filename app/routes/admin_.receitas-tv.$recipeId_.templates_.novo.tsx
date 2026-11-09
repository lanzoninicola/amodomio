import TemplatePage from "./admin.mobile.receitas.$recipeId_.templates_.novo";
import { RecipeTvTemplateLayout } from "~/domain/recipe/components/recipe-tv-template-layout";
export {
  loader,
  meta,
  action,
} from "./admin.mobile.receitas.$recipeId_.templates_.novo";
export default function RecipeTvTemplatePage() {
  return (
    <RecipeTvTemplateLayout>
      <TemplatePage recipeBasePath="/admin/receitas-tv" />
    </RecipeTvTemplateLayout>
  );
}
