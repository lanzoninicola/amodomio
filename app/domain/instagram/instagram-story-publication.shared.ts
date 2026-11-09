export const INSTAGRAM_STORY_TTL_HOURS = 24;

function addHours(value: string | Date, hours: number) {
  const date = new Date(value);
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function getInstagramStoryStatusWindow(publication: {
  lastPublishedAt?: string | Date | null;
  lastPublishStatus?: string | null;
}) {
  if (
    !publication.lastPublishedAt ||
    publication.lastPublishStatus !== "success"
  ) {
    return { expiresAt: null, expired: true };
  }

  const expiresAt = addHours(
    publication.lastPublishedAt,
    INSTAGRAM_STORY_TTL_HOURS
  );
  return {
    expiresAt,
    expired: expiresAt.getTime() <= Date.now(),
  };
}

export function getInstagramStoryLifecycleStatus(publication: {
  active?: boolean | null;
  deletedAt?: string | Date | null;
  lastPublishedAt?: string | Date | null;
  lastPublishStatus?: string | null;
}) {
  if (publication.deletedAt) return "deleted";
  if (publication.lastPublishStatus === "error") return "error";
  if (publication.lastPublishStatus === "processing") return "processing";
  if (!publication.active) return "inactive";

  const window = getInstagramStoryStatusWindow(publication);
  if (!window.expiresAt) return "ready";
  return window.expired ? "expired" : "published";
}

export function buildInstagramStoryPublishEndpoint(
  origin: string,
  publicationId: string
) {
  return new URL(
    `/api/instagram-stories/${encodeURIComponent(publicationId)}/publish`,
    origin
  ).toString();
}

export function buildInstagramStoryGroupPublishEndpoint(
  origin: string,
  sourceType: string,
  sourceId: string
) {
  return new URL(
    `/api/instagram-stories/groups/${encodeURIComponent(
      sourceType
    )}/${encodeURIComponent(sourceId)}/publish`,
    origin
  ).toString();
}

export function buildInstagramStorySchedulerScript(publishEndpoint: string) {
  return `set -euo pipefail

curl -fsS -X POST "${publishEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: \${VITE_REST_API_SECRET_KEY}" \\
  -d '{"source":"scheduler"}'`;
}
