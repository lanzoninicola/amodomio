import { getRequiredServerEnvVar } from "~/utils/get-required-server-env-var.server";

function toPositiveInt(value: string | undefined, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

const zapiInstanceId = getRequiredServerEnvVar("VITE_ZAPI_INSTANCE_ID");
const zapiInstanceToken = getRequiredServerEnvVar("VITE_ZAPI_INSTANCE_TOKEN");
const zapiClientToken = getRequiredServerEnvVar("VITE_ZAPI_CLIENT_TOKEN");
const zapiRemixRunApiKey = getRequiredServerEnvVar(
  "VITE_ZAPI_REMIXRUN_API_KEY"
);
const zapiApiRateLimitPerMinute = getRequiredServerEnvVar(
  "VITE_ZAPI_REMIXRUN_API_KEY"
);
const zapiEebhookRateLimitPerMinute = getRequiredServerEnvVar(
  "VITE_ZAPI_WEBHOOK_RATE_LIMIT_PER_MINUTE"
);

export const env = {
  zapiBaseUrl: "https://api.z-api.io",
  zapiInstanceId,
  zapiInstanceToken,
  zapiClientToken,
  apiKey: zapiRemixRunApiKey,
  apiRateLimitPerMinute: toPositiveInt(
    zapiApiRateLimitPerMinute ? zapiApiRateLimitPerMinute : undefined,
    60
  ),
  webhookRateLimitPerMinute: toPositiveInt(
    zapiEebhookRateLimitPerMinute ? zapiEebhookRateLimitPerMinute : undefined,
    120
  ),
};

export type Env = typeof env;
