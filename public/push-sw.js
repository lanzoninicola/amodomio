const DB_NAME = "amodomio-notifications";
const STORE_NAME = "notifications";
const DB_VERSION = 1;
const MAX_ITEMS = 50;

// Take control immediately to avoid "redundant" state after deploy
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDB() {
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

async function persistNotification(record) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record);

      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const all = (getAllRequest.result || []).sort((a, b) => b.ts - a.ts);
        if (all.length > MAX_ITEMS) {
          const limited = all.slice(0, MAX_ITEMS);
          const cleanTx = db.transaction(STORE_NAME, "readwrite");
          const cleanStore = cleanTx.objectStore(STORE_NAME);
          cleanStore.clear();
          limited.forEach((item) => cleanStore.put(item));
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[push-sw] Failed to persist notification", err);
  }
}

async function markStoredNotificationAsRead(id) {
  if (!id) return;
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const entry = request.result;
        if (entry) {
          entry.read = true;
          store.put(entry);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("[push-sw] Failed to mark notification as read", err);
  }
}

async function broadcastToClients(message) {
  const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clientList.forEach((client) => client.postMessage(message));
}

function reportEvent(payload) {
  return fetch("/api/push/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

// Basic service worker for Web Push notifications (public scope only)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    console.error("[push-sw] Failed to parse push payload", err);
  }

  const { title = "Notificação", body, url, campaignId, subscriptionId } = payload;
  const shownAt = Date.now();
  const notificationId = payload?.id || `${campaignId || "local"}-${shownAt}`;

  const record = {
    id: notificationId,
    title,
    body,
    url,
    ts: shownAt,
    read: false,
    source: "push",
  };

  const notifyPromise = self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url, campaignId, subscriptionId, shownAt, id: notificationId },
  });

  const logShow = () => {
    if (!campaignId) return;
    return reportEvent({
      campaignId,
      subscriptionId,
      type: "show",
    });
  };

  event.waitUntil(
    Promise.all([
      notifyPromise.then(logShow),
      persistNotification(record),
      broadcastToClients({ type: "push-received", payload: record }).catch(() => undefined),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/";
  const dwellMs = data.shownAt ? Date.now() - data.shownAt : undefined;

  if (data.campaignId) {
    const payload = {
      campaignId: data.campaignId,
      subscriptionId: data.subscriptionId,
      type: "click",
      dwellMs,
    };
    event.waitUntil(reportEvent(payload));
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("navigate" in client) {
          return client.navigate(targetUrl);
        }
      }
      return clients.openWindow(targetUrl);
    })
  );

  event.waitUntil(markStoredNotificationAsRead(data.id));
});

self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};
  if (!data.campaignId) return;
  const dwellMs = data.shownAt ? Date.now() - data.shownAt : undefined;
  const payload = {
    campaignId: data.campaignId,
    subscriptionId: data.subscriptionId,
    type: "close",
    dwellMs,
  };
  event.waitUntil(reportEvent(payload));
});
