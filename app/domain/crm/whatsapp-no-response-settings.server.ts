import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";

export const WHATSAPP_NO_RESPONSE_CONTEXT = "whatsapp-no-response";
export const WHATSAPP_NO_RESPONSE_LEGACY_CONTEXT = "admin-wpp-alert-panel";
export const WHATSAPP_NO_RESPONSE_ENABLED_SETTING_NAME = "enabled";
export const WHATSAPP_NO_RESPONSE_QUICK_REPLY_SETTING_NAME = "quick-reply-message";

const QUICK_REPLY_DEFAULT =
  "Recebemos sua mensagem e vamos te responder em instantes. Obrigado pela paciencia.";

export async function isWhatsappNoResponseEnabled() {
  const existing = await settingPrismaEntity.findByContextAndName(
    WHATSAPP_NO_RESPONSE_CONTEXT,
    WHATSAPP_NO_RESPONSE_ENABLED_SETTING_NAME
  );

  return (existing?.value ?? "true") === "true";
}

export async function getWhatsappNoResponseQuickReplyMessage() {
  const existing =
    await settingPrismaEntity.findByContextAndName(
      WHATSAPP_NO_RESPONSE_CONTEXT,
      WHATSAPP_NO_RESPONSE_QUICK_REPLY_SETTING_NAME
    ) ||
    await settingPrismaEntity.findByContextAndName(
      WHATSAPP_NO_RESPONSE_LEGACY_CONTEXT,
      WHATSAPP_NO_RESPONSE_QUICK_REPLY_SETTING_NAME
    );

  const value = existing?.value?.trim();
  return value || QUICK_REPLY_DEFAULT;
}
