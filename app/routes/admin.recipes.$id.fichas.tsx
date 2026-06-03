import { defer, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, useLoaderData } from "@remix-run/react";
import { Eye } from "lucide-react";
import { Suspense } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import {
  listRecipeCostSheetUsage,
  type RecipeCostSheetUsageRow,
} from "~/domain/recipe/recipe-cost-sheet-usage.server";
import { badRequest } from "~/utils/http-response.server";

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR");
}

function RecipeCostSheetsTable({ rows }: { rows: RecipeCostSheetUsageRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{rows.length} ficha(s)</span>
        <span>·</span>
        <span>Fichas técnicas que usam esta receita como referência.</span>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[840px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Ficha técnica
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Item
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Custo ref.
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Variações
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Status
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Origem
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Atualizada em
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  className="px-4 py-8 text-sm text-slate-500"
                >
                  Nenhuma ficha técnica contém esta receita.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-slate-100 hover:bg-slate-50/50"
                >
                  <TableCell className="px-4 py-3">
                    <Link
                      to={`/admin/item-cost-sheets/${row.id}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-xs text-slate-500">ID: {row.id}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.itemId ? (
                      <Link
                        to={`/admin/items/${row.itemId}`}
                        className="text-sm font-medium text-slate-700 hover:text-slate-950 hover:underline"
                      >
                        {row.itemName}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-700">
                        {row.itemName}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="font-semibold text-slate-900">
                      {formatMoney(row.referenceCostAmount)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.referenceVariationName || "Sem variação ref."}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-slate-50 text-slate-700"
                    >
                      {row.variationCount} tamanho(s)
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        row.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }
                    >
                      {row.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">
                    {row.sourceLabels.join(", ") || "-"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">
                    {formatDateTime(row.updatedAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/item-cost-sheets/${row.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                      title="Abrir ficha"
                    >
                      <Eye size={15} />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export async function loader({ params }: LoaderFunctionArgs) {
  const recipeId = String(params.id || "").trim();
  if (!recipeId) return badRequest("Receita inválida");

  return defer({
    costSheets: listRecipeCostSheetUsage(prismaClient as any, recipeId),
  });
}

export default function AdminRecipeFichasTab() {
  const { costSheets } = useLoaderData() as {
    costSheets: Promise<RecipeCostSheetUsageRow[]>;
  };

  return (
    <Suspense
      fallback={
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          Carregando fichas técnicas...
        </div>
      }
    >
      <Await
        resolve={costSheets}
        errorElement={
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-700">
            Não foi possível carregar as fichas técnicas desta receita.
          </div>
        }
      >
        {(rows) => <RecipeCostSheetsTable rows={rows} />}
      </Await>
    </Suspense>
  );
}
