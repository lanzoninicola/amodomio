/**
 * Normaliza telefone BR para E.164.
 * Exemplos:
 *  - "44999999999" -> "+5544999999999"
 *  - "+55 44 99999-9999" -> "+5544999999999"
 *  - "044999999999" -> "+5544999999999"
 *  - "11987654321" -> "+5511987654321"
 * Retorna null se não conseguir validar DDD (2 dígitos) e número (8 ou 9 dígitos).
 */
export function normalize_phone_e164_br(input: string): string | null {
  const digits = (input || "").replace(/\D+/g, "");
  let num = digits;

  if (num.startsWith("55")) num = num.slice(2);
  else if (num.startsWith("0")) num = num.replace(/^0+/, "");

  if (num.length < 10 || num.length > 11) return null;

  const ddd = num.slice(0, 2);
  const local = num.slice(2);

  if (!/^\d{2}$/.test(ddd)) return null;
  if (!/^\d{8,9}$/.test(local)) return null;

  return `+55${ddd}${local}`;
}
