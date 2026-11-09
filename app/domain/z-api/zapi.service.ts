const PHONE_REGEX = /^[1-9]\d{7,14}$/;

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!PHONE_REGEX.test(digits)) return null;
  return digits;
}
