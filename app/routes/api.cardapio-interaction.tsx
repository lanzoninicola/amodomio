import { json, type ActionFunctionArgs } from "@remix-run/node";
import {
  CARDAPIO_NAVIGATION_CONTROLS,
  CARDAPIO_NAVIGATION_EVENT,
  CARDAPIO_NAVIGATION_PLACEMENTS,
} from "~/domain/cardapio/cardapio-interaction/cardapio-interaction.shared";
import { isAllowedRequestOrigin } from "~/domain/security/origin.server";
import prismaClient from "~/lib/prisma/client.server";

const allowedControls = new Set<string>(CARDAPIO_NAVIGATION_CONTROLS);
const allowedPlacements = new Set<string>(CARDAPIO_NAVIGATION_PLACEMENTS);

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

  const eventName = normalizeString(payload.eventName, 64);
  const control = normalizeString(payload.control, 32);
  const value = normalizeString(payload.value, 120);
  const placement = normalizeString(payload.placement, 32);
  const clientId = normalizeString(payload.clientId, 120) || null;
  const path = normalizeString(payload.path, 255);

  if (
    eventName !== CARDAPIO_NAVIGATION_EVENT ||
    !allowedControls.has(control) ||
    !allowedPlacements.has(placement) ||
    !value ||
    !path.startsWith("/cardapio")
  ) {
    return json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await prismaClient.cardapioInteractionEvent.create({
      data: {
        eventName,
        control,
        value,
        placement,
        clientId,
        path,
      },
    });
    return json({ ok: true });
  } catch (error) {
    console.error("[api.cardapio-interaction]", error);
    return json({ error: "server_error" }, { status: 500 });
  }
}
