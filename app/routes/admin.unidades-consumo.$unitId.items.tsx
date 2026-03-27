import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useOutletContext } from "@remix-run/react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const db = prismaClient as any;

  const unit = await db.measurementUnit.findUnique({
    where: { id: params.unitId },
    select: { id: true, code: true },
  });
  if (!unit) throw new Response("Unidade não encontrada", { status: 404 });

  const recentBatches =
    typeof db.stockMovementImportBatch?.findMany === "function"
      ? await db.stockMovementImportBatch.findMany({
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            appliedAt: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 20,
        })
      : [];

  const [items, linkedRows, batchLines] = await Promise.all([
    db.item.findMany({
      where: { active: true },
      select: { id: true, name: true, classification: true },
      orderBy: [{ classification: "asc" }, { name: "asc" }],
    }),
    db.itemUnit.findMany({
      where: { unitCode: unit.code },
      select: { id: true, itemId: true },
    }),
    typeof db.stockMovementImportBatch?.findMany === "function"
      && typeof db.stockMovementImportBatchLine?.findMany === "function"
      ? db.stockMovementImportBatchLine.findMany({
          where: {
            batchId: { in: recentBatches.map((batch: any) => batch.id) },
            mappedItemId: { not: null },
          },
          select: { batchId: true, mappedItemId: true },
        })
      : [],
  ]);

  const linkedMap: Record<string, string> = Object.fromEntries(
    linkedRows.map((r: any) => [r.itemId, r.id])
  );

  const batchItemIdsMap: Record<string, string[]> = {};
  for (const line of batchLines) {
    if (!line.batchId || !line.mappedItemId) continue;
    if (!batchItemIdsMap[line.batchId]) batchItemIdsMap[line.batchId] = [];
    if (!batchItemIdsMap[line.batchId].includes(line.mappedItemId)) {
      batchItemIdsMap[line.batchId].push(line.mappedItemId);
    }
  }

  const batches = recentBatches.map((batch: any) => ({
    ...batch,
    mappedItemCount: batchItemIdsMap[batch.id]?.length || 0,
  }));

  return ok({ items, linkedMap, batches, batchItemIdsMap });
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "").trim();

    const unit = await db.measurementUnit.findUnique({
      where: { id: params.unitId },
      select: { code: true },
    });
    if (!unit) return badRequest("Unidade não encontrada");

    if (_action === "item-unit-link") {
      const itemId = String(formData.get("itemId") || "").trim();
      if (!itemId) return badRequest("Item inválido");
      await db.itemUnit.upsert({
        where: { itemId_unitCode: { itemId, unitCode: unit.code } },
        create: { itemId, unitCode: unit.code },
        update: {},
      });
      return ok("Item vinculado");
    }

    if (_action === "item-unit-unlink") {
      const itemUnitId = String(formData.get("itemUnitId") || "").trim();
      if (!itemUnitId) return badRequest("Vínculo inválido");
      await db.itemUnit.delete({ where: { id: itemUnitId } });
      return ok("Item desvinculado");
    }

    if (_action === "item-unit-link-bulk") {
      const itemIds = formData.getAll("itemId").map((v) => String(v).trim()).filter(Boolean);
      if (itemIds.length === 0) return badRequest("Selecione ao menos um item");
      await Promise.all(
        itemIds.map((itemId) =>
          db.itemUnit.upsert({
            where: { itemId_unitCode: { itemId, unitCode: unit.code } },
            create: { itemId, unitCode: unit.code },
            update: {},
          })
        )
      );
      return ok(`${itemIds.length} item(s) vinculado(s)`);
    }

    if (_action === "item-unit-unlink-bulk") {
      const itemIds = formData.getAll("itemId").map((v) => String(v).trim()).filter(Boolean);
      if (itemIds.length === 0) return badRequest("Selecione ao menos um item");
      await db.itemUnit.deleteMany({
        where: { itemId: { in: itemIds }, unitCode: unit.code },
      });
      return ok(`${itemIds.length} item(s) desvinculado(s)`);
    }

    if (_action === "item-unit-link-batch" || _action === "item-unit-unlink-batch") {
      const batchId = String(formData.get("batchId") || "").trim();
      if (!batchId) return badRequest("Selecione um lote");
      if (typeof db.stockMovementImportBatchLine?.findMany !== "function") {
        return badRequest("Lotes não estão disponíveis neste ambiente");
      }

      const lines = await db.stockMovementImportBatchLine.findMany({
        where: { batchId, mappedItemId: { not: null } },
        select: { mappedItemId: true },
      });
      const itemIds = Array.from(
        new Set(lines.map((line: any) => String(line.mappedItemId || "").trim()).filter(Boolean))
      );

      if (itemIds.length === 0) {
        return badRequest("Esse lote não possui itens mapeados");
      }

      if (_action === "item-unit-link-batch") {
        await Promise.all(
          itemIds.map((itemId) =>
            db.itemUnit.upsert({
              where: { itemId_unitCode: { itemId, unitCode: unit.code } },
              create: { itemId, unitCode: unit.code },
              update: {},
            })
          )
        );
        return ok(`${itemIds.length} item(s) do lote vinculado(s)`);
      }

      await db.itemUnit.deleteMany({
        where: { itemId: { in: itemIds }, unitCode: unit.code },
      });
      return ok(`${itemIds.length} item(s) do lote desvinculado(s)`);
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

type FilterTab = "all" | "linked" | "unlinked";

export default function AdminUnidadesConsumoUnitItems() {
  const { unit } = useOutletContext<{ unit: any }>();
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const payload = loaderData?.payload as any;
  const items: any[] = payload?.items || [];
  const linkedMap: Record<string, string> = payload?.linkedMap || {};
  const batches: any[] = payload?.batches || [];
  const batchItemIdsMap: Record<string, string[]> = payload?.batchItemIdsMap || {};

  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const selectedBatchValue = selectedBatchId || undefined;

  const linkedCount = Object.keys(linkedMap).length;
  const selectedBatchItemIds = selectedBatchId ? batchItemIdsMap[selectedBatchId] || [] : [];
  const selectedBatchItemIdSet = useMemo(
    () => new Set(selectedBatchItemIds),
    [selectedBatchItemIds]
  );
  const selectedBatchLinkedCount = selectedBatchItemIds.filter((itemId) => !!linkedMap[itemId]).length;

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (selectedBatchId && !selectedBatchItemIdSet.has(item.id)) return false;
      if (filterTab === "linked") return !!linkedMap[item.id];
      if (filterTab === "unlinked") return !linkedMap[item.id];
      return true;
    });
  }, [items, linkedMap, search, filterTab, selectedBatchId, selectedBatchItemIdSet]);

  const selectedLinked = selectedIds.filter((id) => !!linkedMap[id]);
  const selectedUnlinked = selectedIds.filter((id) => !linkedMap[id]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? (prev.includes(itemId) ? prev : [...prev, itemId]) : prev.filter((id) => id !== itemId)
    );
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredItems.map((i) => i.id)])));
    } else {
      const visibleIds = new Set(filteredItems.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    }
  }

  const tabBtnClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="flex flex-col gap-3">
      {/* Status + warning */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <span>{linkedCount} vinculado(s)</span>
        <span>·</span>
        <span>{items.length} itens ativos</span>
        {selectedBatchId ? (
          <>
            <span>·</span>
            <span>{selectedBatchItemIds.length} item(ns) no lote selecionado</span>
          </>
        ) : null}
        {unit?.scope !== "restricted" && (
          <>
            <span>·</span>
            <span className="text-amber-600">
              Unidade Global — vínculos sem efeito até mudar para Restrita
            </span>
          </>
        )}
      </div>

      {actionData?.message ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${actionData.status >= 400 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {actionData.message}
        </div>
        ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-slate-900">Vínculo por lote</p>
            <p className="text-xs text-slate-500">
              Selecione um lote importado para filtrar os itens mapeados nele e vincular ou desvincular tudo de uma vez.
            </p>
          </div>
          <div className="min-w-[260px]">
            <Select value={selectedBatchValue} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecionar lote..." />
              </SelectTrigger>
              <SelectContent>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name} ({batch.mappedItemCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedBatchId ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
              {selectedBatchItemIds.length} item(ns) mapeado(s) no lote
            </Badge>
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
              {selectedBatchLinkedCount} já vinculado(s)
            </Badge>

            <Form method="post">
              <input type="hidden" name="_action" value="item-unit-link-batch" />
              <input type="hidden" name="batchId" value={selectedBatchId} />
              <Button type="submit" size="sm" className="h-8 bg-slate-900 text-xs hover:bg-slate-700">
                Vincular lote
              </Button>
            </Form>

            <Form method="post">
              <input type="hidden" name="_action" value="item-unit-unlink-batch" />
              <input type="hidden" name="batchId" value={selectedBatchId} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-8 border-red-200 text-xs text-red-600 hover:bg-red-50"
              >
                Desvincular lote
              </Button>
            </Form>

            <button
              type="button"
              onClick={() => setSelectedBatchId("")}
              className="text-xs text-slate-400 underline hover:text-slate-600"
            >
              Limpar filtro de lote
            </button>
          </div>
        ) : null}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex min-w-[240px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          <button className={tabBtnClass(filterTab === "all")} onClick={() => setFilterTab("all")}>
            Todos ({items.length})
          </button>
          <button className={tabBtnClass(filterTab === "linked")} onClick={() => setFilterTab("linked")}>
            Vinculados ({linkedCount})
          </button>
          <button className={tabBtnClass(filterTab === "unlinked")} onClick={() => setFilterTab("unlinked")}>
            Não vinculados ({items.length - linkedCount})
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-500">
            {selectedIds.length} selecionado(s)
          </span>

          {selectedUnlinked.length > 0 && (
            <Form method="post" className="contents">
              <input type="hidden" name="_action" value="item-unit-link-bulk" />
              {selectedUnlinked.map((id) => (
                <input key={id} type="hidden" name="itemId" value={id} />
              ))}
              <Button type="submit" size="sm" className="h-7 bg-slate-900 hover:bg-slate-700 text-xs">
                Vincular {selectedUnlinked.length} selecionado(s)
              </Button>
            </Form>
          )}

          {selectedLinked.length > 0 && (
            <Form method="post" className="contents">
              <input type="hidden" name="_action" value="item-unit-unlink-bulk" />
              {selectedLinked.map((id) => (
                <input key={id} type="hidden" name="itemId" value={id} />
              ))}
              <Button type="submit" variant="outline" size="sm" className="h-7 border-red-200 text-red-600 hover:bg-red-50 text-xs">
                Desvincular {selectedLinked.length} selecionado(s)
              </Button>
            </Form>
          )}

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 w-10 px-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleAll(e.currentTarget.checked)}
                  aria-label="Selecionar todos visíveis"
                />
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Item</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Classificação</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Vínculo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Lote</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const itemUnitId = linkedMap[item.id];
              const isLinked = !!itemUnitId;
              const isSelected = selectedIds.includes(item.id);
              return (
                <TableRow
                  key={item.id}
                  className={`border-slate-100 hover:bg-slate-50/50 ${isSelected ? "bg-slate-50" : ""}`}
                >
                  <TableCell className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleItem(item.id, e.currentTarget.checked)}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-slate-900">{item.name}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-500">
                    {item.classification || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {isLinked ? (
                      <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                        Vinculado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-400">
                        Não vinculado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {selectedBatchId ? (
                      selectedBatchItemIdSet.has(item.id) ? (
                        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                          No lote
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">Fora do lote</span>
                      )
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {isLinked ? (
                      <Form method="post">
                        <input type="hidden" name="_action" value="item-unit-unlink" />
                        <input type="hidden" name="itemUnitId" value={itemUnitId} />
                        <Button type="submit" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700">
                          Desvincular
                        </Button>
                      </Form>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="_action" value="item-unit-link" />
                        <input type="hidden" name="itemId" value={item.id} />
                        <Button type="submit" variant="ghost" className="h-7 text-xs text-slate-600 hover:text-slate-900">
                          Vincular
                        </Button>
                      </Form>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  {selectedBatchId
                    ? "Nenhum item encontrado para os filtros aplicados neste lote."
                    : search
                      ? `Nenhum item encontrado para "${search}".`
                      : "Nenhum item encontrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
