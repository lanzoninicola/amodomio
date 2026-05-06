import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import { cn } from "~/lib/utils";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type UnresolvedRow = { ingredient: string; count: number };

function normalizeAlias(value: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function loadUnresolvedFromCsv(): UnresolvedRow[] {
  const csvPath = join(process.cwd(), "data", "unresolved_ingredients_summary.csv");
  if (!existsSync(csvPath)) return [];
  const raw = readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const dataLines = lines[0]?.toLowerCase().includes("ingredient_normalized")
    ? lines.slice(1)
    : lines;

  const rows: UnresolvedRow[] = [];
  for (const line of dataLines) {
    const idx = line.lastIndexOf(",");
    if (idx === -1) continue;
    const ingredient = line.slice(0, idx).trim();
    const count = Number(line.slice(idx + 1).trim() || 0);
    if (!ingredient) continue;
    rows.push({ ingredient, count: Number.isFinite(count) ? count : 0 });
  }
  return rows;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const unresolved = loadUnresolvedFromCsv();

  const [aliasErr, aliases] = await tryit(
    prismaClient.itemImportAlias.findMany({
      where: {
        active: true,
        aliasNormalized: { in: unresolved.map((row) => normalizeAlias(row.ingredient)) },
      },
      select: {
        aliasNormalized: true,
        itemId: true,
        Item: { select: { name: true } },
      },
    })
  );

  if (aliasErr) return serverError(aliasErr);

  const [itemsErr, items] = await tryit(
    prismaClient.item.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  );

  if (itemsErr) return serverError(itemsErr);

  const aliasMap = new Map(
    (aliases || []).map((alias) => [
      String(alias.aliasNormalized || ""),
      { itemId: alias.itemId, itemName: alias.Item?.name || "" },
    ])
  );

  return ok({ unresolved, aliasMap: Array.from(aliasMap.entries()), items });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action === "upsert-alias") {
    const aliasNormalized = normalizeAlias(String(values.aliasNormalized || ""));
    const aliasName = String(values.aliasName || aliasNormalized).trim() || aliasNormalized;
    const itemId = String(values.itemId || "").trim();

    if (!aliasNormalized || !itemId) {
      return badRequest({ message: "Informe ingrediente e item." });
    }

    const [err] = await tryit(
      prismaClient.itemImportAlias.upsert({
        where: {
          sourceSystem_sourceType_aliasNormalized: {
            sourceSystem: "saipos",
            sourceType: "entrada_nf",
            aliasNormalized,
          },
        },
        create: {
          sourceSystem: "saipos",
          sourceType: "entrada_nf",
          aliasName,
          aliasNormalized,
          itemId,
          active: true,
        },
        update: {
          aliasName,
          itemId,
          active: true,
        },
      })
    );

    if (err) return serverError(err);

    return ok({ message: "Alias salvo com sucesso." });
  }

  return null;
}

export default function AdminItemImportAliases() {
  const loaderData = useLoaderData<typeof loader>();
  const unresolved = (loaderData?.payload.unresolved || []) as UnresolvedRow[];
  const items = (loaderData?.payload.items || []) as Array<{ id: string; name: string }>;
  const aliasMap = new Map<string, { itemId: string; itemName: string }>(
    (loaderData?.payload.aliasMap || []) as Array<[string, { itemId: string; itemName: string }]>
  );

  const actionData = useActionData<typeof action>();
  if (actionData?.status && actionData.status >= 400) {
    toast({ title: "Erro", description: actionData.message });
  }
  if (actionData?.status === 200 && actionData?.message) {
    toast({ title: "Sucesso", description: actionData.message });
  }

  const [searchTerm, setSearchTerm] = useState("");
  const filteredRows = useMemo(() => {
    if (!searchTerm) return unresolved;
    const term = searchTerm.toLowerCase();
    return unresolved.filter((row) => row.ingredient.toLowerCase().includes(term));
  }, [searchTerm, unresolved]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Item Import Aliases
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">{filteredRows.length}</div>
            <div className="text-xs text-slate-500">ingredientes pendentes</div>
          </div>

          <div className="flex w-full items-center gap-2 md:w-auto">
            <div className="relative min-w-[220px] flex-1">
              <Input
                type="text"
                placeholder="Buscar ingrediente..."
                className="w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ingrediente
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ocorrências
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mapeamento
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ação
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum ingrediente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <ItemAliasRow
                  key={row.ingredient}
                  row={row}
                  items={items}
                  itemsById={itemsById}
                  existing={aliasMap.get(normalizeAlias(row.ingredient))}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ItemAliasRow({
  row,
  items,
  itemsById,
  existing,
}: {
  row: UnresolvedRow;
  items: Array<{ id: string; name: string }>;
  itemsById: Map<string, { id: string; name: string }>;
  existing?: { itemId: string; itemName: string };
}) {
  const [itemOpen, setItemOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(existing?.itemId || "");
  const selectedItem = itemsById.get(selectedItemId || "");
  const normalized = normalizeAlias(row.ingredient);

  return (
    <TableRow key={normalized} className="hover:bg-slate-50">
      <TableCell className="px-4 py-3 text-sm font-semibold text-slate-900">{row.ingredient}</TableCell>
      <TableCell className="px-4 py-3 text-sm text-slate-600">{row.count}</TableCell>
      <TableCell className="px-4 py-3 text-sm text-slate-700">
        <Form method="post" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="_action" value="upsert-alias" />
          <input type="hidden" name="aliasNormalized" value={row.ingredient} />
          <input type="hidden" name="itemId" value={selectedItemId} />
          <Input name="aliasName" defaultValue={row.ingredient} className="h-9 w-[220px] text-xs" />
          <Popover open={itemOpen} onOpenChange={setItemOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={itemOpen}
                className="h-9 w-[280px] justify-between text-xs font-normal"
              >
                <span className="truncate text-left">
                  {selectedItem ? `${selectedItem.name} (${selectedItem.id})` : "Selecionar item..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar item..." />
                <CommandList className="max-h-[45vh]">
                  <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.name} ${item.id}`}
                      onSelect={() => {
                        setSelectedItemId(item.id);
                        setItemOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", selectedItemId === item.id ? "opacity-100" : "opacity-0")}
                      />
                      <span className="truncate">{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {existing ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              {existing.itemName || "map"}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
              pendente
            </span>
          )}
          <button
            type="submit"
            className="ml-auto h-9 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Salvar
          </button>
        </Form>
      </TableCell>
      <TableCell className="px-4 py-3 text-right text-xs text-slate-500">
        {existing ? "Atualizar" : "Criar"}
      </TableCell>
    </TableRow>
  );
}
