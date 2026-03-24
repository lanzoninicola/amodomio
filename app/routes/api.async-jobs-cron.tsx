import type { LoaderFunctionArgs } from "@remix-run/node";
import { ok, serverError, unauthorized } from "~/utils/http-response.server";
import { getCronBatchLimit, runPendingAsyncJobsBatch } from "~/domain/async-jobs/async-jobs.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = String(process.env.CRON_SECRET || "").trim();

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return unauthorized("Unauthorized");
    }

    const result = await runPendingAsyncJobsBatch({
      limit: getCronBatchLimit(),
      lockedBy: "vercel-cron",
      maxLimit: getCronBatchLimit(),
    });

    return ok({
      message: "Cron executado com sucesso",
      ...result,
      limit: getCronBatchLimit(),
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}
