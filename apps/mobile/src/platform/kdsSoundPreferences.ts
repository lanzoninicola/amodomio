export type KdsSoundPreferences = { enabled: boolean; volume: number };
export const KDS_SOUND_KEY = "amodomio.desktop.kds.sound";
export function parseKdsSoundPreferences(
  raw: string | null
): KdsSoundPreferences {
  try {
    const saved = JSON.parse(raw ?? "null");
    return {
      enabled: typeof saved?.enabled === "boolean" ? saved.enabled : true,
      volume:
        typeof saved?.volume === "number" && Number.isFinite(saved.volume)
          ? Math.min(1, Math.max(0, saved.volume))
          : 1,
    };
  } catch {
    return { enabled: true, volume: 1 };
  }
}
