import { useEffect, useState } from "react";
import { useLocalStorageWithExpiry } from "./use-session-storage-with-expiry";

const SESSION_EXPIRATION_MS = 2 * 60 * 60 * 1000; // 2h

export function useClientSessionId() {
  const [sessionId, setSessionId] = useLocalStorageWithExpiry<string | null>(
    "sessionId",
    SESSION_EXPIRATION_MS,
    null
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionId) {
      const newId = crypto.randomUUID();
      setSessionId(newId);
    }
  }, [sessionId, setSessionId]);

  return sessionId;
}
