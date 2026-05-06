import { useOutletContext } from "@remix-run/react";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
export { action } from "./admin.recipes.$id";

export default function AdminRecipeCadastroTab() {
    const { recipe, items } = useOutletContext<AdminRecipeOutletContext>()

    return (
        <div>
            <h2 className="text-base font-semibold text-slate-900">Configuração da receita</h2>
            <p className="mt-0.5 mb-4 text-sm text-slate-500">Atualize nome, vínculo com item e atributos.</p>
            <RecipeForm
                recipe={recipe}
                actionName="recipe-update"
                items={items}
                requireItemRemapConfirmation
                createCostSheetOption={{ enabled: true }}
                hiddenFields={[{ name: "tab", value: "cadastro" }]}
                formAction="."
            />
        </div>
    )
}
