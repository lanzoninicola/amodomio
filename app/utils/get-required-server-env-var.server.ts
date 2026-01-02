export function getRequiredServerEnvVar(key: string, devValue?: string) {
  return getRequiredEnvVarFromObj(process.env, key, devValue);
}

function getRequiredEnvVarFromObj(
  obj: Record<string, string | undefined>,
  key: string,
  devValue: string = `${key}-dev-value`
) {
  const envVal = obj[key];
  return envVal ?? false;
}
