import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  NotificationEntry,
  clearNotifications,
  loadNotifications,
  markAllAsRead as persistMarkAllAsRead,
  markAsRead as persistMarkAsRead,
  upsertNotification,
} from "./notification-storage";

type NotificationCenterContextValue = {
  items: NotificationEntry[];
  initialized: boolean;
  unreadCount: number;
  addNotification: (entry: NotificationEntry) => Promise<void>;
  addFromPayload: (payload: any) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
};

const NotificationCenterContext = createContext<NotificationCenterContextValue | null>(null);

function normalizePayload(payload: any): NotificationEntry {
  const ts = typeof payload?.ts === "number" ? payload.ts : Date.now();
  const fallbackId = `${payload?.campaignId ?? "local"}-${ts}`;
  return {
    id: payload?.id || fallbackId,
    title: payload?.title || "Notificação",
    body: payload?.body,
    url: payload?.url,
    ts,
    read: false,
    type: payload?.type,
    source: payload?.source || "push",
  };
}

export function NotificationCenterProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [initialized, setInitialized] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (isMountedRef.current) {
        setItems([]);
        setInitialized(true);
      }
      return;
    }

    loadNotifications()
      .then((loaded) => {
        if (isMountedRef.current) setItems(loaded);
      })
      .finally(() => {
        if (isMountedRef.current) setInitialized(true);
      });
  }, [enabled]);

  const addNotification = useCallback(async (entry: NotificationEntry) => {
    if (!enabled) return;
    const next = await upsertNotification(entry);
    if (isMountedRef.current) setItems(next);
  }, [enabled]);

  const addFromPayload = useCallback(
    async (payload: any) => {
      const normalized = normalizePayload(payload);
      await addNotification(normalized);
    },
    [addNotification]
  );

  const markAsRead = useCallback(async (id: string) => {
    if (!enabled) return;
    const next = await persistMarkAsRead(id);
    if (isMountedRef.current) setItems(next);
  }, [enabled]);

  const markAllAsRead = useCallback(async () => {
    if (!enabled) return;
    const next = await persistMarkAllAsRead();
    if (isMountedRef.current) setItems(next);
  }, [enabled]);

  const clearAll = useCallback(async () => {
    if (!enabled) return;
    const next = await clearNotifications();
    if (isMountedRef.current) setItems(next);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "push-received" && data.payload) {
        addFromPayload(data.payload);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, [addFromPayload, enabled]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const value = useMemo(
    () => ({
      items,
      initialized,
      unreadCount,
      addNotification,
      addFromPayload,
      markAsRead,
      markAllAsRead,
      clearAll,
    }),
    [addFromPayload, addNotification, clearAll, initialized, items, markAllAsRead, markAsRead, unreadCount]
  );

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) throw new Error("useNotificationCenter deve ser usado dentro de NotificationCenterProvider.");
  return ctx;
}
