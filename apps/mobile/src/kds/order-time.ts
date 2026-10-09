export function elapsedSince(value: string, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60_000)
  );
  if (!Number.isFinite(minutes)) return "--h --mm";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}h ${String(
    minutes % 60
  ).padStart(2, "0")}mm`;
}
