import { defer, type LoaderFunctionArgs } from "@remix-run/node";
import {
  Await,
  Link,
  useFetcher,
  useLoaderData,
  useOutletContext,
} from "@remix-run/react";
import { Suspense } from "react";
import prismaClient from "~/lib/prisma/client.server";
import type { HttpResponse } from "~/utils/http-response.server";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
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

export function loader({ params }: LoaderFunctionArgs) {
  // Remix defer tracks native Promises, while Prisma returns a lazy thenable.
  const composition = Promise.resolve(
    prismaClient.itemCostSheetComponent.findMany({
      where: { ItemCostSheet: { itemId: params.id } },
      select: { id: true, itemCostSheetId: true, name: true, type: true },
      orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
    })
  );
  return defer({ composition });
}

const componentTypeLabels: Record<string, string> = {
  recipe: "Receita",
  item: "Item",
  recipeSheet: "Ficha de custo",
  labor: "Mão de obra",
  manual: "Manual",
};

function ActivateSheetButton({ sheetId }: { sheetId: string }) {
  const fetcher = useFetcher<HttpResponse>();
  const busy = fetcher.state !== "idle";
  return (
    <div className="space-y-1">
      <fetcher.Form method="post" action={`/admin/item-cost-sheets/${sheetId}`}>
        <input type="hidden" name="_action" value="item-cost-sheet-activate" />
        <input type="hidden" name="itemCostSheetId" value={sheetId} />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={busy}
          className="h-8 gap-1.5 whitespace-nowrap border-emerald-200 bg-emerald-50 px-2.5 text-xs text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {busy ? "Ativando..." : "Ativar ficha"}
        </Button>
      </fetcher.Form>
      {!busy && fetcher.data && (
        <p
          role={fetcher.data.status >= 400 ? "alert" : "status"}
          className="max-w-xs whitespace-normal text-xs text-slate-600"
        >
          {fetcher.data.message}
        </p>
      )}
    </div>
  );
}

function formatUpdatedAt(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR");
}

export default function AdminItemCostSheetsTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const { composition } = useLoaderData<typeof loader>();
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
      id: rootSheet.baseItemCostSheetId || rootSheet.id,
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
                Composição
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
                  colSpan={6}
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
                  <TableCell className="px-4 py-3">
                    <div className="space-y-1">
                      <Suspense
                        fallback={
                          <p className="text-xs text-slate-500">
                            Carregando composição...
                          </p>
                        }
                      >
                        <Await
                          resolve={composition}
                          errorElement={
                            <p role="alert" className="text-xs text-red-600">
                              Não foi possível carregar a composição.
                            </p>
                          }
                        >
                          {(components) => {
                            const rows = components.filter(
                              (component) =>
                                component.itemCostSheetId === sheet.id
                            );
                            return rows.length ? (
                              <ul className="space-y-1">
                                {rows.map((component) => (
                                  <li
                                    key={component.id}
                                    className="flex flex-wrap items-center gap-2 text-sm text-slate-700"
                                  >
                                    <span>{component.name}</span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-normal"
                                    >
                                      {componentTypeLabels[component.type] ||
                                        component.type}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500">
                                Sem componentes cadastrados.
                              </p>
                            );
                          }}
                        </Await>
                      </Suspense>
                    </div>
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
                    <div className="flex items-start justify-end gap-2">
                      {!sheet.isActive && (
                        <ActivateSheetButton sheetId={sheet.id} />
                      )}
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 gap-1.5 px-2.5 text-xs text-slate-600"
                      >
                        <Link to={`/admin/item-cost-sheets/${sheet.id}`}>
                          <ExternalLink
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                          <span>Abrir</span>
                        </Link>
                      </Button>
                    </div>
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
