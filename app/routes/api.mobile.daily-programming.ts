import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getAuthenticatedBearerSession } from "~/domain/auth/user-session.server";
import {
  getDailyProgramming,
  loadWeeklyHistoryData,
} from "~/domain/production/daily-programming.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { user } = await getAuthenticatedBearerSession(request);
  if (!user) return json({ message: "Sessão expirada." }, { status: 401 });
  const headers = { "Cache-Control": "no-store" };
  if (new URL(request.url).searchParams.get("weeklyHistory") === "1") {
    return json(await loadWeeklyHistoryData(request), { headers });
  }
  const result = getDailyProgramming(request);
  return json({ ...result, stats: await result.stats }, { headers });
}
