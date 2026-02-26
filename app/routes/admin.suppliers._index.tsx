import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { Search, PlusCircle } from "lucide-react";
import { useState } from "react";
import { DeleteItemButton, EditItemButton } from "~/components/primitives/table-list";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { toast } from "~/components/ui/use-toast";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function loader({ request }: LoaderFunctionArgs) {
  const [err, suppliers] = await tryit(supplierPrismaEntity.findAll());

  if (err) {
    return serverError(err);
  }

  return ok({ suppliers });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action === "supplier-delete") {
    const supplierId = String(values.id || "");

    const [err] = await tryit(supplierPrismaEntity.delete(supplierId));

    if (err) {
      return serverError(err);
    }

    return ok({ message: "Fornecedor removido com sucesso" });
  }

  return null;
}

type SupplierListItem = {
  id: string;
  name: string;
  contactName: string | null;
  phoneNumber: string | null;
  email: string | null;
};

export default function AdminSuppliersIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const suppliers = (loaderData?.payload.suppliers || []) as SupplierListItem[];

  const actionData = useActionData<typeof action>();
  if (actionData?.status && actionData.status >= 400) {
    toast({ title: "Erro", description: actionData.message });
  }

  const [searchTerm, setSearchTerm] = useState("");
  const filteredSuppliers = suppliers.filter((supplier) => {
    const term = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(term) ||
      (supplier.contactName || "").toLowerCase().includes(term) ||
      (supplier.phoneNumber || "").toLowerCase().includes(term) ||
      (supplier.email || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedores</div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">{filteredSuppliers.length}</div>
            <div className="text-xs text-slate-500">registros encontrados</div>
          </div>

          <div className="flex w-full items-center gap-2 md:w-auto">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar fornecedor..."
                className="w-full pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Link
              to="/admin/suppliers/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <PlusCircle size={16} />
              Novo
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Contato</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">E-mail</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="border-slate-100 hover:bg-slate-50/50">
                  <TableCell className="px-4 py-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link to={`/admin/suppliers/${supplier.id}`} className="truncate font-semibold text-slate-900 hover:underline">
                        {supplier.name}
                      </Link>
                      <span className="text-xs text-slate-500">ID: {supplier.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="border-slate-200 bg-white font-medium text-slate-700">
                      {supplier.contactName || "Sem contato"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-700">{supplier.phoneNumber || "-"}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-700">{supplier.email || "-"}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <EditItemButton to={`/admin/suppliers/${supplier.id}`} />
                      <Form method="post">
                        <Input type="hidden" name="id" value={supplier.id} />
                        <DeleteItemButton actionName="supplier-delete" />
                      </Form>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>0 of {filteredSuppliers.length} row(s) selected.</span>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-slate-700">Rows per page</span>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{filteredSuppliers.length || 0}</Badge>
            <span className="text-xs font-semibold text-slate-900">Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
