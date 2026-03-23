import prismaClient from "~/lib/prisma/client.server";
import { normalizePhone } from "~/domain/z-api/zapi.service";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";
import { logCrmWhatsappSentEventByPhone } from "~/domain/crm/crm-whatsapp-events.server";

export const ASYNC_JOBS_SETTINGS_CONTEXT = "async-jobs";
export const ASYNC_JOBS_WHATSAPP_PHONE_SETTING = "whatsappNotificationPhone";

function formatDateTime(value: Date) {
  return value.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

async function getNotificationPhone() {
  const setting = await prismaClient.setting.findFirst({
    where: {
      context: ASYNC_JOBS_SETTINGS_CONTEXT,
      name: ASYNC_JOBS_WHATSAPP_PHONE_SETTING,
    },
    orderBy: [{ createdAt: "desc" }],
    select: { value: true },
  });

  return normalizePhone(setting?.value || "");
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
    const phone = await getNotificationPhone();
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
