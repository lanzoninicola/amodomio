/** Parse numbers (0–99 and digits) in it-IT */
export function parseNumberIT(text: string): number | null {
  const mDigits = text.match(/\b(\d{1,4})\b/);
  if (mDigits) return Number(mDigits[1]);

  const NUM: Record<string, number> = {
    zero: 0,
    uno: 1,
    una: 1,
    due: 2,
    tre: 3,
    quattro: 4,
    cinque: 5,
    sei: 6,
    sette: 7,
    otto: 8,
    nove: 9,
    dieci: 10,
    undici: 11,
    dodici: 12,
    tredici: 13,
    quattordici: 14,
    quindici: 15,
    sedici: 16,
    diciassette: 17,
    diciotto: 18,
    diciannove: 19,
    venti: 20,
    trenta: 30,
    quaranta: 40,
    cinquanta: 50,
    sessanta: 60,
    settanta: 70,
    ottanta: 80,
    novanta: 90,
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
