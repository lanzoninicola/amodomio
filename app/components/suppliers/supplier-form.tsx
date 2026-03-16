import { Trash2, PlusCircle, Star } from "lucide-react";
import { useState } from "react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import Fieldset from "~/components/ui/fieldset";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

type SupplierContactFormValue = {
  name: string;
  phoneNumber: string | null;
  email: string | null;
  isPrimary: boolean;
};

type SupplierFormValues = {
  name: string;
  cnpj: string;
  contacts: SupplierContactFormValue[];
};

type ContactDraft = {
  key: string;
  name: string;
  phoneNumber: string;
  email: string;
  isPrimary: boolean;
};

function createBlankContact(isPrimary = false): ContactDraft {
  return {
    key: `contact-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    phoneNumber: "",
    email: "",
    isPrimary,
  };
}

export function SupplierForm({
  actionName,
  submitLabel,
  defaultValues,
}: {
  actionName: string;
  submitLabel: string;
  defaultValues?: Partial<SupplierFormValues>;
}) {
  const [contacts, setContacts] = useState<ContactDraft[]>(() => {
    const seeded = (defaultValues?.contacts || []).map((contact, index) => ({
      key: `contact-${index}`,
      name: contact.name || "",
      phoneNumber: contact.phoneNumber || "",
      email: contact.email || "",
      isPrimary: Boolean(contact.isPrimary),
    }));

    if (seeded.length > 0) {
      return ensurePrimary(seeded);
    }

    return [createBlankContact(true)];
  });

  const primaryContactIndex = Math.max(
    0,
    contacts.findIndex((contact) => contact.isPrimary)
  );

  function updateContact(
    index: number,
    field: "name" | "phoneNumber" | "email",
    value: string
  ) {
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [field]: value } : contact
      )
    );
  }

  function setPrimaryContact(index: number) {
    setContacts((current) =>
      current.map((contact, contactIndex) => ({
        ...contact,
        isPrimary: contactIndex === index,
      }))
    );
  }

  function addContact() {
    setContacts((current) => [...current, createBlankContact(current.length === 0)]);
  }

  function removeContact(index: number) {
    setContacts((current) => {
      if (current.length === 1) {
        return [createBlankContact(true)];
      }

      return ensurePrimary(current.filter((_, contactIndex) => contactIndex !== index));
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Fieldset>
          <Label htmlFor="supplier-name">Nome</Label>
          <Input
            id="supplier-name"
            name="name"
            required
            defaultValue={defaultValues?.name || ""}
            autoComplete="off"
          />
        </Fieldset>

        <Fieldset>
          <Label htmlFor="supplier-cnpj">CNPJ</Label>
          <Input
            id="supplier-cnpj"
            name="cnpj"
            defaultValue={defaultValues?.cnpj || ""}
            autoComplete="off"
          />
        </Fieldset>
      </div>

      <Separator />

      <input type="hidden" name="primaryContactIndex" value={String(primaryContactIndex)} />

      <div className="mb-4 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Contatos</div>
            <div className="text-xs text-slate-500">Cadastre um ou mais contatos para este fornecedor.</div>
          </div>
          <Button type="button" onClick={addContact} className="gap-2">
            <PlusCircle size={16} />
            Adicionar contato
          </Button>
        </div>


        <div className="grid gap-3">
          {contacts.map((contact, index) => (
            <div key={contact.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPrimaryContact(index)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${contact.isPrimary
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600"
                    }`}
                >
                  <Star size={14} className={contact.isPrimary ? "fill-current" : ""} />
                  {contact.isPrimary ? "Contato principal" : "Definir como principal"}
                </button>

                <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(index)} className="gap-2">
                  <Trash2 size={14} />
                  Remover
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Fieldset>
                  <Label htmlFor={`supplier-contact-name-${contact.key}`}>Nome do contato</Label>
                  <Input
                    id={`supplier-contact-name-${contact.key}`}
                    name="contactNames"
                    value={contact.name}
                    onChange={(event) => updateContact(index, "name", event.target.value)}
                    autoComplete="off"
                  />
                </Fieldset>

                <Fieldset>
                  <Label htmlFor={`supplier-contact-phone-${contact.key}`}>Telefone / WhatsApp</Label>
                  <Input
                    id={`supplier-contact-phone-${contact.key}`}
                    name="contactPhoneNumbers"
                    value={contact.phoneNumber}
                    onChange={(event) => updateContact(index, "phoneNumber", event.target.value)}
                    autoComplete="off"
                  />
                </Fieldset>

                <Fieldset>
                  <Label htmlFor={`supplier-contact-email-${contact.key}`}>E-mail</Label>
                  <Input
                    id={`supplier-contact-email-${contact.key}`}
                    name="contactEmails"
                    type="email"
                    value={contact.email}
                    onChange={(event) => updateContact(index, "email", event.target.value)}
                    autoComplete="off"
                  />
                </Fieldset>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton actionName={actionName} idleText={submitLabel} loadingText="Salvando..." />
      </div>
    </div>
  );
}


function ensurePrimary(contacts: ContactDraft[]) {
  if (contacts.length === 0) return contacts;
  if (contacts.some((contact) => contact.isPrimary)) return contacts;
  return contacts.map((contact, index) => ({ ...contact, isPrimary: index === 0 }));
}
