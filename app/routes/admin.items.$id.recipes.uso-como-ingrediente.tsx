import { Link, useOutletContext } from "@remix-run/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import type { AdminItemOutletContext } from "./admin.items.$id";

export const meta = buildAdminItemsMeta("Uso como ingrediente");

function formatRecipeCreatedAt(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR");
}

export default function AdminItemRecipeIngredientUsageTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const ingredientUsage = item._ingredientRecipeUsage || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-4 text-sm text-slate-500">
        <span>{ingredientUsage.length} receita(s)</span>
        <span>·</span>
        <span>Item usado na composição de receitas</span>
      </div>

      <Table className="min-w-[720px]">
        <TableHeader className="bg-slate-50/90">
          <TableRow className="hover:bg-slate-50/90">
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Receita
            </TableHead>
            <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
              Uso
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
          {ingredientUsage.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={4}
                className="px-4 py-8 text-sm text-slate-500"
              >
                Este item não está sendo usado como ingrediente em receitas.
              </TableCell>
            </TableRow>
          ) : (
            ingredientUsage.map((usage: any) => {
              const recipe = usage.Recipe;

              return (
                <TableRow
                  key={usage.id}
                  className="border-slate-100 hover:bg-slate-50/50"
                >
                  <TableCell className="px-4 py-3">
                    {recipe?.id ? (
                      <Link
                        to={`/admin/recipes/${recipe.id}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {recipe?.name || "Receita"}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-900">
                        {recipe?.name || "Receita"}
                      </span>
                    )}
                    {recipe?.id ? (
                      <div className="text-xs text-slate-500">
                        ID: {recipe.id}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">
                    Ingrediente
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">
                    {formatRecipeCreatedAt(recipe?.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {recipe?.id ? (
                      <Link
                        to={`/admin/recipes/${recipe.id}`}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        Abrir
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
