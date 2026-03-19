import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { SupplierForm } from "~/components/suppliers/supplier-form";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { getSupplierContactSnapshot, parseSupplierContacts } from "~/domain/supplier/supplier-contacts.server";
import { supplierPrismaEntity } from "~/domain/supplier/supplier.prisma.entity.server";
import { normalizePhone } from "~/domain/z-api/zapi.service";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function loader({ params }: LoaderFunctionArgs) {
  const supplierId = params.id;

  if (!supplierId) {
    return badRequest({ message: "Fornecedor não informado" });
  }

  const [err, supplier] = await tryit(supplierPrismaEntity.findByIdWithContacts(supplierId));

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
    let contacts;
    try {
      contacts = parseSupplierContacts(formData);
    } catch (error) {
      return badRequest({
        message: error instanceof Error ? error.message : "Nao foi possivel validar os contatos.",
        activeTab: "details",
      });
    }

    const primaryContact = getSupplierContactSnapshot(contacts);
    const [err] = await tryit(
      supplierPrismaEntity.update(supplierId, {
        name: String(values.name || "").trim(),
        cnpj: normalizeNullable(values.cnpj),
        ...primaryContact,
        contacts: {
          deleteMany: {},
          ...(contacts.length > 0 ? { create: contacts } : {}),
        },
      })
    );

    if (err) {
      return serverError(err);
    }

    return ok({ message: "Fornecedor atualizado com sucesso", activeTab: "details" });
  }

  if (_action === "supplier-send-whatsapp") {
    const [findError, supplier] = await tryit(supplierPrismaEntity.findByIdWithContacts(supplierId));

    if (findError) {
      return serverError(findError);
    }

    if (!supplier) {
      return badRequest({ message: "Fornecedor nao encontrado", activeTab: "whatsapp" });
    }

    const contactId = String(values.contactId || "");
    const message = String(values.message || "").trim();
    const contact = supplier.contacts.find((item) => item.id === contactId);

    if (!contact) {
      return badRequest({ message: "Selecione um contato para envio.", activeTab: "whatsapp" });
    }

    const phone = normalizePhone(contact.phoneNumber);

    if (!phone) {
      return badRequest({
        message: `O contato ${contact.name} nao possui um WhatsApp valido.`,
        activeTab: "whatsapp",
      });
    }

    if (!message) {
      return badRequest({ message: "Cole uma mensagem antes de enviar.", activeTab: "whatsapp" });
    }

    const [sendError] = await tryit(
      sendTextMessage({ phone, message })
    );

    if (sendError) {
      return serverError(sendError);
    }

    return ok({
      message: `Mensagem enviada para ${contact.name}.`,
      activeTab: "whatsapp",
    });
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
  cnpj: string | null;
  contactName: string | null;
  phoneNumber: string | null;
  email: string | null;
  contacts: Array<{
    id: string;
    name: string;
    phoneNumber: string | null;
    email: string | null;
    isPrimary: boolean;
  }>;
};

export default function AdminSupplierEdit() {
  const loaderData = useLoaderData<typeof loader>();
  const supplier = loaderData?.payload.supplier as SupplierRecord;

  const actionData = useActionData<typeof action>();
  const [activeTab, setActiveTab] = useState(actionData?.payload?.activeTab || "details");

  useEffect(() => {
    if (actionData?.payload?.activeTab) {
      setActiveTab(actionData.payload.activeTab);
    }
  }, [actionData]);

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
          <TabsList className="rounded-lg border border-slate-200 bg-slate-50/90">
            <TabsTrigger value="details">Dados</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Form method="post">
              <SupplierForm
                actionName="supplier-update"
                submitLabel="Salvar alterações"
                defaultValues={{
                  name: supplier.name,
                  cnpj: supplier.cnpj || "",
                  contacts:
                    supplier.contacts.length > 0
                      ? supplier.contacts
                      : supplier.contactName || supplier.phoneNumber || supplier.email
                        ? [
                            {
                              name: supplier.contactName || "",
                              phoneNumber: supplier.phoneNumber,
                              email: supplier.email,
                              isPrimary: true,
                            },
                          ]
                        : [],
                }}
              />
            </Form>

            <Separator />

            <Form method="post" className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-500">Excluir este fornecedor do cadastro.</div>
              <Button type="submit" name="_action" value="supplier-delete" variant="destructive">
                Excluir fornecedor
              </Button>
            </Form>
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsappTab supplier={supplier} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function WhatsappTab({ supplier }: { supplier: SupplierRecord }) {
  const availableContacts = supplier.contacts.filter((contact) => normalizePhone(contact.phoneNumber));
  const fallbackContactId = availableContacts[0]?.id || "";
  const [contactId, setContactId] = useState(fallbackContactId);

  useEffect(() => {
    setContactId(fallbackContactId);
  }, [fallbackContactId]);

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
            <MessageCircle size={18} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">Enviar mensagem via Z-API</div>
            <div className="text-sm text-slate-600">
              Escolha um contato com WhatsApp valido, cole a mensagem e envie direto desta tela.
            </div>
          </div>
        </div>
      </div>

      {availableContacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          Nenhum contato com numero de WhatsApp valido cadastrado para este fornecedor.
        </div>
      ) : (
        <Form method="post" className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2">
            <Label htmlFor="supplier-whatsapp-contact">Contato</Label>
            <Select name="contactId" value={contactId} onValueChange={setContactId}>
              <SelectTrigger id="supplier-whatsapp-contact" className="w-full md:max-w-md">
                <SelectValue placeholder="Selecione um contato" />
              </SelectTrigger>
              <SelectContent>
                {availableContacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name}
                    {contact.phoneNumber ? ` - ${contact.phoneNumber}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplier-whatsapp-message">Mensagem</Label>
            <Textarea
              id="supplier-whatsapp-message"
              name="message"
              rows={10}
              placeholder="Cole aqui a mensagem que deve ser enviada para o contato selecionado."
              className="min-h-[220px]"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" name="_action" value="supplier-send-whatsapp" className="gap-2">
              <MessageCircle size={16} />
              Enviar WhatsApp
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
}

function normalizeNullable(value: FormDataEntryValue | undefined) {
  const text = String(value || "").trim();
  return text || null;
}
