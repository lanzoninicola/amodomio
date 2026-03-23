import prismaClient from "~/lib/prisma/client.server";
import { runCostImpactPipelineForItemChange } from "~/domain/costs/cost-impact-pipeline.server";
import { notifyAsyncJobWhatsappEvent } from "~/domain/async-jobs/async-jobs-whatsapp.server";

export const ASYNC_JOB_TYPE = {
  costImpactRecalc: "cost_impact_recalc",
} as const;

export type AsyncJobType = (typeof ASYNC_JOB_TYPE)[keyof typeof ASYNC_JOB_TYPE];

function asDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function enqueueAsyncJob(params: {
  type: AsyncJobType | string;
  dedupeKey?: string | null;
  payload: Record<string, any>;
  priority?: number;
  runAfter?: Date | string | null;
  maxAttempts?: number;
}) {
  const db = prismaClient as any;
  const priority = Math.max(1, Number(params.priority || 100));
  const runAfter = asDate(params.runAfter);
  const maxAttempts = Math.max(1, Number(params.maxAttempts || 3));
  const dedupeKey = String(params.dedupeKey || "").trim() || null;

  if (dedupeKey) {
    const existing = await db.asyncJob.findUnique({ where: { dedupeKey } });
    if (existing) {
      if (String(existing.status) === "running") return existing;
      return await db.asyncJob.update({
        where: { dedupeKey },
        data: {
          type: params.type,
          status: "pending",
          priority,
          payload: params.payload,
          result: null,
          errorMessage: null,
          runAfter,
          maxAttempts,
          lockedAt: null,
          lockedBy: null,
          startedAt: null,
          finishedAt: null,
        },
      });
    }
  }

  return await db.asyncJob.create({
    data: {
      type: params.type,
      status: "pending",
      priority,
      dedupeKey,
      payload: params.payload,
      maxAttempts,
      runAfter,
    },
  });
}

export async function getAsyncJobsDashboard(params?: { recentLimit?: number }) {
  const db = prismaClient as any;
  const recentLimit = Math.max(10, Math.min(200, Number(params?.recentLimit || 60)));

  const [counts, grouped, pendingJobs, failedJobs, runningJobs, recentJobs] = await Promise.all([
    db.asyncJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.asyncJob.groupBy({
      by: ["type", "status"],
      _count: { _all: true },
    }),
    db.asyncJob.findMany({
      where: { status: "pending" },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: recentLimit,
    }),
    db.asyncJob.findMany({
      where: { status: "failed" },
      orderBy: [{ updatedAt: "desc" }],
      take: recentLimit,
    }),
    db.asyncJob.findMany({
      where: { status: "running" },
      orderBy: [{ startedAt: "asc" }],
      take: recentLimit,
    }),
    db.asyncJob.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: recentLimit,
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((row: any) => [String(row.status || "unknown"), Number(row._count?._all || 0)]),
  );

  const groupedMap = new Map<string, any>();
  for (const row of grouped) {
    const type = String(row.type || "unknown");
    const status = String(row.status || "unknown");
    const current = groupedMap.get(type) || {
      type,
      pending: 0,
      running: 0,
      failed: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    };
    const count = Number(row._count?._all || 0);
    current[status] = count;
    current.total += count;
    groupedMap.set(type, current);
  }

  return {
    counts: {
      pending: Number(countMap.pending || 0),
      running: Number(countMap.running || 0),
      failed: Number(countMap.failed || 0),
      completed: Number(countMap.completed || 0),
      cancelled: Number(countMap.cancelled || 0),
      total: Object.values(countMap).reduce((sum, value) => sum + Number(value || 0), 0),
    },
    groups: Array.from(groupedMap.values()).sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      if (b.failed !== a.failed) return b.failed - a.failed;
      return a.type.localeCompare(b.type);
    }),
    pendingJobs,
    failedJobs,
    runningJobs,
    recentJobs,
  };
}

async function claimNextPendingAsyncJob(params?: { type?: string | null; lockedBy?: string | null }) {
  const db = prismaClient as any;
  const now = new Date();
  const lockedBy = String(params?.lockedBy || "manual:admin").trim() || "manual:admin";

  const candidates = await db.asyncJob.findMany({
    where: {
      status: "pending",
      ...(params?.type ? { type: params.type } : {}),
      OR: [{ runAfter: null }, { runAfter: { lte: now } }],
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: 5,
  });

  for (const candidate of candidates) {
    const updated = await db.asyncJob.updateMany({
      where: { id: candidate.id, status: "pending" },
      data: {
        status: "running",
        attempts: { increment: 1 },
        lockedAt: now,
        lockedBy,
        startedAt: now,
        finishedAt: null,
        errorMessage: null,
      },
    });
    if (Number(updated.count || 0) > 0) {
      return await db.asyncJob.findUnique({ where: { id: candidate.id } });
    }
  }

  return null;
}

async function claimAsyncJobById(params: { id: string; lockedBy?: string | null }) {
  const db = prismaClient as any;
  const now = new Date();
  const lockedBy = String(params.lockedBy || "manual:admin").trim() || "manual:admin";
  const job = await db.asyncJob.findUnique({ where: { id: params.id } });
  if (!job) throw new Error("Job não encontrado");
  if (String(job.status) === "running") return job;
  if (String(job.status) === "completed" || String(job.status) === "cancelled") {
    throw new Error("Job não pode ser executado novamente nesse estado");
  }

  await db.asyncJob.update({
    where: { id: params.id },
    data: {
      status: "running",
      attempts: { increment: 1 },
      lockedAt: now,
      lockedBy,
      startedAt: now,
      finishedAt: null,
      errorMessage: null,
    },
  });

  return await db.asyncJob.findUnique({ where: { id: params.id } });
}

async function runAsyncJobHandler(job: any) {
  const db = prismaClient as any;
  const payload = (job?.payload || {}) as Record<string, any>;

  switch (String(job.type || "")) {
    case ASYNC_JOB_TYPE.costImpactRecalc: {
      const itemId = String(payload.itemId || "").trim();
      if (!itemId) throw new Error("Payload inválido: itemId ausente");

      const result = await runCostImpactPipelineForItemChange({
        db,
        itemId,
        sourceType: payload.sourceType || "async-job",
        sourceRefId: payload.sourceRefId ? String(payload.sourceRefId) : null,
        updatedBy: payload.updatedBy ? String(payload.updatedBy) : "system:async-jobs",
      });

      return {
        itemId: result.sourceItemId,
        affectedRecipes: result.affectedRecipeIds.length,
        affectedSheets: result.affectedItemCostSheetIds.length,
        affectedMenuItems: result.affectedMenuItemIds.length,
      };
    }
    default:
      throw new Error(`Tipo de job não suportado: ${String(job.type || "desconhecido")}`);
  }
}

export async function runAsyncJobById(params: { id: string; lockedBy?: string | null }) {
  const job = await claimAsyncJobById(params);
  return await finalizeAsyncJobRun(job);
}

export async function runPendingAsyncJobsBatch(params?: {
  limit?: number;
  type?: string | null;
  lockedBy?: string | null;
}) {
  const limit = Math.max(1, Math.min(100, Number(params?.limit || 10)));
  const results = [];

  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextPendingAsyncJob({ type: params?.type, lockedBy: params?.lockedBy });
    if (!job) break;
    results.push(await finalizeAsyncJobRun(job));
  }

  return {
    processed: results.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

async function finalizeAsyncJobRun(job: any) {
  const db = prismaClient as any;

  try {
    await notifyAsyncJobWhatsappEvent({ event: "started", job });
    const result = await runAsyncJobHandler(job);
    const completedJob = await db.asyncJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        result,
        errorMessage: null,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
    await notifyAsyncJobWhatsappEvent({ event: "completed", job: completedJob });
    return completedJob;
  } catch (error) {
    const failedJob = await db.asyncJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Erro ao executar job",
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
    await notifyAsyncJobWhatsappEvent({ event: "failed", job: failedJob, error });
    return failedJob;
  }
}
