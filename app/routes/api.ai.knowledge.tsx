import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getAiKnowledgeSnapshot } from "~/domain/ai/ai-knowledge.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";

const RATE_LIMIT_BUCKET = "ai-knowledge";

export async function loader({ request }: LoaderFunctionArgs) {
  const rateLimit = restApi.rateLimitCheck(request, {
    bucket: RATE_LIMIT_BUCKET,
  });
  if (!rateLimit.success) {
    return json(
      { error: "too_many_requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimit.retryIn ?? 60_000) / 1_000)
          ),
        },
      }
    );
  }

  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200) {
    return json(
      { error: "unauthorized", message: auth.message },
      { status: auth.status === 500 ? 500 : 401 }
    );
  }

  return json({ ok: true, knowledge: await getAiKnowledgeSnapshot() });
}
