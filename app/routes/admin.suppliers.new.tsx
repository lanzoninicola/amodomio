import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { SupplierForm } from "~/components/suppliers/supplier-form";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "~/components/ui/use-toast";
import { getSupplierContactSnapshot, parseSupplierContacts } from "~/domain/supplier/supplier-contacts.server";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
import { badRequest, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action !== "supplier-create") {
    return null;
  }

  let contacts;
  try {
    contacts = parseSupplierContacts(formData);
  } catch (error) {
    return badRequest({
      message: error instanceof Error ? error.message : "Nao foi possivel validar os contatos.",
    });
  }

  const primaryContact = getSupplierContactSnapshot(contacts);

  const [err, created] = await tryit(
    supplierPrismaEntity.create({
      name: String(values.name || "").trim(),
      cnpj: normalizeNullable(values.cnpj),
      ...primaryContact,
      contacts: contacts.length > 0 ? { create: contacts } : undefined,
    })
  );

  if (err) {
    return serverError(err);
  }

  return redirect(`/admin/suppliers/${created.id}`);
}

export default function AdminSupplierNew() {
  const actionData = useActionData<typeof action>();
  if (actionData?.status && actionData.status >= 400) {
    toast({ title: "Erro", description: actionData.message });
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Novo fornecedor</CardTitle>
      </CardHeader>
      <CardContent>
        <Form method="post">
          <SupplierForm actionName="supplier-create" submitLabel="Criar fornecedor" />
        </Form>
      </CardContent>
    </Card>
  );
}

function normalizeNullable(value: FormDataEntryValue | undefined) {
  const text = String(value || "").trim();
  return text || null;
}
