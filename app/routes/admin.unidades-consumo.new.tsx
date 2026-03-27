import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { ChevronLeft, Search } from "lucide-react";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const KIND_OPTIONS = ["weight", "volume", "count", "custom"] as const;

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const items = await db.item.findMany({
      where: { active: true },
      select: { id: true, name: true, classification: true },
      orderBy: [{ classification: "asc" }, { name: "asc" }],
    });
    return ok({ items });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const code = String(formData.get("code") || "").trim().toUpperCase();
    const name = String(formData.get("name") || "").trim();
    const kind = String(formData.get("kind") || "custom");
    const scope = String(formData.get("scope") || "global") === "restricted" ? "restricted" : "global";
    const itemIds = Array.from(
      new Set(
        formData
          .getAll("itemId")
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );

    if (!code) return badRequest("Informe o código");
    if (!name) return badRequest("Informe o nome");
    if (!/^[A-Z0-9_]+$/.test(code)) return badRequest("Código inválido. Use letras maiúsculas, números e _");
    if (!KIND_OPTIONS.includes(kind as any)) return badRequest("Tipo inválido");

    const existing = await db.measurementUnit.findFirst({ where: { code } });
    if (existing) return badRequest("Já existe uma unidade com esse código");

    const unit = await db.measurementUnit.create({
      data: {
        code,
        name,
        kind,
        scope,
        active: true,
        ItemUnit: itemIds.length > 0
          ? {
              create: itemIds.map((itemId) => ({ itemId })),
            }
          : undefined,
      },
    });

    return redirect(`/admin/unidades-consumo/${unit.id}`);
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminUnidadesConsumoNew() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const items: Array<{ id: string; name: string; classification: string | null }> =
    ((loaderData?.payload as any)?.items || []);
  const [kind, setKind] = useState("custom");
  const [scope, setScope] = useState("global");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        String(item.classification || "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? (prev.includes(itemId) ? prev : [...prev, itemId]) : prev.filter((id) => id !== itemId)
    );
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredItems.map((item) => item.id)])));
      return;
    }
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-5 border-b border-slate-200/80 pb-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/admin/unidades-consumo"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
          >
            <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
              <ChevronLeft size={12} />
            </span>
            unidades de consumo
          </Link>
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Nova unidade</h2>
          <p className="text-sm text-slate-500">Código, nome, tipo e visibilidade da unidade de consumo.</p>
        </div>
      </section>

      {actionData?.message ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${actionData.status >= 400 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {actionData.message}
        </div>
      ) : null}

      <Form method="post" className="space-y-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="code">Código</Label>
                <Input id="code" name="code" placeholder="ex: UN350" required className="mt-1" />
                <p className="mt-1 text-xs text-slate-400">Letras maiúsculas, números e _</p>
              </div>
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="ex: Unidade 350g" required className="mt-1" />
              </div>
            </div>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="scope" value={scope} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibilidade</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global — todos os itens</SelectItem>
                    <SelectItem value="restricted">Restrita — só itens vinculados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {scope === "restricted"
                ? "Os itens selecionados já serão vinculados na criação da unidade."
                : "Você pode já deixar itens pré-vinculados, mas eles só passam a ter efeito quando a unidade estiver como Restrita."}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Itens vinculados iniciais</h3>
                <p className="text-xs text-slate-500">
                  Selecione os itens que já devem nascer vinculados a esta unidade.
                </p>
              </div>
              <div className="text-xs text-slate-500">{selectedIds.length} selecionado(s)</div>
            </div>

            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar item por nome ou classificação..."
                className="pl-9"
              />
            </div>

            {selectedIds.map((itemId) => (
              <input key={itemId} type="hidden" name="itemId" value={itemId} />
            ))}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader className="bg-slate-50/90">
                  <TableRow className="hover:bg-slate-50/90">
                    <TableHead className="h-10 w-10 px-4">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) => toggleAll(event.currentTarget.checked)}
                        aria-label="Selecionar todos os itens visíveis"
                      />
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Item</TableHead>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Classificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
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
                            onChange={(event) => toggleItem(item.id, event.currentTarget.checked)}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3 font-medium text-slate-900">{item.name}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-slate-500">
                          {item.classification || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">
                        Nenhum item encontrado para a busca atual.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">Criar unidade</Button>
          <Link to="/admin/unidades-consumo">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
        </div>
      </Form>
    </div>
  );
}
