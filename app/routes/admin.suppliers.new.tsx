import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "~/components/ui/use-toast";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
import { serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action !== "supplier-create") {
    return null;
  }

  const [err, created] = await tryit(
    supplierPrismaEntity.create({
      name: String(values.name || "").trim(),
      contactName: normalizeNullable(values.contactName),
      phoneNumber: normalizeNullable(values.phoneNumber),
      email: normalizeNullable(values.email),
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
        <SupplierForm actionName="supplier-create" submitLabel="Criar fornecedor" />
      </CardContent>
    </Card>
  );
}

function SupplierForm({
  actionName,
  submitLabel,
}: {
  actionName: string;
  submitLabel: string;
}) {
  return (
    <Form method="post" className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Fieldset>
          <Label htmlFor="supplier-name">Nome</Label>
          <Input id="supplier-name" name="name" required autoComplete="off" />
        </Fieldset>

        <Fieldset>
          <Label htmlFor="supplier-contact-name">Contato</Label>
          <Input id="supplier-contact-name" name="contactName" autoComplete="off" />
        </Fieldset>

        <Fieldset>
          <Label htmlFor="supplier-phone">Telefone</Label>
          <Input id="supplier-phone" name="phoneNumber" autoComplete="off" />
        </Fieldset>

        <Fieldset>
          <Label htmlFor="supplier-email">E-mail</Label>
          <Input id="supplier-email" name="email" type="email" autoComplete="off" />
        </Fieldset>
      </div>

      <div className="flex justify-end">
        <SubmitButton actionName={actionName} idleText={submitLabel} loadingText="Salvando..." />
      </div>
    </Form>
  );
}

function normalizeNullable(value: FormDataEntryValue | undefined) {
  const text = String(value || "").trim();
  return text || null;
}
