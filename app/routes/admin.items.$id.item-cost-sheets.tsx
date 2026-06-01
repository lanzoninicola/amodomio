import { Link, useOutletContext } from "@remix-run/react";
import { ExternalLink } from "lucide-react";
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
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import type { AdminItemOutletContext } from "./admin.items.$id";

export const meta = buildAdminItemsMeta("Fichas de custo");

function formatUpdatedAt(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR");
}

export default function AdminItemCostSheetsTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const rawSheets = item.ItemCostSheet || [];
  const groupedSheets = Array.from(
    rawSheets
      .reduce((map: Map<string, any[]>, sheet: any) => {
        const key = String(sheet.baseItemCostSheetId || sheet.id || "");
        if (!key) return map;
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push(sheet);
        return map;
      }, new Map<string, any[]>())
      .values()
  ).map((sheetGroup: any[]) => {
    const rootSheet =
      sheetGroup.find((sheet) => !sheet.baseItemCostSheetId) ||
      sheetGroup.find(
        (sheet) =>
          sheet.ItemVariation?.isReference &&
          sheet.ItemVariation?.Variation?.code !== "base"
      ) ||
      sheetGroup[0];

    return {
      id: rootSheet.id,
      name: rootSheet.name,
      isActive: sheetGroup.some((sheet) => Boolean(sheet.isActive)),
      variationCount: sheetGroup.length,
      updatedAt: sheetGroup.reduce((latest, sheet) => {
        const current = new Date(sheet.updatedAt || 0);
        return current > latest ? current : latest;
      }, new Date(rootSheet.updatedAt || 0)),
    };
  });

  return (
    <div className="space-y-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{groupedSheets.length} ficha(s)</span>
          <span>·</span>
          <span>Cada ficha agrupa os tamanhos ativos vinculados ao item</span>
        </div>
        <Button asChild type="button" size="sm">
          <Link to={`/admin/item-cost-sheets/new?itemId=${item.id}`}>
            Criar ficha de custo
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden bg-white">
        <Table className="min-w-[860px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Ficha
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Tamanhos
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                Status
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
            {groupedSheets.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="px-4 py-8 text-sm text-slate-500"
                >
                  Nenhuma ficha de custo vinculada a este item.
                </TableCell>
              </TableRow>
            ) : (
              groupedSheets.map((sheet: any) => (
                <TableRow
                  key={sheet.id}
                  className="border-slate-100 hover:bg-slate-50/50"
                >
                  <TableCell className="px-4 py-3">
                    <Link
                      to={`/admin/item-cost-sheets/${sheet.id}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {sheet.name}
                    </Link>
                    <div className="text-xs text-slate-500">ID: {sheet.id}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">
                    {sheet.variationCount} tamanho(s)
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {sheet.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        Ativa
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-100 text-slate-700"
                      >
                        Rascunho
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-700">
                    {formatUpdatedAt(sheet.updatedAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/item-cost-sheets/${sheet.id}`}
                      className="inline-flex items-center justify-end gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Abrir</span>
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
