import prisma from "~/lib/prisma/client.server";

const DAY_MS = 24 * 60 * 60 * 1_000;

function classifyError(message: string | null) {
  const normalized = message?.toLowerCase() ?? "";
  if (/\b429\b|rate.?limit|too many requests/.test(normalized)) {
    return { code: "rate_limit", label: "Limite do provedor (429)" };
  }
  if (/\b401\b|\b403\b|unauthor|forbidden|api.?key/.test(normalized)) {
    return { code: "authentication", label: "Autenticação ou permissão" };
  }
  if (/timeout|timed out|abort/.test(normalized)) {
    return { code: "timeout", label: "Tempo limite excedido" };
  }
  if (/z-api|zapi|send.?text|whatsapp/.test(normalized)) {
    return { code: "whatsapp", label: "Envio ao WhatsApp" };
  }
  if (/openrouter|openai|provider|model/.test(normalized)) {
    return { code: "provider", label: "Modelo ou provedor" };
  }
  return { code: "other", label: "Outro erro" };
}

export async function getWhatsappAgentMonitoring() {
  const now = new Date();
  const since24Hours = new Date(now.getTime() - DAY_MS);
  const since7Days = new Date(now.getTime() - 7 * DAY_MS);

  const [statusGroups, failedJobs, recentJobs, oldestPending] =
    await Promise.all([
      prisma.whatsappAgentJob.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since24Hours } },
        _count: { _all: true },
      }),
      prisma.whatsappAgentJob.findMany({
        where: {
          createdAt: { gte: since7Days },
          lastError: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
        select: { lastError: true },
      }),
      prisma.whatsappAgentJob.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          phone: true,
          inboundText: true,
          status: true,
          attempts: true,
          lastError: true,
          lockedBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.whatsappAgentJob.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

  const statusCounts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count._all])
  );
  const sent = statusCounts.sent ?? 0;
  const generated = statusCounts.generated ?? 0;
  const failed = statusCounts.failed ?? 0;
  const completed = sent + generated + failed;

  const errors = new Map<
    string,
    { code: string; label: string; count: number }
  >();
  for (const job of failedJobs) {
    const category = classifyError(job.lastError);
    const current = errors.get(category.code) ?? { ...category, count: 0 };
    current.count += 1;
    errors.set(category.code, current);
  }

  return {
    generatedAt: now,
    statusCounts,
    total24Hours: Object.values(statusCounts).reduce(
      (total, count) => total + count,
      0
    ),
    successRate: completed ? ((sent + generated) / completed) * 100 : null,
    oldestPendingAt: oldestPending?.createdAt ?? null,
    errors: [...errors.values()].sort((a, b) => b.count - a.count),
    recentJobs: recentJobs.map((job) => ({
      ...job,
      errorCategory: job.lastError ? classifyError(job.lastError) : null,
    })),
  };
}
