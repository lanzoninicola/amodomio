import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { normalizePhone } from "~/domain/z-api/zapi.service";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";
import { logCrmWhatsappSentEventByPhone } from "~/domain/crm/crm-whatsapp-events.server";
import {
  ASYNC_JOBS_SETTINGS_CONTEXT,
  ASYNC_JOBS_WHATSAPP_ENABLED_SETTING,
  ASYNC_JOBS_WHATSAPP_ON_COMPLETED_SETTING,
  ASYNC_JOBS_WHATSAPP_ON_FAILED_SETTING,
  ASYNC_JOBS_WHATSAPP_ON_STARTED_SETTING,
  ASYNC_JOBS_WHATSAPP_PHONE_SETTING,
  DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS,
  type AsyncJobsWhatsappSettings,
} from "~/domain/async-jobs/async-jobs-whatsapp-settings";

function formatDateTime(value: Date) {
  return value.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export async function getAsyncJobsWhatsappSettings(): Promise<AsyncJobsWhatsappSettings> {
  const settings = await settingPrismaEntity.findAllByContext(ASYNC_JOBS_SETTINGS_CONTEXT);
  const byName = new Map(settings.map((setting) => [setting.name, setting.value]));

  return {
    enabled:
      (byName.get(ASYNC_JOBS_WHATSAPP_ENABLED_SETTING) ?? String(DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS.enabled)) ===
      "true",
    phone: byName.get(ASYNC_JOBS_WHATSAPP_PHONE_SETTING) || DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS.phone,
    notifyOnStarted:
      (byName.get(ASYNC_JOBS_WHATSAPP_ON_STARTED_SETTING) ??
        String(DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS.notifyOnStarted)) === "true",
    notifyOnCompleted:
      (byName.get(ASYNC_JOBS_WHATSAPP_ON_COMPLETED_SETTING) ??
        String(DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS.notifyOnCompleted)) === "true",
    notifyOnFailed:
      (byName.get(ASYNC_JOBS_WHATSAPP_ON_FAILED_SETTING) ??
        String(DEFAULT_ASYNC_JOBS_WHATSAPP_SETTINGS.notifyOnFailed)) === "true",
  };
}

function shouldSendWhatsappNotification(
  settings: AsyncJobsWhatsappSettings,
  event: "started" | "completed" | "failed",
) {
  if (!settings.enabled) return false;
  if (event === "started") return settings.notifyOnStarted;
  if (event === "completed") return settings.notifyOnCompleted;
  return settings.notifyOnFailed;
}

function buildMessage(params: {
  event: "started" | "completed" | "failed";
  job: any;
  error?: unknown;
}) {
  const now = formatDateTime(new Date());
  const title =
    params.event === "started"
      ? "JOB INICIADO"
      : params.event === "completed"
        ? "JOB CONCLUIDO"
        : "JOB COM ERRO";

  const lines = [
    `*${title}*`,
    `Horario: ${now}`,
    `Tipo: ${String(params.job?.type || "-")}`,
    `ID: ${String(params.job?.id || "-")}`,
  ];

  if (params.job?.dedupeKey) {
    lines.push(`Chave: ${String(params.job.dedupeKey)}`);
  }

  if (params.job?.attempts != null) {
    lines.push(`Tentativa: ${String(params.job.attempts)}`);
  }

  if (params.event === "failed") {
    const message =
      params.error instanceof Error
        ? params.error.message
        : String(params.error || params.job?.errorMessage || "Erro desconhecido");
    lines.push(`Erro: ${message}`);
  }

  if (params.event === "completed" && params.job?.result) {
    lines.push(`Resultado: ${JSON.stringify(params.job.result)}`);
  }

  return lines.join("\n");
}

export async function notifyAsyncJobWhatsappEvent(params: {
  event: "started" | "completed" | "failed";
  job: any;
  error?: unknown;
}) {
  try {
    const settings = await getAsyncJobsWhatsappSettings();
    if (!shouldSendWhatsappNotification(settings, params.event)) return;

    const phone = normalizePhone(settings.phone);
    if (!phone) return;

    const message = buildMessage(params);
    const response = await sendTextMessage(
      { phone, message },
      { timeoutMs: 10_000 },
    );

    await logCrmWhatsappSentEventByPhone({
      phone,
      source: "async-jobs",
      messageText: message,
      payload: {
        channel: "async-jobs",
        event: params.event,
        jobId: params.job?.id || null,
        jobType: params.job?.type || null,
        wppResponse: response,
      },
    });
  } catch (error) {
    console.error("[async-jobs] whatsapp notification failed", error);
  }
}
