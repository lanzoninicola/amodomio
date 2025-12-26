function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof atob === "function" ? atob(base64) : "";
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: string };

function clearLocalPushFlags() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("amodomio.pushoptin.optedin");
    window.localStorage.removeItem("amodomio.pushoptin.dismissedAt");
  } catch (err) {
    console.warn("[push] Failed to clear local push flags", err);
  }
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined")
    return { supported: false, reason: "Ambiente sem window." };
  if (!("serviceWorker" in navigator))
    return {
      supported: false,
      reason: "Seu navegador não suporta Service Workers.",
    };
  if (!("PushManager" in window))
    return {
      supported: false,
      reason: "Seu navegador não suporta notificações push.",
    };
  if (!("Notification" in window))
    return { supported: false, reason: "API de notificações indisponível." };
  return { supported: true };
}

export async function getExistingPushSubscription() {
  if (typeof window === "undefined") return null;
  const support = getPushSupport();
  if (!support.supported) return null;

  const registration = await navigator.serviceWorker.getRegistration(
    "/push-sw.js"
  );
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

async function ensureRegistration() {
  const current = await navigator.serviceWorker.getRegistration("/push-sw.js");
  if (current?.active && current.active.state !== "redundant") return current;
  if (current) {
    try {
      await current.unregister();
    } catch (err) {
      console.warn("[push] failed to unregister stale service worker", err);
    }
  }
  return navigator.serviceWorker.register("/push-sw.js");
}

export async function registerPushSubscription(vapidPublicKey: string) {
  if (!vapidPublicKey) throw new Error("Chave pública VAPID ausente.");
  const support = getPushSupport();
  if (!support.supported) throw new Error(support.reason);

  const registration = await ensureRegistration();
  await navigator.serviceWorker.ready;

  const permissionBefore = Notification.permission;
  const permission =
    permissionBefore === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(`Permissão para notificações não concedida (estado: ${permission}).`);
  }

  const subscribe = () =>
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

  const existingSubscription = await registration.pushManager.getSubscription();
  let subscription = existingSubscription || (await subscribe());

  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        `Não foi possível sincronizar a assinatura de push com o servidor (${response.status} ${
          response.statusText || ""
        }) ${responseText ? `- ${responseText}` : ""}`.trim()
      );
    }

    return subscription;
  } catch (err: any) {
    console.error("[push] Failed to register subscription", {
      error: err,
      permission,
      permissionBefore,
      swState: registration.active?.state,
    });
    const isAbort = err?.name === "AbortError";

    try {
      await subscription.unsubscribe();
    } catch (unsubscribeErr) {
      console.error("[push] Failed to cleanup subscription", unsubscribeErr);
    }

    if (isAbort) {
      console.warn("[push] Retrying subscription after AbortError");
      const freshReg = await ensureRegistration();
      const freshSub = await freshReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(freshSub),
      });
      if (!response.ok) throw err;
      return freshSub;
    }

    if (err instanceof Error) throw err;
    throw new Error("Falha desconhecida ao registrar push.");
  }
}

export async function removePushSubscription(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "Ambiente sem window." };
  const support = getPushSupport();
  if (!support.supported) {
    clearLocalPushFlags();
    return { ok: true };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
    if (!registration) {
      clearLocalPushFlags();
      return { ok: true };
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const payload = typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
      try {
        const response = await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          console.error("[push] failed to sync unsubscription with server", {
            status: response.status,
            statusText: response.statusText,
          });
        }
      } catch (err) {
        console.error("[push] failed to notify backend of unsubscription", err);
      }

      try {
        await subscription.unsubscribe();
      } catch (err) {
        console.error("[push] failed to unsubscribe from PushManager", err);
      }
    }

    try {
      await registration.unregister();
    } catch (err) {
      console.warn("[push] failed to unregister service worker", err);
    }

    clearLocalPushFlags();
    return { ok: true };
  } catch (err) {
    console.error("[push] unexpected error removing subscription", err);
    return { ok: false, error: "Não foi possível cancelar a inscrição agora." };
  }
}
