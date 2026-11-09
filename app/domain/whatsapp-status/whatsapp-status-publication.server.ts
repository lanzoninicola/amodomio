import { ValidationError } from "~/domain/z-api/errors";
import {
  sendImageStatus,
  sendTextMessage,
  sendTextStatus,
  sendVideoStatus,
} from "~/domain/z-api/zapi.service.server";
import { getWhatsappStatusSchedulerNotificationSettings } from "~/domain/whatsapp-status/whatsapp-status-settings.server";
import {
  normalizeKindFilter,
  normalizeStatusFilter,
  normalizeStatusKind,
  type StatusPublicationKind,
} from "~/domain/whatsapp-status/whatsapp-status-publication.shared";
import prismaClient from "~/lib/prisma/client.server";

export type StatusPublicationInput = {
  title: string;
  kind: StatusPublicationKind;
  message?: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  active?: boolean;
};

export type StatusPublicationExecutionInput = {
  source?: string;
  scheduleName?: string;
  requestBody?: any;
  userAgent?: string | null;
  ipAddress?: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeExecutionText(value: unknown, fallback: string) {
  const normalized = normalizeString(value).slice(0, 120);
  return normalized || fallback;
}

function isSchedulerExecutionSource(source: unknown) {
  const normalized = normalizeString(source).toLowerCase();
  return normalized === "dokploy" || normalized === "scheduler";
}

function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function readStatusPublicationExecutionInput(
  request: Request
): Promise<StatusPublicationExecutionInput> {
  let requestBody: any = {};

  try {
    requestBody = await request.json();
  } catch {
    requestBody = {};
  }

  const source = normalizeExecutionText(requestBody?.source, "api");
  const scheduleName = normalizeString(requestBody?.scheduleName).slice(0, 160);

  return {
    source,
    scheduleName: scheduleName || undefined,
    requestBody,
    userAgent: request.headers.get("user-agent"),
    ipAddress: getRequestIp(request),
  };
}

function assertHttpUrl(value: string, field: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    throw new ValidationError(`${field} deve ser uma URL http/https valida.`);
  }
}

export function normalizeStatusPublicationInput(
  input: Partial<StatusPublicationInput>
): StatusPublicationInput {
  const title = normalizeString(input.title);
  const kind = normalizeStatusKind(input.kind);
  const message = normalizeString(input.message);
  const imageUrl = normalizeString(input.imageUrl);
  const videoUrl = normalizeString(input.videoUrl);
  const caption = normalizeString(input.caption);
  const active = Boolean(input.active);

  if (!title) {
    throw new ValidationError("Informe o nome do post.");
  }

  if (kind === "text" && !message) {
    throw new ValidationError("Informe o texto do status.");
  }

  if (kind === "video" && !videoUrl) {
    throw new ValidationError("Informe a URL do vídeo.");
  }

  if (kind === "image" && !imageUrl) {
    throw new ValidationError("Informe a URL da imagem.");
  }

  return {
    title,
    kind,
    message,
    imageUrl: imageUrl ? assertHttpUrl(imageUrl, "Imagem") : "",
    videoUrl: videoUrl ? assertHttpUrl(videoUrl, "Vídeo") : "",
    caption,
    active,
  };
}

export async function listStatusPublications(params?: {
  q?: string;
  status?: string;
  kind?: string;
}) {
  const q = normalizeString(params?.q);
  const status = normalizeStatusFilter(params?.status);
  const kind = normalizeKindFilter(params?.kind);
  const where: any = {};

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
      { imageUrl: { contains: q, mode: "insensitive" } },
      { videoUrl: { contains: q, mode: "insensitive" } },
      { caption: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    where.active = true;
    where.deletedAt = null;
  }
  if (status === "inactive") {
    where.active = false;
    where.deletedAt = null;
  }
  if (status === "deleted") {
    where.deletedAt = { not: null };
  }
  if (kind === "text" || kind === "image" || kind === "video") {
    where.kind = kind;
  }

  return prismaClient.whatsappStatusPublication.findMany({
    where,
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    include: {
      Executions: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function getStatusPublication(id: string) {
  const publication = await prismaClient.whatsappStatusPublication.findUnique({
    where: { id },
    include: {
      Executions: {
        orderBy: { startedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!publication) {
    throw new ValidationError("Post não encontrado.", 404);
  }

  return publication;
}

export async function createStatusPublication(
  input: Partial<StatusPublicationInput>
) {
  const data = normalizeStatusPublicationInput(input);

  return prismaClient.whatsappStatusPublication.create({
    data: {
      title: data.title,
      kind: data.kind,
      message: data.kind === "text" ? data.message : null,
      imageUrl: data.kind === "image" ? data.imageUrl : null,
      videoUrl: data.kind === "video" ? data.videoUrl : null,
      caption:
        data.kind === "image" || data.kind === "video" ? data.caption : null,
      active: data.active,
      deactivatedAt: data.active ? null : new Date(),
      deletedAt: null,
    },
  });
}

export async function updateStatusPublication(
  id: string,
  input: Partial<StatusPublicationInput>
) {
  const existing = await getStatusPublication(id);
  const data = normalizeStatusPublicationInput(input);
  if (existing.deletedAt && data.active) {
    throw new ValidationError("Post eliminado não pode ser ativado.", 409);
  }

  return prismaClient.whatsappStatusPublication.update({
    where: { id },
    data: {
      title: data.title,
      kind: data.kind,
      message: data.kind === "text" ? data.message : null,
      imageUrl: data.kind === "image" ? data.imageUrl : null,
      videoUrl: data.kind === "video" ? data.videoUrl : null,
      caption:
        data.kind === "image" || data.kind === "video" ? data.caption : null,
      active: data.active,
      deactivatedAt: data.active ? null : new Date(),
    },
  });
}

export async function setStatusPublicationActive(id: string, active: boolean) {
  const publication = await getStatusPublication(id);
  if (publication.deletedAt && active) {
    throw new ValidationError("Post eliminado não pode ser ativado.", 409);
  }

  return prismaClient.whatsappStatusPublication.update({
    where: { id },
    data: {
      active,
      deactivatedAt: active ? null : new Date(),
    },
  });
}

export async function softDeleteStatusPublication(id: string) {
  await getStatusPublication(id);

  return prismaClient.whatsappStatusPublication.update({
    where: { id },
    data: {
      active: false,
      deactivatedAt: new Date(),
      deletedAt: new Date(),
    },
  });
}

export async function getActiveStatusPublication() {
  return prismaClient.whatsappStatusPublication.findFirst({
    where: { active: true, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
  });
}

async function startPublicationExecution(
  publicationId: string,
  input?: StatusPublicationExecutionInput
) {
  return prismaClient.whatsappStatusPublicationExecution.create({
    data: {
      publicationId,
      source: normalizeExecutionText(input?.source, "manual"),
      scheduleName: normalizeString(input?.scheduleName) || null,
      status: "running",
      requestBody: input?.requestBody ?? undefined,
      userAgent: normalizeString(input?.userAgent) || null,
      ipAddress: normalizeString(input?.ipAddress) || null,
    },
  });
}

async function finishPublicationExecution(
  execution: { id: string; startedAt: Date },
  data:
    | { status: "success"; response: any }
    | { status: "error"; error: string; response?: any }
) {
  const finishedAt = new Date();
  const durationMs = Math.max(
    0,
    finishedAt.getTime() - execution.startedAt.getTime()
  );

  return prismaClient.whatsappStatusPublicationExecution.update({
    where: { id: execution.id },
    data: {
      status: data.status,
      finishedAt,
      durationMs,
      response: "response" in data ? data.response : undefined,
      error: "error" in data ? data.error : null,
    },
  });
}

function formatExecutionDate(value: Date) {
  return value.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function updateExecutionNotification(
  executionId: string,
  data: {
    phone?: string | null;
    status: "success" | "error" | "skipped";
    error?: string | null;
    sentAt?: Date | null;
  }
) {
  return prismaClient.whatsappStatusPublicationExecution.update({
    where: { id: executionId },
    data: {
      notificationPhone: data.phone || null,
      notificationStatus: data.status,
      notificationError: data.error || null,
      notificationSentAt: data.sentAt || null,
    },
  });
}

async function notifySchedulerPublicationExecution(params: {
  publication: {
    id: string;
    title: string;
    kind: string;
  };
  execution: {
    id: string;
    source: string;
    scheduleName?: string | null;
    status: string;
    startedAt: Date;
    finishedAt?: Date | null;
    durationMs?: number | null;
  };
  error?: string | null;
}) {
  if (!isSchedulerExecutionSource(params.execution.source)) {
    return params.execution;
  }

  try {
    const settings = await getWhatsappStatusSchedulerNotificationSettings();
    const phone = normalizeString(settings.phone);

    if (!phone) {
      return updateExecutionNotification(params.execution.id, {
        phone: null,
        status: "skipped",
        error:
          "Telefone não configurado em settings: whatsapp-status / scheduler.notification.phone.",
      });
    }

    const success = params.execution.status === "success";
    const lines = [
      success
        ? "✅ *Whatsapp Status publicado*"
        : "⚠️ *Whatsapp Status com erro*",
      "",
      `*Post:* ${params.publication.title}`,
      `*Tipo:* ${params.publication.kind}`,
      `*Origem:* ${params.execution.source}`,
      params.execution.scheduleName
        ? `*Schedule:* ${params.execution.scheduleName}`
        : null,
      `*Início:* ${formatExecutionDate(params.execution.startedAt)}`,
      params.execution.finishedAt
        ? `*Fim:* ${formatExecutionDate(params.execution.finishedAt)}`
        : null,
      params.execution.durationMs != null
        ? `*Duração:* ${params.execution.durationMs} ms`
        : null,
      params.error ? `*Erro:* ${params.error}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await sendTextMessage({ phone, message: lines }, { timeoutMs: 8_000 });

    return updateExecutionNotification(params.execution.id, {
      phone,
      status: "success",
      sentAt: new Date(),
    });
  } catch (error: any) {
    return updateExecutionNotification(params.execution.id, {
      status: "error",
      error: error?.message || "Erro ao enviar notificação WhatsApp.",
    });
  }
}

export async function publishStatusPublication(
  id: string,
  executionInput?: StatusPublicationExecutionInput
) {
  const publication = await getStatusPublication(id);
  const execution = await startPublicationExecution(
    publication.id,
    executionInput
  );

  try {
    if (!publication.active) {
      throw new ValidationError("Post desativado.", 409);
    }

    if (publication.deletedAt) {
      throw new ValidationError("Post eliminado.", 409);
    }

    const response =
      publication.kind === "video"
        ? await sendVideoStatus({
            video: publication.videoUrl || "",
            caption: publication.caption || undefined,
          })
        : publication.kind === "image"
        ? await sendImageStatus({
            image: publication.imageUrl || "",
            caption: publication.caption || undefined,
          })
        : await sendTextStatus({ message: publication.message || "" });

    const updatedPublication =
      await prismaClient.whatsappStatusPublication.update({
        where: { id: publication.id },
        data: {
          lastPublishedAt: new Date(),
          lastPublishStatus: "success",
          lastPublishResponse: response,
          lastPublishError: null,
        },
        include: {
          Executions: {
            orderBy: { startedAt: "desc" },
            take: 20,
          },
        },
      });

    const finishedExecution = await finishPublicationExecution(execution, {
      status: "success",
      response,
    });
    const notifiedExecution = await notifySchedulerPublicationExecution({
      publication: updatedPublication,
      execution: finishedExecution,
    });

    return {
      publication: updatedPublication,
      response,
      execution: notifiedExecution,
    };
  } catch (error: any) {
    const errorMessage = error?.message || "Erro ao publicar status.";
    const finishedExecution = await finishPublicationExecution(execution, {
      status: "error",
      error: errorMessage,
      response: error?.body ?? undefined,
    });

    if (publication.active && !publication.deletedAt) {
      await prismaClient.whatsappStatusPublication.update({
        where: { id: publication.id },
        data: {
          lastPublishedAt: new Date(),
          lastPublishStatus: "error",
          lastPublishError: errorMessage,
        },
      });
    }
    await notifySchedulerPublicationExecution({
      publication,
      execution: finishedExecution,
      error: errorMessage,
    });
    throw error;
  }
}

export async function publishConfiguredStatus(
  executionInput?: StatusPublicationExecutionInput
) {
  const publication = await getActiveStatusPublication();

  if (!publication) {
    throw new ValidationError("Nenhum post ativo para Status.", 409);
  }

  return publishStatusPublication(publication.id, executionInput);
}
