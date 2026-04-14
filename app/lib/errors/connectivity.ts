export function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return String(error ?? "");
}

export function isDatabaseConnectivityError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  return (
    ["EHOSTUNREACH", "ECONNREFUSED", "ETIMEDOUT", "P1001"].includes(code) ||
    /EHOSTUNREACH|ECONNREFUSED|ETIMEDOUT|P1001|Can't reach database server|connect/i.test(message)
  );
}
