export function ymdToDateInt(ymd: string) {
  const [y = "", m = "", d = ""] = ymd.split("-");
  return Number(`${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`);
}

export function ymdToUtcNoon(ymd: string) {
  const [y = "", m = "", d = ""] = ymd.split("-");
  return new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000Z`
  );
}

export function isValidYMD(ymd: string | undefined | null) {
  if (!ymd) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

export function todayLocalYMD() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(n.getDate()).padStart(2, "0")}`;
}

export function fmtYYYMMDD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function fmtDDMMYY(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

export function fmtHHMM(dateLike: string | Date | undefined | null) {
  if (!dateLike) return "--:--";
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtElapsedHHMM(
  from: string | Date | undefined | null,
  nowMs: number
) {
  if (!from) return "--:--";
  const d = new Date(from);
  const diff = nowMs - d.getTime();
  if (!isFinite(diff) || diff < 0) return "--:--";
  const totalMin = Math.floor(diff / 60000);
  const hh = Math.floor(totalMin / 60)
    .toString()
    .padStart(2, "0");
  const mm = (totalMin % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
