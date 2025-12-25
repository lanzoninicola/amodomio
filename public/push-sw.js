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

  const notifyPromise = self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url, campaignId, subscriptionId, shownAt },
  });

  const logShow = () => {
    if (!campaignId) return;
    const eventPayload = JSON.stringify({
      campaignId,
      subscriptionId,
      type: "show",
    });
    navigator.sendBeacon("/api/push/event", eventPayload);
  };

  event.waitUntil(Promise.all([notifyPromise.then(logShow)]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/";
  const dwellMs = data.shownAt ? Date.now() - data.shownAt : undefined;

  if (data.campaignId) {
    const eventPayload = JSON.stringify({
      campaignId: data.campaignId,
      subscriptionId: data.subscriptionId,
      type: "click",
      dwellMs,
    });
    navigator.sendBeacon("/api/push/event", eventPayload);
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
});

self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};
  if (!data.campaignId) return;
  const dwellMs = data.shownAt ? Date.now() - data.shownAt : undefined;
  const eventPayload = JSON.stringify({
    campaignId: data.campaignId,
    subscriptionId: data.subscriptionId,
    type: "close",
    dwellMs,
  });
  navigator.sendBeacon("/api/push/event", eventPayload);
});
