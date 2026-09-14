import { useState } from "react";
import { Form, Link, useNavigation, useOutletContext } from "@remix-run/react";
import { ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import ItemRecipeChatGptAssistantPanel from "~/domain/recipe/components/item-recipe-chatgpt-assistant-panel";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import type { AdminItemOutletContext } from "./admin.items.$id";

export const meta = buildAdminItemsMeta("Receita vinculada");

function formatRecipeCreatedAt(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR");
}

function formatCostSheetStatus(sheet: any) {
  if (sheet.isActive || sheet.status === "active") return "ativa";
  if (sheet.status === "archived") return "arquivada";
  return "rascunho";
}

export default function AdminItemLinkedRecipeTab() {
  const { item, recipeAssistantItems, recipeAssistantChatGptProjectUrl } =
    useOutletContext<AdminItemOutletContext>();
  const recipes = item.Recipe || [];
  const [showAssistant, setShowAssistant] = useState(false);
  const navigation = useNavigation();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{recipes.length} receita(s)</span>
          <span>·</span>
          <Link
            to="/admin/recipes"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Abrir módulo de receitas</span>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAssistant((current) => !current)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {showAssistant ? "Ocultar assistente" : "Assistente de receita"}
          </Button>
          <Form method="post" action="../..">
            <input type="hidden" name="_action" value="item-recipe-create" />
            <Button type="submit" size="sm">
              Criar receita
            </Button>
          </Form>
        </div>
      </div>

      <Table className="min-w-[1220px]">
        <TableHeader className="bg-slate-50/90">
          <TableRow className="hover:bg-slate-50/90">
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Receita
            </TableHead>
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Composição
            </TableHead>
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Na ficha técnica do item
            </TableHead>
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Criar ficha técnica
            </TableHead>
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Criada em
            </TableHead>
            <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={6}
                className="px-4 py-8 text-sm text-slate-500"
              >
                Não existe receita vinculada ao item.
              </TableCell>
            </TableRow>
          ) : (
            recipes.map((recipe: any) => (
              <TableRow
                key={recipe.id}
                className="border-slate-100 hover:bg-slate-50/50"
              >
                <TableCell className="px-4 py-3">
                  <Link
                    to={`/admin/recipes/${recipe.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {recipe.name}
                  </Link>
                  <div className="text-xs text-slate-500">ID: {recipe.id}</div>
                </TableCell>
                <TableCell className="max-w-md px-4 py-3">
                  {recipe.RecipeIngredient?.length ? (
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500">
                        {recipe.RecipeIngredient.length} ingrediente(s)
                      </div>
                      <div className="text-sm leading-5 text-slate-700">
                        {recipe.RecipeIngredient.map(
                          (ingredient: any) => ingredient.IngredientItem?.name
                        )
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">
                      Sem ingredientes cadastrados
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs px-4 py-3">
                  {recipe._sameItemCostSheets?.length ? (
                    <div className="space-y-1.5">
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Sim
                      </Badge>
                      <div className="text-xs leading-5 text-slate-600">
                        {recipe._sameItemCostSheets
                          .map(
                            (sheet: any) =>
                              `${sheet.name} (${formatCostSheetStatus(sheet)})`
                          )
                          .join(" · ")}
                      </div>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-700"
                    >
                      Não
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {recipe._sameItemCostSheets?.length ? (
                    <span className="text-sm text-slate-400">—</span>
                  ) : (
                    <Form method="post" action="../..">
                      <input
                        type="hidden"
                        name="_action"
                        value="item-recipe-cost-sheet-create"
                      />
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={
                          navigation.state !== "idle" &&
                          navigation.formData?.get("_action") ===
                            "item-recipe-cost-sheet-create" &&
                          navigation.formData?.get("recipeId") === recipe.id
                        }
                      >
                        {navigation.state !== "idle" &&
                        navigation.formData?.get("_action") ===
                          "item-recipe-cost-sheet-create" &&
                        navigation.formData?.get("recipeId") === recipe.id
                          ? "Criando..."
                          : "Criar ficha"}
                      </Button>
                    </Form>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3 text-sm text-slate-700">
                  {formatRecipeCreatedAt(recipe.createdAt)}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Link
                    to={`/admin/recipes/${recipe.id}`}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Abrir
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {showAssistant ? (
        <div className="border-t border-slate-200 px-4 py-4">
          <ItemRecipeChatGptAssistantPanel
            item={item}
            ingredientsCatalog={recipeAssistantItems}
            externalUrl={recipeAssistantChatGptProjectUrl}
            formAction="../.."
          />
        </div>
      ) : null}
    </div>
  );
}
