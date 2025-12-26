import webpush from "web-push";
import prismaClient from "~/lib/prisma/client.server";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const pushSubject = process.env.PUSH_SUBJECT || "mailto:admin@example.com";

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn(
    "[push] Missing VAPID keys (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY). Push notifications will be disabled."
  );
} else {
  webpush.setVapidDetails(pushSubject, vapidPublicKey, vapidPrivateKey);
}

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  campaignId?: string;
  subscriptionId?: string;
};

type SendResult = {
  sent: number;
  failed: number;
  removed: number;
};

export async function saveSubscription(params: {
  endpoint: string;
  expirationTime?: string | number | null;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}) {
  const { endpoint, expirationTime, keys, userAgent } = params;

  return prismaClient.pushSubscription.upsert({
    where: { endpoint },
    update: {
      expirationTime: expirationTime ? new Date(expirationTime) : null,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
    create: {
      endpoint,
      expirationTime: expirationTime ? new Date(expirationTime) : null,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
  });
}

export async function removeSubscription(endpoint: string) {
  if (!endpoint) return { deleted: 0 };
  const result = await prismaClient.pushSubscription.deleteMany({ where: { endpoint } });
  return { deleted: result.count };
}

export async function createCampaign(data: {
  title: string;
  body: string;
  url?: string;
  scheduledAt?: Date | null;
  status?: "draft" | "scheduled" | "sent";
}) {
  return prismaClient.pushNotificationCampaign.create({
    data: {
      title: data.title,
      body: data.body,
      url: data.url,
      scheduledAt: data.scheduledAt ?? null,
      status: data.status ?? "draft",
    },
  });
}

export async function sendCampaignNow(campaignId: string): Promise<SendResult> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("Missing VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  }

  const campaign = await prismaClient.pushNotificationCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const subscriptions = await prismaClient.pushSubscription.findMany();

  let sent = 0;
  let failed = 0;
  const toRemove: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime ?? undefined,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: campaign.title,
            body: campaign.body,
            url: campaign.url,
            campaignId: campaign.id,
            subscriptionId: sub.id,
            sentAt: Date.now(),
          })
        );
        sent += 1;
      } catch (error: any) {
        failed += 1;
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          toRemove.push(sub.id);
        } else {
          console.error("[push] Failed to send notification", { endpoint: sub.endpoint, error });
        }
      }
    })
  );

  if (toRemove.length > 0) {
    await prismaClient.pushSubscription.deleteMany({ where: { id: { in: toRemove } } });
  }

  await prismaClient.pushNotificationCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "sent",
      sentAt: new Date(),
      sendCount: { increment: sent },
    },
  });

  return { sent, failed, removed: toRemove.length };
}

export async function logPushEvent(params: {
  campaignId?: string | null;
  subscriptionId?: string | null;
  endpoint?: string | null;
  type: "show" | "click" | "close";
  dwellMs?: number | null;
}) {
  const { campaignId, subscriptionId, endpoint, type, dwellMs } = params;
  if (!campaignId) return;

  let subId = subscriptionId ?? null;

  if (!subId && endpoint) {
    const sub = await prismaClient.pushSubscription.findUnique({ where: { endpoint } });
    subId = sub?.id ?? null;
  }

  if (!subId) return;

  await prismaClient.pushNotificationEvent.create({
    data: {
      campaignId,
      subscriptionId: subId,
      type,
      dwellMs: dwellMs ?? null,
    },
  });

  const increment: Record<string, any> = {};
  if (type === "show") increment.showCount = { increment: 1 };
  if (type === "click") increment.clickCount = { increment: 1 };
  if (type === "close") increment.closeCount = { increment: 1 };
  if (typeof dwellMs === "number" && dwellMs >= 0) {
    increment.totalDwellMs = { increment: Math.round(dwellMs) };
  }

  if (Object.keys(increment).length > 0) {
    await prismaClient.pushNotificationCampaign.update({
      where: { id: campaignId },
      data: increment,
    });
  }
}
