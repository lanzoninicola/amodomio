import { useState } from "react";
import { Form, Link, useOutletContext } from "@remix-run/react";
import { ExternalLink, Sparkles } from "lucide-react";
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

export default function AdminItemLinkedRecipeTab() {
  const { item, recipeAssistantItems, recipeAssistantChatGptProjectUrl } =
    useOutletContext<AdminItemOutletContext>();
  const recipes = item.Recipe || [];
  const [showAssistant, setShowAssistant] = useState(false);

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

      <Table className="min-w-[720px]">
        <TableHeader className="bg-slate-50/90">
          <TableRow className="hover:bg-slate-50/90">
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Receita
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
                colSpan={3}
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
