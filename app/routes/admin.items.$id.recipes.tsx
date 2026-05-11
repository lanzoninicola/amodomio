import { useState } from "react";
import { Form, Link, useOutletContext } from "@remix-run/react";
import ItemRecipeChatGptAssistantPanel from "~/domain/recipe/components/item-recipe-chatgpt-assistant-panel";
import type { AdminItemOutletContext } from "./admin.items.$id";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";
import { SelectSeparator } from "~/components/ui/select";
import { ExternalLink, Sparkles } from "lucide-react";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";

export const meta = buildAdminItemsMeta("Receitas");

function formatRecipeCreatedAt(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("pt-BR");
}

export default function AdminItemRecipesTab() {
  const { item, recipeAssistantItems, recipeAssistantChatGptProjectUrl } = useOutletContext<AdminItemOutletContext>();
  const recipes = item.Recipe || [];
  const ingredientUsage = item._ingredientRecipeUsage || [];
  const [showAssistant, setShowAssistant] = useState(false);

  if (recipes.length === 0 && ingredientUsage.length === 0) {
    return (
      <div className="grid place-items-center min-h-[250px] ">
        <div className="flex flex-col gap-4 items-center">
          <p className="text-sm ">Não existe receita vinculada ao item.</p>
          <Form method="post" action="..">
            <input type="hidden" name="_action" value="item-recipe-create" />
            <Button type="submit" size="sm">Criar uma receita</Button>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2" >
      <div className="flex flex-col space-y-6">
        <div className="">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold  ">Receitas vinculadas</h2>
              <p className="text-sm text-slate-600">{recipes.length} receita(s)</p>
            </div>
            <div className="flex items-center gap-x-4">
              <Link to="/admin/recipes" className="text-sm underline flex items-center gap-x-2">
                <ExternalLink size={16} />
                <span>Abrir módulo de receitas</span>
              </Link>
              <Separator orientation="vertical" className="h-4" />
              <Button variant="ghost" size="sm" onClick={() => setShowAssistant(v => !v)}
                className="flex items-center gap-x-2"
              >
                <Sparkles size={16} />
                {showAssistant ? "Ocultar assistente" : "Assistente de receita"}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {(
              recipes.map((recipe: any) => {
                const createdAtLabel = formatRecipeCreatedAt(recipe.createdAt);

                return (
                  <div key={recipe.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">{recipe.name}</div>
                        {createdAtLabel ? <div className="text-xs text-slate-500">Criada em {createdAtLabel}</div> : null}
                      </div>
                      <Link to={`/admin/recipes/${recipe.id}`} className="text-xs underline flex items-center gap-x-2" about="_blank">
                        <ExternalLink size={16} />
                        <span>Abrir </span>

                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex flex-col w-full">
            <div>
              <h2 className="text-sm font-semibold  ">Uso como ingrediente</h2>
              <p className="text-sm text-slate-600">{ingredientUsage.length} receita(s)</p>
            </div>

            <div className="mt-4 space-y-2 w-full">
              {ingredientUsage.length === 0 ? (
                <p className="text-sm text-slate-500">Este item não está sendo usado como ingrediente em receitas.</p>
              ) : (
                ingredientUsage.map((usage: any) => {
                  const recipe = usage.Recipe;
                  const createdAtLabel = formatRecipeCreatedAt(recipe?.createdAt);

                  return (
                    <div key={usage.id} className="rounded-lg border border-slate-100 p-3 w-full">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div>
                          <div className="font-medium text-slate-900">{recipe?.name || "Receita"}</div>
                          <div className="text-xs text-slate-500">
                            Item usado como ingrediente
                            {createdAtLabel ? ` · Criada em ${createdAtLabel}` : ""}
                          </div>
                        </div>
                        {recipe?.id ? (
                          <Link to={`/admin/recipes/${recipe.id}`} className="text-xs underline">
                            Abrir
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>


      <div>

        {showAssistant && (
          <div className="mt-4">
            <ItemRecipeChatGptAssistantPanel
              item={item}
              ingredientsCatalog={recipeAssistantItems}
              externalUrl={recipeAssistantChatGptProjectUrl}
              formAction=".."
            />
          </div>
        )}
      </div>
    </div>
  );
}
