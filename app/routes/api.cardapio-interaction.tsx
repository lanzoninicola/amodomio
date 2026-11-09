import { json, type ActionFunctionArgs } from "@remix-run/node";
import {
  BIO_EVENTS,
  CARDAPIO_FEATURED_EVENTS,
  parseCardapioTrackingRecord,
} from "~/domain/cardapio/tracking/cardapio-tracking-events";
import { saveCardapioTrackingRecord } from "~/domain/cardapio/tracking/cardapio-tracking-records.server";
import { isAllowedRequestOrigin } from "~/domain/security/origin.server";

const normalizeString = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  if (!isAllowedRequestOrigin(request)) {
    return json({ error: "origin_not_allowed" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const record = parseCardapioTrackingRecord(payload);
  const clientId = normalizeString(payload.clientId, 120) || null;
  const path = normalizeString(payload.path, 255);

  const isBioPath = path === "/bio" || path.startsWith("/bio?");
  const isCardapioPath = path.startsWith("/cardapio");
  const isBioEvent = record
    ? BIO_EVENTS.some((eventName) => eventName === record.eventName)
    : false;
  const isFeaturedEvent = record
    ? CARDAPIO_FEATURED_EVENTS.some(
        (eventName) => eventName === record.eventName
      )
    : false;
  const hasMatchingEventPath =
    (isBioPath && (isBioEvent || isFeaturedEvent)) ||
    (isCardapioPath && !isBioEvent);

  if (!record || !hasMatchingEventPath) {
    return json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await saveCardapioTrackingRecord({ record, clientId, path });
    return json({ ok: true });
  } catch (error) {
    console.error("[api.cardapio-interaction]", error);
    return json({ error: "server_error" }, { status: 500 });
  }
}
