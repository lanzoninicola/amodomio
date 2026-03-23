import type { LoaderFunctionArgs } from "@remix-run/node";
import { ok, serverError, unauthorized } from "~/utils/http-response.server";
import { runPendingAsyncJobsBatch } from "~/domain/async-jobs/async-jobs.server";

function getCronLimit() {
  const raw = Number(process.env.ASYNC_JOBS_CRON_LIMIT || 25);
  if (!Number.isFinite(raw)) return 25;
  return Math.max(1, Math.min(100, Math.floor(raw)));
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = String(process.env.CRON_SECRET || "").trim();

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return unauthorized("Unauthorized");
    }

    const result = await runPendingAsyncJobsBatch({
      limit: getCronLimit(),
      lockedBy: "vercel-cron",
    });

    return ok({
      message: "Cron executado com sucesso",
      ...result,
      limit: getCronLimit(),
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}
