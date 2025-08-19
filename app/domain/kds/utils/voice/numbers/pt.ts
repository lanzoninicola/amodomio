/** Parse numbers (0–99 and digits) in pt-BR */
export function parseNumberPT(text: string): number | null {
  const mDigits = text.match(/\b(\d{1,4})\b/);
  if (mDigits) return Number(mDigits[1]);

  const NUM: Record<string, number> = {
    zero: 0,
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    três: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    quatorze: 14,
    catorze: 14,
    quinze: 15,
    dezesseis: 16,
    dezassete: 17,
    dezoito: 18,
    dezenove: 19,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
  };

  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (NUM[t] != null) {
      const val = NUM[t];
      if (val >= 20 && val % 10 === 0) {
        let total = val;
        if (tokens[i + 1] === "e") i++;
        if (NUM[tokens[i + 1]] != null && NUM[tokens[i + 1]] < 10)
          total += NUM[tokens[i + 1]];
        return total;
      } else {
        return val;
      }
    }
  }
  return null;
}
