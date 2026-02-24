import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function loader({ params }: LoaderFunctionArgs) {
  const supplierId = params.id;

  if (!supplierId) {
    return badRequest({ message: "Fornecedor não informado" });
  }

  const [err, supplier] = await tryit(supplierPrismaEntity.findById(supplierId));

  if (err) {
    return serverError(err);
  }

  if (!supplier) {
    return badRequest({ message: "Fornecedor não encontrado" });
  }

  return ok({ supplier });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const supplierId = params.id;
  if (!supplierId) {
    return badRequest({ message: "Fornecedor não informado" });
  }

  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action === "supplier-update") {
    const [err] = await tryit(
      supplierPrismaEntity.update(supplierId, {
        name: String(values.name || "").trim(),
        contactName: normalizeNullable(values.contactName),
        phoneNumber: normalizeNullable(values.phoneNumber),
        email: normalizeNullable(values.email),
      })
    );

    if (err) {
      return serverError(err);
    }

    return ok({ message: "Fornecedor atualizado com sucesso" });
  }

  if (_action === "supplier-delete") {
    const [err] = await tryit(supplierPrismaEntity.delete(supplierId));

    if (err) {
      return serverError(err);
    }

    return redirect("/admin/suppliers");
  }

  return null;
}

type SupplierRecord = {
  id: string;
  name: string;
  contactName: string | null;
  phoneNumber: string | null;
  email: string | null;
};

export default function AdminSupplierEdit() {
  const loaderData = useLoaderData<typeof loader>();
  const supplier = loaderData?.payload.supplier as SupplierRecord;

  const actionData = useActionData<typeof action>();
  if (actionData?.status && actionData.status >= 400) {
    toast({ title: "Erro", description: actionData.message });
  }
  if (actionData?.status === 200 && actionData?.message) {
    toast({ title: "Sucesso", description: actionData.message });
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Link
              to="/admin/suppliers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft size={14} />
              Voltar para fornecedores
            </Link>
            <CardTitle className="mt-2">Editar fornecedor</CardTitle>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            ID: {supplier.id.slice(0, 8)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Form method="post" className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Fieldset>
              <Label htmlFor="supplier-name">Nome</Label>
              <Input id="supplier-name" name="name" required defaultValue={supplier.name} autoComplete="off" />
            </Fieldset>

            <Fieldset>
              <Label htmlFor="supplier-contact-name">Contato</Label>
              <Input
                id="supplier-contact-name"
                name="contactName"
                defaultValue={supplier.contactName || ""}
                autoComplete="off"
              />
            </Fieldset>

            <Fieldset>
              <Label htmlFor="supplier-phone">Telefone</Label>
              <Input
                id="supplier-phone"
                name="phoneNumber"
                defaultValue={supplier.phoneNumber || ""}
                autoComplete="off"
              />
            </Fieldset>

            <Fieldset>
              <Label htmlFor="supplier-email">E-mail</Label>
              <Input
                id="supplier-email"
                name="email"
                type="email"
                defaultValue={supplier.email || ""}
                autoComplete="off"
              />
            </Fieldset>
          </div>

          <div className="flex justify-end">
            <SubmitButton actionName="supplier-update" idleText="Salvar alterações" loadingText="Salvando..." />
          </div>
        </Form>

        <Separator />

        <Form method="post" className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-500">Excluir este fornecedor do cadastro.</div>
          <Button type="submit" name="_action" value="supplier-delete" variant="destructive">
            Excluir fornecedor
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}

function normalizeNullable(value: FormDataEntryValue | undefined) {
  const text = String(value || "").trim();
  return text || null;
}
