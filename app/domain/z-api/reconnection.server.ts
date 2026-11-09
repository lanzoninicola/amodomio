import { setTimeout as delay } from "node:timers/promises";
import {
  getZapiConnection,
  zapiInstancePath,
  zapiRequest,
  ZApiError,
} from "./zapi-client.server";

export type ReconnectionResult = (
  | { state: "connected"; message: string }
  | { state: "disconnected"; message: string }
  | { state: "qr"; message: string; qrCode: string; expiresAt: number }
  | { state: "error"; message: string }
) & { checkedAt?: number };

const CONNECTION_TIMEOUT_MS = 5_000;

function qrImage(value: unknown) {
  if (typeof value !== "string" || value.length > 512_000) return null;
  const base64 = value
    .replace(/^data:image\/(?:png|jpeg|webp);base64,/, "")
    .trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const bytes = Buffer.from(base64, "base64");
  let mime: string;
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = "image/png";
  else if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    mime = "image/jpeg";
  else if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    mime = "image/webp";
  else return null;
  return `data:${mime};base64,${base64}`;
}

export async function checkZapiReconnection(): Promise<ReconnectionResult> {
  const { connected } = await getZapiConnection({
    timeoutMs: CONNECTION_TIMEOUT_MS,
  });
  return connected
    ? {
        state: "connected",
        message: "WhatsApp conectado. Os envios estão disponíveis.",
      }
    : { state: "disconnected", message: "A instância continua desconectada." };
}

export async function getZapiPairingQrCode(): Promise<ReconnectionResult> {
  const connection = await checkZapiReconnection();
  if (connection.state === "connected") return connection;
  const response = await zapiRequest<unknown>(
    "GET",
    `${zapiInstancePath}/qr-code/image`,
    undefined,
    { timeoutMs: CONNECTION_TIMEOUT_MS }
  );
  const object =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : null;
  if (object?.challenge) {
    throw new ZApiError(
      "O WhatsApp solicitou autenticação adicional. Conclua a conexão no painel da Z-API.",
      409,
      null,
      "/qr-code/image"
    );
  }
  const image = qrImage(object?.value ?? response);
  if (!image) {
    throw new ZApiError(
      "O QR Code ainda não está disponível. Aguarde alguns segundos e gere um novo código.",
      502,
      null,
      "/qr-code/image"
    );
  }
  return {
    state: "qr",
    message: "Vincule o WhatsApp lendo o QR Code abaixo.",
    qrCode: image,
    expiresAt: Date.now() + 20_000,
  };
}

export async function tryReconnectZapi(): Promise<ReconnectionResult> {
  const before = await checkZapiReconnection();
  if (before.state === "connected") return before;
  const response = await zapiRequest<{ value?: boolean }>(
    "GET",
    `${zapiInstancePath}/restart`,
    undefined,
    { timeoutMs: CONNECTION_TIMEOUT_MS }
  );
  if (response?.value !== true) {
    throw new ZApiError(
      "A Z-API não confirmou a reinicialização da instância.",
      502,
      null,
      "/restart"
    );
  }
  // One restart only. Poll while the existing WhatsApp session comes back.
  let checked: ReconnectionResult | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    await delay(2_000);
    checked = await checkZapiReconnection().catch(() => null);
    if (checked?.state === "connected") return checked;
  }
  if (!checked) {
    throw new ZApiError(
      "A instância foi reiniciada, mas não foi possível verificar a conexão. Use Verificar conexão antes de tentar novamente.",
      504,
      null,
      "/status"
    );
  }
  return getZapiPairingQrCode();
}
