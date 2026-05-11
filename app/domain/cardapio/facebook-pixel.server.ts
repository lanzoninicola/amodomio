import { FacebookPixelIntegrationMode, Prisma } from "@prisma/client";

import prismaClient from "~/lib/prisma/client.server";

export const DEFAULT_FACEBOOK_PIXEL_ROUTE_PATH = "/cardapio";
export const DEFAULT_FACEBOOK_PIXEL_CONFIG_NAME = "Cardápio";

export const CARDAPIO_FACEBOOK_PIXEL_DEFAULT_EVENTS = [
  {
    eventKey: "page_view",
    eventName: "PageView",
    trigger: "page_view",
    enabled: true,
    payloadJson: "",
  },
  {
    eventKey: "fazer_pedido_click",
    eventName: "InitiateCheckout",
    trigger: "fazer_pedido_click",
    enabled: true,
    payloadJson: "",
  },
] as const;

export type CardapioFacebookPixelRuntimeEvent = {
  id: string;
  eventKey: string;
  eventName: string;
  trigger: string;
  enabled: boolean;
  payload: Record<string, unknown> | null;
};

export type CardapioFacebookPixelRuntimeConfig = {
  id: string;
  name: string;
  routePath: string;
  enabled: boolean;
  mode: FacebookPixelIntegrationMode;
  pixelId: string | null;
  gtmContainerId: string | null;
  events: CardapioFacebookPixelRuntimeEvent[];
};

type FacebookPixelConfigWithEvents = Prisma.CardapioFacebookPixelConfigGetPayload<{
  include: { events: true };
}>;

function normalizePayload(payloadJson: string | null): Record<string, unknown> | null {
  if (!payloadJson?.trim()) return null;

  try {
    const parsed = JSON.parse(payloadJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function normalizeRoutePathInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withoutTrailingSlash =
    trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
  const withLeadingSlash = withoutTrailingSlash.startsWith("/")
    ? withoutTrailingSlash
    : `/${withoutTrailingSlash}`;

  return withLeadingSlash.replace(/\/{2,}/g, "/");
}

function matchesRoutePath(pathname: string, routePath: string) {
  if (routePath === "/") return true;
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

export function validatePixelConfigInput(input: {
  name: string;
  routePath: string;
  enabled: boolean;
  mode: FacebookPixelIntegrationMode;
  pixelId: string;
  gtmContainerId: string;
}) {
  const name = input.name.trim();
  const routePath = normalizeRoutePathInput(input.routePath);
  const pixelId = input.pixelId.trim();
  const gtmContainerId = input.gtmContainerId.trim().toUpperCase();

  if (!name) return "Informe um nome para a configuração.";
  if (!routePath) return "Informe a rota onde o pixel deve ser aplicado.";
  if (!routePath.startsWith("/")) return "A rota deve começar com '/'.";

  if (input.enabled && input.mode === FacebookPixelIntegrationMode.direct && !pixelId) {
    return "Informe o Pixel ID para usar o modo direto.";
  }

  if (input.enabled && input.mode === FacebookPixelIntegrationMode.gtm && !gtmContainerId) {
    return "Informe o ID do container GTM para usar o modo GTM.";
  }

  if (gtmContainerId && !/^GTM-[A-Z0-9]+$/i.test(gtmContainerId)) {
    return "O ID do container GTM deve seguir o formato GTM-XXXX.";
  }

  return null;
}

export function validatePixelEventInput(input: {
  eventKey: string;
  eventName: string;
  trigger: string;
  payloadJson: string;
}) {
  const eventKey = input.eventKey.trim();
  const eventName = input.eventName.trim();
  const trigger = input.trigger.trim();
  const payloadJson = input.payloadJson.trim();

  if (!eventKey) return "Informe uma chave interna para o evento.";
  if (!/^[a-z0-9_]+$/i.test(eventKey)) return "A chave do evento deve usar apenas letras, números e underscore.";
  if (!eventName) return "Informe o nome do evento enviado para o Meta Pixel.";
  if (!trigger) return "Informe o gatilho usado no cardápio.";

  if (payloadJson) {
    try {
      const parsed = JSON.parse(payloadJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return "O payload JSON deve ser um objeto.";
      }
    } catch {
      return "O payload JSON precisa ser um JSON válido.";
    }
  }

  return null;
}

export async function ensureDefaultCardapioFacebookPixelConfig() {
  const existing = await prismaClient.cardapioFacebookPixelConfig.findUnique({
    where: { routePath: DEFAULT_FACEBOOK_PIXEL_ROUTE_PATH },
    include: { events: { orderBy: [{ createdAt: "asc" }] } },
  });

  if (existing) return existing;

  return prismaClient.cardapioFacebookPixelConfig.create({
    data: {
      name: DEFAULT_FACEBOOK_PIXEL_CONFIG_NAME,
      routePath: DEFAULT_FACEBOOK_PIXEL_ROUTE_PATH,
      events: {
        create: CARDAPIO_FACEBOOK_PIXEL_DEFAULT_EVENTS.map((event) => ({
          eventKey: event.eventKey,
          eventName: event.eventName,
          trigger: event.trigger,
          enabled: event.enabled,
          payloadJson: event.payloadJson,
        })),
      },
    },
    include: { events: { orderBy: [{ createdAt: "asc" }] } },
  });
}

export async function listFacebookPixelConfigs() {
  await ensureDefaultCardapioFacebookPixelConfig();

  return prismaClient.cardapioFacebookPixelConfig.findMany({
    include: {
      events: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
    orderBy: [{ routePath: "asc" }],
  });
}

export async function getFacebookPixelConfigById(id: string) {
  return prismaClient.cardapioFacebookPixelConfig.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
}

function toRuntimeConfig(config: FacebookPixelConfigWithEvents): CardapioFacebookPixelRuntimeConfig {
  return {
    id: config.id,
    name: config.name,
    routePath: config.routePath,
    enabled: config.enabled,
    mode: config.mode,
    pixelId: config.pixelId,
    gtmContainerId: config.gtmContainerId,
    events: config.events.map((event) => ({
      id: event.id,
      eventKey: event.eventKey,
      eventName: event.eventName,
      trigger: event.trigger,
      enabled: event.enabled,
      payload: normalizePayload(event.payloadJson),
    })),
  };
}

export async function getFacebookPixelRuntimeConfigForPath(pathname: string): Promise<CardapioFacebookPixelRuntimeConfig | null> {
  await ensureDefaultCardapioFacebookPixelConfig();

  const configs = await prismaClient.cardapioFacebookPixelConfig.findMany({
    include: {
      events: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  const normalizedPathname = normalizeRoutePathInput(pathname) || "/";
  const matchingConfig = configs
    .filter((config) => matchesRoutePath(normalizedPathname, config.routePath))
    .sort((a, b) => b.routePath.length - a.routePath.length)[0];

  if (!matchingConfig) return null;

  return toRuntimeConfig(matchingConfig);
}

export async function createFacebookPixelConfig(input: {
  name: string;
  routePath: string;
  enabled: boolean;
  mode: FacebookPixelIntegrationMode;
  pixelId: string;
  gtmContainerId: string;
}) {
  return prismaClient.cardapioFacebookPixelConfig.create({
    data: {
      name: input.name.trim(),
      routePath: normalizeRoutePathInput(input.routePath),
      enabled: input.enabled,
      mode: input.mode,
      pixelId: input.pixelId.trim() || null,
      gtmContainerId: input.gtmContainerId.trim().toUpperCase() || null,
      events: {
        create: CARDAPIO_FACEBOOK_PIXEL_DEFAULT_EVENTS.map((event) => ({
          eventKey: event.eventKey,
          eventName: event.eventName,
          trigger: event.trigger,
          enabled: event.enabled,
          payloadJson: event.payloadJson,
        })),
      },
    },
    include: {
      events: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
}

export async function updateFacebookPixelConfig(input: {
  id: string;
  name: string;
  routePath: string;
  enabled: boolean;
  mode: FacebookPixelIntegrationMode;
  pixelId: string;
  gtmContainerId: string;
}) {
  return prismaClient.cardapioFacebookPixelConfig.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      routePath: normalizeRoutePathInput(input.routePath),
      enabled: input.enabled,
      mode: input.mode,
      pixelId: input.pixelId.trim() || null,
      gtmContainerId: input.gtmContainerId.trim().toUpperCase() || null,
    },
    include: {
      events: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
}

export async function createFacebookPixelEvent(input: {
  configId: string;
  eventKey: string;
  eventName: string;
  trigger: string;
  enabled: boolean;
  payloadJson: string;
}) {
  return prismaClient.cardapioFacebookPixelEvent.create({
    data: {
      configId: input.configId,
      eventKey: input.eventKey.trim(),
      eventName: input.eventName.trim(),
      trigger: input.trigger.trim(),
      enabled: input.enabled,
      payloadJson: input.payloadJson.trim() || null,
    },
  });
}

export async function updateFacebookPixelEvent(input: {
  id: string;
  eventKey: string;
  eventName: string;
  trigger: string;
  enabled: boolean;
  payloadJson: string;
}) {
  return prismaClient.cardapioFacebookPixelEvent.update({
    where: { id: input.id },
    data: {
      eventKey: input.eventKey.trim(),
      eventName: input.eventName.trim(),
      trigger: input.trigger.trim(),
      enabled: input.enabled,
      payloadJson: input.payloadJson.trim() || null,
    },
  });
}

export async function deleteFacebookPixelEvent(id: string) {
  return prismaClient.cardapioFacebookPixelEvent.delete({ where: { id } });
}

export function isFacebookPixelUniqueError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
