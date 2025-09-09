// app/domain/bot/auto-responder.server.ts

import { nlpProcess } from "~/domain/bot/nlp.runtime.server";
import { sendMessage } from "~/domain/bot/wpp.server";
import prismaClient from "~/lib/prisma/client.server";
import { Inbound } from "./auto-responder. types";

const NLP_SCORE_MIN = Number(process.env.NLP_SCORE_MIN ?? "0.6");

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function fetchActiveRules() {
  return await prismaClient.botAutoResponseRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });
}

function isWithinWindow(now: Date, from?: Date | null, to?: Date | null) {
  if (from && now < from) return false;
  if (to && now > to) return false;
  return true;
}

function findMatchingRule(
  rules: Awaited<ReturnType<typeof fetchActiveRules>>,
  text: string
) {
  const now = new Date();
  const normText = normalize(text);

  for (const r of rules) {
    if (!isWithinWindow(now, r.activeFrom, r.activeTo)) continue;

    const trig = r.trigger ?? "";
    if (!trig) continue;

    if (r.isRegex) {
      try {
        const rx = new RegExp(trig, "iu");
        if (rx.test(text)) return r;
      } catch {
        continue;
      }
    } else {
      if (normText.includes(normalize(trig))) return r;
    }
  }
  return null;
}

type Inbound = { from?: string; to?: string; body?: string };

async function saveLog({
  session,
  inbound,
  intent,
  score,
  matchedRuleId,
  reply,
  matchedText,
  error,
  engine = "NLP", // "MANUAL" | "NLP" (se usar enum)
}: {
  session: string;
  inbound: Inbound;
  intent?: string | null;
  score?: number | null;
  matchedRuleId?: string | null;
  reply?: string | null;
  matchedText?: string | null;
  error?: string | null;
  engine?: "MANUAL" | "NLP";
}) {
  try {
    await prismaClient.botAutoResponderLog.create({
      data: {
        session, // novo
        engine, // novo
        intent: intent ?? null, // novo
        score: typeof score === "number" ? score : null, // novo

        ruleId: matchedRuleId ?? null,
        matchedText: matchedText ?? null,
        fromNumber: inbound.from ?? null,
        toNumber: inbound.to ?? null,
        inboundBody: inbound.body ?? "",
        outboundBody: reply ?? null,
        error: error ?? null,
      },
    });
  } catch {
    // silencioso
  }
}

export async function autoResponderEnabled() {
  const settings = await prismaClient.botSetting.findFirst({
    where: { id: 1 },
  });

  return settings?.enabled ?? false;
}

export async function handleInboundMessage(session: string, inbound: Inbound) {
  const arEnabled = await autoResponderEnabled();

  if (!arEnabled) return;

  const text = inbound.body || "";

  let usedReply: string | null = null;
  let usedIntent: string | null = null;
  let usedScore: number | null = null;
  let matchedRuleId: string | null = null;

  // 1) NLP
  try {
    const nlp = await nlpProcess(text);
    usedIntent = nlp?.intent ?? null;
    usedScore = typeof nlp?.score === "number" ? nlp.score : null;

    if (usedIntent && (usedScore ?? 0) >= NLP_SCORE_MIN) {
      switch (usedIntent) {
        case "cardapio.show":
          usedReply = "🍕 Cardápio: https://amodomio.com.br/menu";
          break;
        case "pedido.start":
          usedReply = "📦 Vamos começar seu pedido! Qual sabor você gostaria?";
          break;
        default:
          break;
      }
    }
  } catch {
    // ignora erro do NLP
  }

  if (usedReply) {
    await sendMessage(session, inbound.from, usedReply);
    await saveLog({
      session,
      inbound,
      intent: usedIntent,
      score: usedScore,
      matchedRuleId,
      reply: usedReply,
    });
    return;
  }

  // 2) Regras DB
  const rules = await fetchActiveRules();
  const matched = findMatchingRule(rules, text);
  if (matched?.response) {
    matchedRuleId = matched.id;
    usedReply = matched.response;

    await sendMessage(session, inbound.from, usedReply);
    await saveLog({
      session,
      inbound,
      intent: usedIntent,
      score: usedScore,
      matchedRuleId,
      reply: usedReply,
    });
    return;
  }

  // 3) Fallback
  usedReply =
    'Desculpe, não entendi 🤔\nDigite "1" para ver o cardápio, "2" para promoções, ou "ajuda" para falar com um atendente.';
  await sendMessage(session, inbound.from, usedReply);
  await saveLog({
    session,
    inbound,
    intent: usedIntent,
    score: usedScore,
    matchedRuleId,
    reply: usedReply,
  });
}
