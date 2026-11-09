export type ServerPreset = { name: string; url: string };

export const PUBLIC_SERVER_URL = "https://www.amodomio.com.br";
export const DEFAULT_SERVER_PRESETS: ServerPreset[] = [
  { name: "A modo mio — Público", url: PUBLIC_SERVER_URL },
  { name: "Desenvolvimento", url: "http://localhost:3000" },
];

export function parseServerPresets(value: unknown): ServerPreset[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) {
    throw new Error("Informe uma lista com 1 a 20 servidores.");
  }
  const urls = new Set<string>();
  return value.map((entry) => {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !entry.name.trim() ||
      entry.name.trim().length > 80 ||
      typeof entry.url !== "string"
    ) {
      throw new Error("Cada servidor precisa de name e url válidos.");
    }
    let url: URL;
    try {
      url = new URL(entry.url.trim());
    } catch {
      throw new Error("Informe um endereço HTTP ou HTTPS válido.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      throw new Error("Use a origem HTTP/HTTPS, sem caminho ou credenciais.");
    }
    if (urls.has(url.origin))
      throw new Error("Há servidores com endereço repetido.");
    urls.add(url.origin);
    return { name: entry.name.trim(), url: url.origin };
  });
}
