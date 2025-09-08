// app/domain/bot/auto-responder.server.ts
import { HandleResult, InboundMessage } from "./auto-responder. types";
import { sendText } from "./wpp.server";
import prismaClient from "~/lib/prisma/client.server";

/**
 * Helper de horário — se precisar, troque para luxon/timezone
 */
function nowInSaoPaulo(): Date {
  // O Node costuma rodar em UTC; se você quiser precisão com TZ, use luxon e setZone("America/Sao_Paulo")
  return new Date();
}

async function getBotSetting() {
  return prismaClient.botSetting.findFirst({ where: { id: 1 } });
}

/**
 * Verifica se estamos dentro do horário configurado.
 * Retorna também a setting para reuso no fallback off-hours.
 */
async function checkBusinessWindow() {
  const setting = await getBotSetting();
  if (!setting) {
    return { inDay: true, inHour: true, setting: undefined as typeof setting };
  }

  const now = nowInSaoPaulo();
  const day = now.getDay(); // 0=Dom, 1=Seg, ...
  const hour = now.getHours();

  const allowedDays = (setting.businessDays || "3,4,5,6,0")
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v));

  const inDay = allowedDays.includes(day);
  const inHour =
    hour >= setting.businessStartHour && hour < setting.businessEndHour;
  return { inDay, inHour, setting };
}

/**
 * Carrega regras ativas ordenadas por prioridade (asc) e data
 */
async function loadActiveRules() {
  return prismaClient.botAutoResponseRule.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Tenta casar a mensagem com as regras (regex ou inclusão de substring)
 */
async function matchRule(body: string) {
  const txt = (body || "").trim();
  if (!txt) return undefined;

  const rules = await loadActiveRules();

  for (const r of rules) {
    // Se a regra tiver janela específica, poderia validar r.activeFrom/r.activeTo aqui (opcional)

    if (r.isRegex) {
      try {
        const re = new RegExp(r.trigger, "i");
        if (re.test(txt)) return r;
      } catch {
        // ignora regex inválida sem quebrar o fluxo
      }
    } else {
      if (txt.toLowerCase().includes(r.trigger.toLowerCase())) return r;
    }
  }

  return undefined;
}

/**
 * Cria log de forma resiliente
 */
async function createLog(data: {
  ruleId?: string | null;
  matchedText?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  inboundBody: string;
  outboundBody?: string | null;
  error?: string | null;
}) {
  try {
    await prismaClient.botAutoResponderLog.create({ data });
  } catch (e) {
    // Evita quebrar o fluxo por falha de log
    console.error("Falha ao gravar log do bot:", e);
  }
}

/**
 * Manipula uma mensagem recebida e dispara o auto-responder se aplicável.
 * - Faz match com regras
 * - Respeita janela off-hours
 * - Gera logs estruturados
 */
export async function handleInboundMessage(
  session: string,
  msg: InboundMessage
): Promise<HandleResult> {
  const inboundJson = JSON.stringify(msg);

  try {
    const { inDay, inHour, setting } = await checkBusinessWindow();

    // 1) Tenta casar com uma regra
    const rule = await matchRule(msg.body);

    if (rule) {
      const outbound = await sendText(session, msg.from, rule.response);

      await createLog({
        ruleId: rule.id,
        matchedText: msg.body,
        fromNumber: msg.from,
        toNumber: msg.to ?? null,
        inboundBody: inboundJson,
        outboundBody: JSON.stringify(outbound),
      });

      return { matched: true, ruleId: rule.id };
    }

    // 2) Sem regra: se fora do horário, dispara mensagem de off-hours
    if (!(inDay && inHour)) {
      const text =
        setting?.offHoursMessage ??
        "Estamos fora do horário. Voltamos em breve! 🍕";
      const outbound = await sendText(session, msg.from, text);

      await createLog({
        matchedText: msg.body,
        fromNumber: msg.from,
        toNumber: msg.to ?? null,
        inboundBody: inboundJson,
        outboundBody: JSON.stringify(outbound),
      });

      return { matched: true, offHours: true };
    }

    // 3) Sem ação: apenas loga a entrada para auditoria
    await createLog({
      matchedText: msg.body,
      fromNumber: msg.from,
      toNumber: msg.to ?? null,
      inboundBody: inboundJson,
    });

    return { matched: false };
  } catch (err: any) {
    await createLog({
      inboundBody: inboundJson,
      error: String(err?.message || err),
      fromNumber: msg.from ?? null,
      toNumber: msg.to ?? null,
    });
    return { matched: false };
  }
}
