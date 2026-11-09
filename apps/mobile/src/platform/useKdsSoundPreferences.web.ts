import { useEffect, useState } from "react";
import { desktop } from "./desktop";
import { KDS_SOUND_KEY, parseKdsSoundPreferences } from "./kdsSoundPreferences";
export function readKdsSoundPreferences() {
  try {
    return parseKdsSoundPreferences(
      desktop ? localStorage.getItem(KDS_SOUND_KEY) : null
    );
  } catch {
    return parseKdsSoundPreferences(null);
  }
}
export function useKdsSoundPreferences() {
  const [preferences, setPreferences] = useState(readKdsSoundPreferences);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === KDS_SOUND_KEY || event.key === null)
        setPreferences(readKdsSoundPreferences());
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  return preferences;
}
