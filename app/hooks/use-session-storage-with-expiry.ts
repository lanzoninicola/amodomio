import { useEffect, useState } from "react";

type ExpirableValue<T> = {
  value: T;
  timestamp: number;
};

export function useLocalStorageWithExpiry<T>(
  key: string,
  expiryMs: number,
  initialValue: T
) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(key);
      const now = Date.now();

      if (raw) {
        const parsed: ExpirableValue<T> = JSON.parse(raw);
        const expired = now - parsed.timestamp > expiryMs;

        if (!expired) {
          setValue(parsed.value);
          return;
        }

        // Expired: limpar
        window.localStorage.removeItem(key);
      }

      // Se não existia ou expirou, definir o valor inicial
      const wrapped: ExpirableValue<T> = {
        value: initialValue,
        timestamp: now,
      };
      window.localStorage.setItem(key, JSON.stringify(wrapped));
      setValue(initialValue);
    } catch (error) {
      console.warn("Erro ao acessar localStorage", error);
    }
  }, [key, expiryMs]);

  const updateValue = (newValue: T) => {
    if (typeof window === "undefined") return;
    const wrapped: ExpirableValue<T> = {
      value: newValue,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(wrapped));
    setValue(newValue);
  };

  return [value, updateValue] as const;
}
