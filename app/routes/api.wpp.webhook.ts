// app/routes/api.wpp.webhook.ts
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// ✅ Ajuste este import conforme onde está seu util
// (você comentou que usa utils.server.ts dentro de domain/campaigns)
import { normalizeBRPhone } from "~/domain/campaigns/utils.server";
import prismaClient from "~/lib/prisma/client.server";

// ====== CONFIGURAÇÃO DO SEGREDO DO WEBHOOK ======
// Header onde o WppConnect (ou seu proxy) envia o segredo.
// Se quiser fixar um nome, troque a env por um literal, ex.: "x-wpp-webhook-secret".
const WEBHOOK_SECRET_HEADER =
  process.env.WPP_WEBHOOK_SECRET?.toLowerCase() || "x-wpp-webhook-secret";

// Palavras que disparam opt-out automático (case-insensitive)
const OPTOUT_REGEX = /(parar|remover|cancelar|sair)/i;

// ———————————————————————————————————————————————————————————————
// Loader opcional: bloquear GET/HEAD e cia.
// ———————————————————————————————————————————————————————————————
export function loader(_args: LoaderFunctionArgs) {
  return json({ ok: false, error: "Method not allowed" }, { status: 405 });
}

// ———————————————————————————————————————————————————————————————
// ACTION: WEBHOOK
// ———————————————————————————————————————————————————————————————
export async function action({ request }: ActionFunctionArgs) {
  console.log("WPP webhook running");

  // 1) Aceita apenas POST
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  // 2) Autenticação do webhook via header secreto
  const expectedSecret = process.env.WPP_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get(WEBHOOK_SECRET_HEADER);

  if (!expectedSecret) {
    // Falha de configuração do servidor
    console.error("WPP_WEBHOOK_SECRET não configurada no servidor.");
    return json(
      { ok: false, error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 3) Parse do payload
  const payload = await request
    .json()
    .catch(() => null as unknown as Record<string, any> | null);

  if (!payload) {
    return json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  // 4) (Opcional) Proteção simples contra replay: timestamp
  //    Se quiser usar, configure seu sender para enviar um header de data e valide aqui.
  // const tsHeader = request.headers.get("x-webhook-timestamp");
  // if (!tsHeader || Math.abs(Date.now() - Number(tsHeader)) > 5 * 60 * 1000) {
  //   return json({ ok: false, error: "Stale or missing timestamp" }, { status: 401 });
  // }

  // 5) Extrair dados canônicos do evento
  const phone =
    normalizeBRPhone(
      payload?.from ??
        payload?.remoteJid ??
        payload?.chatId ??
        payload?.key?.remoteJid ??
        null
    ) || undefined;

  const direction = payload?.fromMe ? "outbound" : "inbound";
  const type = payload?.type || payload?.event || "message";

  // 6) Auto-responder (GANCHO)
  //    👉 Cole aqui sua lógica atual de autoresponder (se já existir na rota original).
  //    Para não bloquear o ACK do webhook, é recomendável que respostas mais pesadas
  //    rodem em fire-and-forget (ex.: sem await) — mas se sua lógica já é rápida, tudo bem.
  try {
    await handleAutoResponder(payload);
  } catch (err) {
    // Não falhe o webhook por causa do autoresponder
    console.error("Autoresponder error:", (err as Error)?.message || err);
  }

  // 7) Registrar evento cru (auditoria)
  try {
    await prismaClient.wppEvent.create({
      data: {
        phone,
        direction,
        type,
        // Prisma Json
        payload,
      },
    });
  } catch (err) {
    console.error("Erro ao gravar WppEvent:", (err as Error)?.message || err);
    // Não vamos falhar o webhook por causa de log
  }

  // 8) Atualizar Engajamento
  if (phone) {
    try {
      if (direction === "inbound") {
        await prismaClient.engagement.upsert({
          where: { phone },
          update: { lastInboundAt: new Date() },
          create: { phone, lastInboundAt: new Date() },
        });
      } else {
        await prismaClient.engagement.upsert({
          where: { phone },
          update: { lastOutboundAt: new Date() },
          create: { phone, lastOutboundAt: new Date() },
        });
      }
    } catch (err) {
      console.error(
        "Erro ao atualizar Engagement:",
        (err as Error)?.message || err
      );
    }
  }

  // 9) Opt-out automático por palavra-chave (somente inbound)
  if (phone && direction === "inbound") {
    const text = String(
      payload?.text?.body ??
        payload?.message?.conversation ??
        payload?.content?.text ??
        payload?.body ??
        payload?.message?.extendedTextMessage?.text ??
        ""
    )
      .toLowerCase()
      .trim();

    if (text && OPTOUT_REGEX.test(text)) {
      try {
        await prismaClient.optout.upsert({
          where: { phone },
          update: { reason: "keyword", createdAt: new Date() },
          create: { phone, reason: "keyword" },
        });
      } catch (err) {
        console.error("Erro ao gravar Optout:", (err as Error)?.message || err);
      }
    }
  }

  // 10) ACK rápido
  return json({ ok: true });
}

// ———————————————————————————————————————————————————————————————
// GANCHO DO AUTORESPONDER
// 👉 Substitua pelo seu código atual (ou importe de domain/bot/...)
// ———————————————————————————————————————————————————————————————
async function handleAutoResponder(_payload: any) {
  // EXEMPLO (no-op): manter vazio para não interferir.
  // Cole aqui a sua lógica existente de auto-responder,
  // por exemplo:
  //
  // - detectar palavras-chave da conversa
  // - consultar seu state de sessão WppConnect
  // - enviar respostas contextuais
  //
  // IMPORTANTE: se sua lógica enviar mensagens pelo WppConnect,
  // faça isso de forma resiliente e trate erros localmente,
  // para não bloquear o ACK do webhook.
  return;
}
