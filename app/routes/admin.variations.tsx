import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import EditItemButton from "~/components/primitives/table-list/action-buttons/edit-item-button/edit-item-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { variationPrismaEntity } from "~/domain/item/variation.prisma.entity.server";

export const meta: MetaFunction = () => [{ title: "Admin • Variações" }];

type ActionData = {
  formError?: string;
  success?: string;
};

function str(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const kind = str(url.searchParams.get("kind"));
  const variations = await variationPrismaEntity.findAll({
    kind: kind || undefined,
  });

  return json({ variations, kind });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = str(formData.get("_action"));

  try {
    if (action === "create") {
      await variationPrismaEntity.create({
        kind: str(formData.get("kind")),
        code: str(formData.get("code")),
        name: str(formData.get("name")),
      });
      return redirect("/admin/variations");
    }

    if (action === "update") {
      const id = str(formData.get("id"));
      await variationPrismaEntity.update(id, {
        kind: str(formData.get("kind")),
        code: str(formData.get("code")),
        name: str(formData.get("name")),
      });
      return redirect("/admin/variations");
    }

    if (action === "delete") {
      const id = str(formData.get("id"));
      await variationPrismaEntity.softDelete(id);
      return redirect("/admin/variations");
    }

    if (action === "initialize-defaults") {
      await variationPrismaEntity.ensureBaseVariation();

      const menuItemSizes = await (prismaClient as any).menuItemSize
        .findMany({
          where: { deletedAt: null },
          orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        })
        .catch(async () => {
          return await (prismaClient as any).menuItemSize.findMany({
            orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
          });
        });

      for (const size of menuItemSizes || []) {
        const code = String(size?.key || "").trim().toLowerCase() || `size-${size.id}`;
        const name = String(size?.name || code).trim();
        const existing = await variationPrismaEntity.findByKindAndCode("size", code);

        if (!existing) {
          await variationPrismaEntity.create({
            kind: "size",
            code,
            name,
          });
          continue;
        }

        if (existing.deletedAt || existing.name !== name) {
          await variationPrismaEntity.update(existing.id, {
            kind: "size",
            code,
            name,
          });

          if (existing.deletedAt) {
            await (prismaClient as any).variation.update({
              where: { id: existing.id },
              data: { deletedAt: null },
            });
          }
        }
      }

      return json({ success: "Variações padrão inicializadas (base + tamanhos)." } satisfies ActionData);
    }

    return json({ formError: "Ação inválida." } satisfies ActionData, { status: 400 });
  } catch (error: any) {
    return json(
      { formError: error?.message || "Não foi possível processar a ação." } satisfies ActionData,
      { status: 400 }
    );
  }
}

export default function AdminVariationsRoute() {
  const { variations, kind } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const sizeCount = variations.filter((v: any) => v.kind === "size").length;
  const baseCount = variations.filter((v: any) => v.kind === "base").length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variações</div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">{variations.length}</div>
            <div className="text-xs text-slate-500">registros no catálogo global</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              Base: {baseCount}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              Size: {sizeCount}
            </Badge>
            <Form method="post">
              <input type="hidden" name="_action" value="initialize-defaults" />
              <Button type="submit" variant="outline" disabled={isSubmitting}>
                {isSubmitting ? "Processando..." : "Inicializar base + tamanhos"}
              </Button>
            </Form>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Catálogo global de variações para vincular em `ItemVariation` (ex.: `base`, `size`).
        </p>

        {!!actionData?.formError && <p className="mt-3 text-sm text-red-600">{actionData.formError}</p>}
        {!!actionData?.success && <p className="mt-3 text-sm text-emerald-700">{actionData.success}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cadastro</div>
          <h2 className="text-sm font-semibold text-slate-900">Nova variação</h2>
        </div>

        <Form method="post" className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="_action" value="create" />
          <div>
            <Label htmlFor="kind">Kind</Label>
            <Input id="kind" name="kind" placeholder="size" defaultValue={kind || ""} required />
          </div>
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" placeholder="pizza-medium" required />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" placeholder="Pizza Média" required />
          </div>
          <div className="md:col-span-4">
            <Button type="submit" className="bg-slate-900 hover:bg-slate-700" disabled={isSubmitting}>
              Criar variação
            </Button>
          </div>
        </Form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Kind
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Code
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Variação
              </TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variations.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                  Nenhuma variação cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              variations.map((variation: any) => (
                <TableRow key={variation.id} className="border-slate-100 hover:bg-slate-50/50">
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="border-slate-200 bg-white font-mono text-xs text-slate-700">
                      {variation.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs text-slate-700">{variation.code}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        to={`/admin/variations/${variation.id}`}
                        className="truncate font-semibold text-slate-900 hover:underline"
                        title={variation.name}
                      >
                        {variation.name}
                      </Link>
                      <span className="text-xs text-slate-500">ID: {variation.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <EditItemButton to={`/admin/variations/${variation.id}`} />
                      <Form
                        method="post"
                        onSubmit={(e) => {
                          if (!confirm("Remover esta variação?")) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="_action" value="delete" />
                        <input type="hidden" name="id" value={variation.id} />
                        <Button type="submit" size="sm" variant="destructive" disabled={isSubmitting}>
                          Excluir
                        </Button>
                      </Form>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>0 of {variations.length} row(s) selected.</span>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-slate-700">Rows per page</span>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              {variations.length}
            </Badge>
            <span className="text-xs font-semibold text-slate-900">Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
