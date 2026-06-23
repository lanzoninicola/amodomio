import { ValidationError } from "~/domain/z-api/errors";
import { getInstagramPublishingCredentials } from "~/domain/instagram/instagram-facebook-login.server";
import {
  DEFAULT_INSTAGRAM_GRAPH_API_VERSION,
  getInstagramSettings,
} from "~/domain/instagram/instagram-settings.server";
import prismaClient from "~/lib/prisma/client.server";

export type InstagramStoryKind = "image" | "video";

export type InstagramStoryExecutionInput = {
  source?: string;
  scheduleName?: string;
  requestBody?: any;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type GraphErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type ContainerStatus = {
  id?: string;
  status_code?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS";
  status?: string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeExecutionText(value: unknown, fallback: string) {
  return normalizeString(value).slice(0, 120) || fallback;
}

async function graphApiVersion() {
  const settings = await getInstagramSettings();
  return String(settings.graphApiVersion || DEFAULT_INSTAGRAM_GRAPH_API_VERSION)
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

async function graphUrl(pathname: string) {
  return `https://graph.facebook.com/${await graphApiVersion()}/${pathname.replace(
    /^\/+/,
    ""
  )}`;
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

export async function readInstagramStoryExecutionInput(
  request: Request
): Promise<InstagramStoryExecutionInput> {
  let requestBody: any = {};
  try {
    requestBody = await request.json();
  } catch {
    requestBody = {};
  }

  return {
    source: normalizeExecutionText(requestBody?.source, "api"),
    scheduleName:
      normalizeString(requestBody?.scheduleName).slice(0, 160) || undefined,
    requestBody,
    userAgent: request.headers.get("user-agent"),
    ipAddress: getRequestIp(request),
  };
}

function assertPublicMediaUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("protocol");
    }
    return url.toString();
  } catch {
    throw new ValidationError(
      "A mídia do Story deve possuir uma URL HTTPS pública."
    );
  }
}

async function readGraphJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & GraphErrorPayload;
  if (!response.ok || payload?.error) {
    const message =
      payload?.error?.message ||
      `A Meta respondeu com HTTP ${response.status}.`;
    const error = new ValidationError(message, response.status || 502);
    Object.assign(error, { body: payload });
    throw error;
  }
  return payload;
}

async function graphPost<T>(pathname: string, values: Record<string, string>) {
  const response = await fetch(await graphUrl(pathname), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  return readGraphJson<T>(response);
}

async function graphGet<T>(pathname: string, values: Record<string, string>) {
  const params = new URLSearchParams(values);
  const response = await fetch(
    `${await graphUrl(pathname)}?${params.toString()}`
  );
  return readGraphJson<T>(response);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createStoryContainer(params: {
  instagramAccountId: string;
  accessToken: string;
  kind: InstagramStoryKind;
  mediaUrl: string;
}) {
  return graphPost<{ id: string }>(`${params.instagramAccountId}/media`, {
    media_type: "STORIES",
    [params.kind === "video" ? "video_url" : "image_url"]: assertPublicMediaUrl(
      params.mediaUrl
    ),
    access_token: params.accessToken,
  });
}

async function waitForContainer(params: {
  containerId: string;
  accessToken: string;
}) {
  const settings = await getInstagramSettings();
  const attempts = Math.max(1, Number(settings.storyStatusMaxAttempts || 12));
  const intervalMs = Math.max(
    250,
    Number(settings.storyStatusIntervalMs || 1000)
  );

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const status = await graphGet<ContainerStatus>(params.containerId, {
      fields: "id,status_code,status",
      access_token: params.accessToken,
    });

    if (status.status_code === "FINISHED") return status;
    if (status.status_code === "ERROR") {
      throw new ValidationError(
        status.status || "A Meta rejeitou o processamento da mídia.",
        422
      );
    }
    if (status.status_code === "EXPIRED") {
      throw new ValidationError(
        "O container do Instagram expirou antes da publicação.",
        409
      );
    }

    if (attempt < attempts) await wait(intervalMs);
  }

  throw new ValidationError(
    "A mídia continua em processamento na Meta. Tente publicar novamente em alguns instantes.",
    409
  );
}

async function publishStoryContainer(params: {
  instagramAccountId: string;
  accessToken: string;
  containerId: string;
}) {
  return graphPost<{ id: string }>(
    `${params.instagramAccountId}/media_publish`,
    {
      creation_id: params.containerId,
      access_token: params.accessToken,
    }
  );
}

async function startExecution(
  publicationId: string,
  input?: InstagramStoryExecutionInput
) {
  return prismaClient.instagramStoryPublicationExecution.create({
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

async function finishExecution(
  execution: { id: string; startedAt: Date },
  data: {
    status: "success" | "error";
    containerId?: string | null;
    instagramMediaId?: string | null;
    response?: any;
    error?: string | null;
  }
) {
  const finishedAt = new Date();
  return prismaClient.instagramStoryPublicationExecution.update({
    where: { id: execution.id },
    data: {
      status: data.status,
      containerId: data.containerId || null,
      instagramMediaId: data.instagramMediaId || null,
      finishedAt,
      durationMs: Math.max(
        0,
        finishedAt.getTime() - execution.startedAt.getTime()
      ),
      response: data.response ?? undefined,
      error: data.error || null,
    },
  });
}

export async function publishInstagramStory(
  publicationId: string,
  executionInput?: InstagramStoryExecutionInput
) {
  const publication = await prismaClient.instagramStoryPublication.findUnique({
    where: { id: publicationId },
  });
  if (!publication) {
    throw new ValidationError("Publicação do Instagram não encontrada.", 404);
  }

  const execution = await startExecution(publication.id, executionInput);
  let containerId: string | null = null;

  try {
    if (!publication.active) {
      throw new ValidationError("Publicação do Instagram desativada.", 409);
    }
    if (publication.deletedAt) {
      throw new ValidationError("Publicação do Instagram eliminada.", 409);
    }
    if (publication.kind !== "image" && publication.kind !== "video") {
      throw new ValidationError("Tipo de mídia do Instagram inválido.");
    }

    const credentials = await getInstagramPublishingCredentials();
    const container = await createStoryContainer({
      ...credentials,
      kind: publication.kind,
      mediaUrl: publication.mediaUrl,
    });
    containerId = container.id;

    await prismaClient.instagramStoryPublication.update({
      where: { id: publication.id },
      data: {
        lastContainerId: containerId,
        lastPublishStatus: "processing",
        lastPublishError: null,
      },
    });

    const processing = await waitForContainer({
      containerId,
      accessToken: credentials.accessToken,
    });
    const published = await publishStoryContainer({
      ...credentials,
      containerId,
    });
    const response = { container, processing, published };
    const publishedAt = new Date();

    const updatedPublication =
      await prismaClient.instagramStoryPublication.update({
        where: { id: publication.id },
        data: {
          lastContainerId: containerId,
          lastInstagramMediaId: published.id,
          lastPublishedAt: publishedAt,
          lastPublishStatus: "success",
          lastPublishResponse: response,
          lastPublishError: null,
        },
      });
    const finishedExecution = await finishExecution(execution, {
      status: "success",
      containerId,
      instagramMediaId: published.id,
      response,
    });

    return {
      publication: updatedPublication,
      execution: finishedExecution,
      response,
    };
  } catch (error: any) {
    const message = error?.message || "Erro ao publicar Story no Instagram.";
    const response = error?.body;
    const finishedExecution = await finishExecution(execution, {
      status: "error",
      containerId,
      response,
      error: message,
    });

    await prismaClient.instagramStoryPublication.update({
      where: { id: publication.id },
      data: {
        lastContainerId: containerId,
        lastPublishedAt: new Date(),
        lastPublishStatus: "error",
        lastPublishResponse: response ?? undefined,
        lastPublishError: message,
      },
    });

    Object.assign(error, { execution: finishedExecution });
    throw error;
  }
}
