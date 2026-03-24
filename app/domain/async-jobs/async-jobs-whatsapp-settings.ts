export const ASYNC_JOBS_SETTINGS_CONTEXT = "async-jobs";
export const ASYNC_JOBS_WHATSAPP_ENABLED_SETTING = "whatsappNotificationEnabled";
export const ASYNC_JOBS_WHATSAPP_PHONE_SETTING = "whatsappNotificationPhone";
export const ASYNC_JOBS_WHATSAPP_ON_STARTED_SETTING = "whatsappNotifyOnStarted";
export const ASYNC_JOBS_WHATSAPP_ON_COMPLETED_SETTING = "whatsappNotifyOnCompleted";
export const ASYNC_JOBS_WHATSAPP_ON_FAILED_SETTING = "whatsappNotifyOnFailed";

export type AsyncJobsWhatsappSettings = {
  enabled: boolean;
  phone: string;
  notifyOnStarted: boolean;
  notifyOnCompleted: boolean;
  notifyOnFailed: boolean;
};

export const DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS: AsyncJobsWhatsappSettings = {
  enabled: false,
  phone: "",
  notifyOnStarted: true,
  notifyOnCompleted: true,
  notifyOnFailed: true,
};
