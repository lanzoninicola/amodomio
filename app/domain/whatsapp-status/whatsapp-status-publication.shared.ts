export const WHATSAPP_STATUS_TTL_HOURS = 24;
export const STATUS_FILTERS = ["all", "active", "inactive", "deleted"] as const;
export const KIND_FILTERS = ["all", "text", "image", "video"] as const;

export type StatusPublicationKind = "text" | "image" | "video";
export type StatusPublicationFilter = (typeof STATUS_FILTERS)[number];
export type StatusPublicationKindFilter = (typeof KIND_FILTERS)[number];
export type StatusPublicationLifecycle =
  | "published"
  | "expired"
  | "ready"
  | "inactive"
  | "deleted"
  | "error";

export const STATUS_PUBLICATION_LIFECYCLE_DETAILS: Record<
  StatusPublicationLifecycle,
  { label: string; description: string }
> = {
  published: {
    label: "Publicado",
    description:
      "O post foi enviado com sucesso e ainda está dentro da janela de 24 horas do Status do WhatsApp.",
  },
  expired: {
    label: "Expirado",
    description:
      "O post foi enviado com sucesso, mas a janela de 24 horas do Status do WhatsApp já terminou.",
  },
  ready: {
    label: "Habilitado",
    description:
      "O post está ativo e pode ser disparado pelo scheduler externo, mas ainda não tem envio recente válido.",
  },
  inactive: {
    label: "Desativado",
    description:
      "O post está salvo, mas não pode ser disparado enquanto permanecer desativado.",
  },
  deleted: {
    label: "Eliminado",
    description:
      "O post sofreu soft delete. Ele permanece no histórico e na lista filtrada, mas não pode ser publicado nem reativado.",
  },
  error: {
    label: "Erro",
    description:
      "O último envio falhou. Revise o conteúdo, a URL de mídia e a resposta registrada pela Z-API.",
  },
};

export function normalizeStatusKind(value: unknown): StatusPublicationKind {
  if (value === "image") return "image";
  if (value === "video") return "video";
  return "text";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeStatusFilter(value: unknown): StatusPublicationFilter {
  const normalized = normalizeString(value).toLowerCase();
  return STATUS_FILTERS.includes(normalized as StatusPublicationFilter)
    ? (normalized as StatusPublicationFilter)
    : "all";
}

export function normalizeKindFilter(
  value: unknown
): StatusPublicationKindFilter {
  const normalized = normalizeString(value).toLowerCase();
  return KIND_FILTERS.includes(normalized as StatusPublicationKindFilter)
    ? (normalized as StatusPublicationKindFilter)
    : "all";
}

function addHours(value: string | Date, hours: number) {
  const date = new Date(value);
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function getWhatsappStatusExpiresAt(publication: {
  lastPublishedAt?: string | Date | null;
  lastPublishStatus?: string | null;
}) {
  if (
    !publication.lastPublishedAt ||
    publication.lastPublishStatus !== "success"
  ) {
    return null;
  }

  return addHours(publication.lastPublishedAt, WHATSAPP_STATUS_TTL_HOURS);
}

export function getPublicationLifecycleStatus(publication: {
  active?: boolean | null;
  deletedAt?: string | Date | null;
  lastPublishedAt?: string | Date | null;
  lastPublishStatus?: string | null;
}): StatusPublicationLifecycle {
  if (publication.deletedAt) return "deleted";
  if (publication.lastPublishStatus === "error") return "error";
  if (!publication.active) return "inactive";

  const expiresAt = getWhatsappStatusExpiresAt(publication);
  if (!expiresAt) return "ready";
  return expiresAt.getTime() <= Date.now() ? "expired" : "published";
}

export function getPublicationStatusWindow(publication: {
  lastPublishedAt?: string | Date | null;
  lastPublishStatus?: string | null;
}) {
  const expiresAt = getWhatsappStatusExpiresAt(publication);
  if (!expiresAt) {
    return { expiresAt: null, expired: true };
  }

  return {
    expiresAt,
    expired: expiresAt.getTime() <= Date.now(),
  };
}

export function buildStatusPublishEndpoint(origin: string, id: string) {
  return new URL(`/api/whatsapp-status/${id}/publish`, origin).toString();
}

export function buildDokployPublishScript(publishEndpoint: string) {
  return `set -euo pipefail

curl -fsS -X POST "${publishEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: \${VITE_REST_API_SECRET_KEY}" \\
  -d '{"source":"dokploy"}'`;
}

export function decorateStatusPublication<T extends { id: string }>(
  publication: T,
  origin: string
) {
  return {
    ...publication,
    publishEndpoint: buildStatusPublishEndpoint(origin, publication.id),
    lifecycleStatus: getPublicationLifecycleStatus(publication as any),
    statusWindow: getPublicationStatusWindow(publication as any),
  };
}

export function countStatusPublications(publications: any[]) {
  return publications.reduce(
    (acc, publication) => {
      const status = getPublicationLifecycleStatus(publication);
      acc.total += 1;
      acc[status] += 1;
      return acc;
    },
    {
      total: 0,
      published: 0,
      expired: 0,
      ready: 0,
      inactive: 0,
      deleted: 0,
      error: 0,
    } as Record<StatusPublicationLifecycle | "total", number>
  );
}
