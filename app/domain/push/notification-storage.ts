export type NotificationEntry = {
  id: string;
  title: string;
  body?: string;
  url?: string;
  ts: number;
  read: boolean;
  source?: "push" | "local";
};

const DB_NAME = "amodomio-notifications";
const STORE_NAME = "notifications";
const DB_VERSION = 1;
const LOCAL_STORAGE_KEY = "amodomio.notifications";
const MAX_ITEMS = 50;

const hasIndexedDB = typeof indexedDB !== "undefined";
const hasWindow = typeof window !== "undefined";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAllFromIndexedDB(): Promise<NotificationEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result || []) as NotificationEntry[]);
    request.onerror = () => reject(request.error);
  }).catch(() => []);
}

async function writeAllToIndexedDB(entries: NotificationEntry[]) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).catch(() => undefined);
}

function readAllFromLocalStorage(): NotificationEntry[] {
  if (!hasWindow) return [];
  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error("[push] Failed to read notifications from localStorage", err);
    return [];
  }
}

function writeAllToLocalStorage(entries: NotificationEntry[]) {
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error("[push] Failed to persist notifications in localStorage", err);
  }
}

function sortAndClamp(entries: NotificationEntry[]) {
  return entries
    .slice()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_ITEMS);
}

async function readAll(): Promise<NotificationEntry[]> {
  if (hasIndexedDB) {
    const entries = await readAllFromIndexedDB();
    return sortAndClamp(entries);
  }
  return sortAndClamp(readAllFromLocalStorage());
}

async function writeAll(entries: NotificationEntry[]) {
  const sorted = sortAndClamp(entries);
  if (hasIndexedDB) {
    await writeAllToIndexedDB(sorted);
  }
  writeAllToLocalStorage(sorted);
  return sorted;
}

export async function upsertNotification(entry: NotificationEntry) {
  const current = await readAll();
  const filtered = current.filter((item) => item.id !== entry.id);
  const next = await writeAll([entry, ...filtered]);
  return next;
}

export async function markAsRead(id: string) {
  const current = await readAll();
  const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
  return writeAll(next);
}

export async function markAllAsRead() {
  const current = await readAll();
  const next = current.map((item) => ({ ...item, read: true }));
  return writeAll(next);
}

export async function clearNotifications() {
  if (hasIndexedDB) {
    await writeAllToIndexedDB([]);
  }
  writeAllToLocalStorage([]);
  return [];
}

export async function loadNotifications() {
  return readAll();
}
