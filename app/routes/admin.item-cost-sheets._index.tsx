import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import NoRecordsFound from "~/components/primitives/no-records-found/no-records-found";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

interface ItemCostSheetListItem {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  isActive: boolean;
  version: number;
  costAmount: number;
  itemId: string;
  itemVariationId: string;
  itemName: string;
  itemVariationName: string;
  updatedAt: Date;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [err, rows] = await tryit(
    prismaClient.itemCostSheet.findMany({
      include: {
        Item: { select: { id: true, name: true } },
        ItemVariation: {
          select: {
            id: true,
            Variation: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    })
  );

  if (err) {
    return serverError(err);
  }

  const recipeSheets: ItemCostSheetListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status as ItemCostSheetListItem["status"],
    isActive: row.isActive,
    version: row.version,
    costAmount: Number(row.costAmount || 0),
    itemId: row.itemId,
    itemVariationId: row.itemVariationId,
    itemName: row.Item?.name || "Item desconhecido",
    itemVariationName: row.ItemVariation?.Variation?.name || row.ItemVariation?.Variation?.code || "Variação base",
    updatedAt: row.updatedAt,
  }));

  return ok({ recipeSheets });
}

function statusLabel(status: ItemCostSheetListItem["status"]) {
  if (status === "active") return "Ativa";
  if (status === "archived") return "Arquivada";
  return "Rascunho";
}

function statusBadgeClass(status: ItemCostSheetListItem["status"]) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "archived") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function AdminItemCostSheetsIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const recipeSheets = (loaderData?.payload?.recipeSheets || []) as ItemCostSheetListItem[];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipeSheets;

    return recipeSheets.filter((sheet) => {
      return (
        sheet.name.toLowerCase().includes(query) ||
        sheet.itemName.toLowerCase().includes(query) ||
        sheet.itemVariationName.toLowerCase().includes(query)
      );
    });
  }, [recipeSheets, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fichas de custo</div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">{filtered.length}</div>
            <div className="text-xs text-slate-500">itens encontrados</div>
          </div>

          <div className="relative w-full md:w-[380px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              className="pl-9"
              placeholder="Buscar por ficha de custo, item ou variação"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <NoRecordsFound text="Nenhuma ficha de custo encontrada" />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-slate-50/90">
              <TableRow className="hover:bg-slate-50/90">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Item</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Versão</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Custo</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Ativa</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sheet) => (
                <TableRow key={sheet.id} className="border-slate-100 hover:bg-slate-50/50">
                  <TableCell className="px-4 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold text-slate-900">{sheet.name}</span>
                      <span className="text-xs text-slate-500">ID: {sheet.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="text-sm text-slate-800">{sheet.itemName}</div>
                    <div className="text-xs text-slate-500">{sheet.itemVariationName}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className={statusBadgeClass(sheet.status)}>
                      {statusLabel(sheet.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-medium text-slate-800">v{sheet.version}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-medium text-slate-800">R$ {sheet.costAmount.toFixed(2)}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className={sheet.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}>
                      {sheet.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/items/${sheet.itemId}/item-cost-sheets?itemCostSheetId=${sheet.id}&itemVariationId=${sheet.itemVariationId}`}
                    >
                      <Button type="button" variant="outline" size="sm" className="rounded-md">
                        Abrir
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>0 of {filtered.length} row(s) selected.</span>
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-700">Rows per page</span>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{filtered.length}</Badge>
              <span className="text-xs font-semibold text-slate-900">Page 1 of 1</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
