export type SupplierContactInput = {
  name: string;
  phoneNumber: string | null;
  email: string | null;
  isPrimary: boolean;
};

export function parseSupplierContacts(formData: FormData): SupplierContactInput[] {
  const names = formData.getAll("contactNames").map((value) => String(value || "").trim());
  const phoneNumbers = formData.getAll("contactPhoneNumbers").map((value) => normalizeNullable(value));
  const emails = formData.getAll("contactEmails").map((value) => normalizeNullable(value));
  const primaryContactIndex = Number(formData.get("primaryContactIndex"));
  const contacts: SupplierContactInput[] = [];
  const total = Math.max(names.length, phoneNumbers.length, emails.length);

  for (let index = 0; index < total; index += 1) {
    const name = names[index] || "";
    const phoneNumber = phoneNumbers[index] || null;
    const email = emails[index] || null;

    if (!name && !phoneNumber && !email) continue;

    if (!name) {
      throw new Error(`Informe o nome do contato ${index + 1}.`);
    }

    contacts.push({
      name,
      phoneNumber,
      email,
      isPrimary: index === primaryContactIndex,
    });
  }

  if (contacts.length > 0 && !contacts.some((contact) => contact.isPrimary)) {
    contacts[0] = { ...contacts[0], isPrimary: true };
  }

  return contacts;
}

export function getSupplierContactSnapshot(contacts: SupplierContactInput[]) {
  const primaryContact = contacts.find((contact) => contact.isPrimary) || contacts[0] || null;

  return {
    contactName: primaryContact?.name || null,
    phoneNumber: primaryContact?.phoneNumber || null,
    email: primaryContact?.email || null,
  };
}

function normalizeNullable(value: FormDataEntryValue | undefined) {
  const text = String(value || "").trim();
  return text || null;
}
