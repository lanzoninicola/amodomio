import { useActionData, useOutletContext } from "@remix-run/react";
import { useEffect } from "react";
import { toast } from "~/components/ui/use-toast";
import RecipeForm from "~/domain/recipe/components/recipe-form/recipe-form";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
export { action } from "./admin.recipes.$id";

export default function AdminRecipeCadastroTab() {
  const actionData = useActionData<{ status?: number; message?: string }>();
  const { recipe, items, unitOptions } =
    useOutletContext<AdminRecipeOutletContext>();

  useEffect(() => {
    if (actionData?.status && actionData.status >= 400) {
      toast({
        title: "Erro",
        description: actionData.message,
        variant: "destructive",
      });
    }
  }, [actionData]);

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">
        Configuração da receita
      </h2>
      <p className="mt-0.5 mb-4 text-sm text-slate-500">
        Atualize nome, vínculo com item, atributos e procedimento de produção.
      </p>
      <RecipeForm
        recipe={recipe}
        actionName="recipe-update"
        items={items}
        unitOptions={unitOptions}
        requireItemRemapConfirmation
        createCostSheetOption={{ enabled: true }}
        hiddenFields={[{ name: "tab", value: "cadastro" }]}
        formAction="."
      />
    </div>
  );
}
