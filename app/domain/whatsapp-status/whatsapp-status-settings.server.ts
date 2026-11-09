import prismaClient from "~/lib/prisma/client.server";

export const WHATSAPP_STATUS_SETTINGS_CONTEXT = "whatsapp-status";
export const WHATSAPP_STATUS_SCHEDULER_NOTIFICATION_PHONE_SETTING =
  "scheduler.notification.phone";

export async function getWhatsappStatusSchedulerNotificationSettings() {
  const setting = await prismaClient.setting.findFirst({
    where: {
      context: WHATSAPP_STATUS_SETTINGS_CONTEXT,
      name: WHATSAPP_STATUS_SCHEDULER_NOTIFICATION_PHONE_SETTING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!setting) {
    await prismaClient.setting.create({
      data: {
        context: WHATSAPP_STATUS_SETTINGS_CONTEXT,
        name: WHATSAPP_STATUS_SCHEDULER_NOTIFICATION_PHONE_SETTING,
        type: "string",
        value: "",
        createdAt: new Date(),
      },
    });
  }

  return {
    context: WHATSAPP_STATUS_SETTINGS_CONTEXT,
    name: WHATSAPP_STATUS_SCHEDULER_NOTIFICATION_PHONE_SETTING,
    phone: String(setting?.value || "").trim(),
  };
}
