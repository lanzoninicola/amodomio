import TemplatePage from "./admin.mobile.receitas.$recipeId_.templates";
export {
  loader,
  meta,
  shouldRevalidate,
  action,
} from "./admin.mobile.receitas.$recipeId_.templates";
export default function RecipeTvTemplatePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <TemplatePage recipeBasePath="/admin/receitas-tv" presentation="tv" />
      </div>
    </main>
  );
}
