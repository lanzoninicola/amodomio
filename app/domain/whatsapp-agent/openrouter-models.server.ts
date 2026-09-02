export type OpenRouterModelOption = {
  id: string;
  name: string;
  contextLength: number | null;
  promptPricePerMillion: number | null;
  completionPricePerMillion: number | null;
  isFree: boolean;
};

const CACHE_TTL_MS = 15 * 60_000;
let cache: { expiresAt: number; models: OpenRouterModelOption[] } | null = null;

function perMillion(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : null;
}

export async function getOpenRouterModels() {
  if (cache && cache.expiresAt > Date.now()) return cache.models;

  const response = await fetch(
    "https://openrouter.ai/api/v1/models?output_modalities=text&max_price=0&sort=most-popular",
    { signal: AbortSignal.timeout(8_000) }
  );
  if (!response.ok) {
    throw new Error(`OpenRouter models request failed (${response.status})`);
  }

  const payload = (await response.json()) as { data?: unknown[] };
  const models = (Array.isArray(payload.data) ? payload.data : [])
    .flatMap((raw) => {
      const model = raw as Record<string, any>;
      const id = typeof model.id === "string" ? model.id.trim() : "";
      const name = typeof model.name === "string" ? model.name.trim() : id;
      const outputModalities = model.architecture?.output_modalities;
      if (
        !id ||
        (Array.isArray(outputModalities) && !outputModalities.includes("text"))
      ) {
        return [];
      }
      const promptPricePerMillion = perMillion(model.pricing?.prompt);
      const completionPricePerMillion = perMillion(model.pricing?.completion);
      return [
        {
          id,
          name,
          contextLength:
            typeof model.context_length === "number"
              ? model.context_length
              : null,
          promptPricePerMillion,
          completionPricePerMillion,
          isFree:
            promptPricePerMillion === 0 && completionPricePerMillion === 0,
        } satisfies OpenRouterModelOption,
      ];
    })
    // max_price filters input price server-side; verify output price locally too.
    .filter((model) => model.isFree)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, models };
  return models;
}
