import { getRequiredServerEnvVar } from "~/utils/get-required-server-env-var.server";

function toPositiveInt(value: string | undefined, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

const zapiInstanceId = getRequiredServerEnvVar("VITE_ZAPI_INSTANCE_ID");
const zapiInstanceToken = getRequiredServerEnvVar("VITE_ZAPI_INSTANCE_TOKEN");
const zapiClientToken = getRequiredServerEnvVar("VITE_ZAPI_CLIENT_TOKEN");

export const env = {
  zapiBaseUrl: "https://api.z-api.io",
  zapiInstanceId,
  zapiInstanceToken,
  zapiClientToken,
  apiKey: process.env.ZAPI_REMIXRUN_API_KEY || "",
  apiRateLimitPerMinute: toPositiveInt(
    process.env.ZAPI_API_RATE_LIMIT_PER_MINUTE,
    60
  ),
  webhookRateLimitPerMinute: toPositiveInt(
    process.env.ZAPI_WEBHOOK_RATE_LIMIT_PER_MINUTE,
    120
  ),
};

export type Env = typeof env;
