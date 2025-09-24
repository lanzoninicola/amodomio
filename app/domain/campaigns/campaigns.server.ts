import prismaClient from "~/lib/prisma/client.server";
import { getWppSessionName, sendMessage } from "../bot/wpp.server";

export function daysSince(date?: Date | null) {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export type Bucket = "180" | "90" | "45" | "never";

export async function listInactiveCustomers({
  bucket,
  q = "",
  page = 1,
  pageSize = 50,
}: {
  bucket: Bucket;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const and: any[] = [{ Optout: { is: null } }];

  if (bucket === "never") {
    and.push({ lastOrderAt: null });
  } else {
    const days = bucket === "180" ? 180 : bucket === "90" ? 90 : 45;
    const cutoff = new Date(Date.now() - days * 86400000);
    and.push({ OR: [{ lastOrderAt: null }, { lastOrderAt: { lte: cutoff } }] });
  }

  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q.replace(/\D/g, "") } },
      ],
    });
  }

  const where = { AND: and };

  const [total, rows] = await prismaClient.$transaction([
    prismaClient.customer.count({ where }),
    prismaClient.customer.findMany({
      where,
      orderBy: [{ lastOrderAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        lastOrderAt: true,
        Engagement: { select: { lastInboundAt: true } },
      },
    }),
  ]);

  const data = rows.map((c) => ({
    ...c,
    dias: daysSince(c.lastOrderAt),
    respondeuRecentemente: c.Engagement?.lastInboundAt
      ? daysSince(c.Engagement.lastInboundAt) ?? 9999
      : null,
  }));

  return { total, data, page, pageSize };
}

export async function sendOne({
  customerId,
  messageTemplate,
}: {
  customerId: string;
  messageTemplate: string;
}) {
  const c = await prismaClient.customer.findUnique({
    where: { id: customerId },
    include: { Optout: true },
  });
  if (!c) throw new Error("Cliente não encontrado");
  if (c.Optout) throw new Error("Número em opt-out");

  // render básico
  const body = messageTemplate
    .replaceAll("{{nome}}", c.name ?? "")
    .replaceAll("{{dias}}", String(daysSince(c.lastOrderAt) ?? "—"));

  // log pré-envio
  const log = await prismaClient.sendLog.create({
    data: { customerId: c.id, phone: c.phone, message: body, status: "queued" },
  });

  try {
    const session = getWppSessionName();
    const messageId = await sendMessage(session, c.phone, body);

    await prismaClient.$transaction([
      prismaClient.sendLog.update({
        where: { id: log.id },
        data: {
          status: "sent",
          wppMessageId: messageId ?? undefined,
          sentAt: new Date(),
        },
      }),
      prismaClient.engagement.upsert({
        where: { phone: c.phone },
        update: { lastOutboundAt: new Date() },
        create: { phone: c.phone, lastOutboundAt: new Date() },
      }),
    ]);

    return { ok: true, messageId };
  } catch (e: any) {
    await prismaClient.sendLog.update({
      where: { id: log.id },
      data: { status: "failed", error: e?.message || "send error" },
    });
    return { ok: false, error: e?.message || "send error" };
  }
}

export async function sendBulk({
  ids,
  messageTemplate,
  ratePerSecond = 3,
}: {
  ids: string[];
  messageTemplate: string;
  ratePerSecond?: number;
}) {
  const results: Array<{
    id: string;
    ok: boolean;
    error?: string;
    messageId?: string;
  }> = [];
  const session = getWppSessionName();

  // carrega os clientes (respeitando opt-out)
  const customers = await prismaClient.customer.findMany({
    where: { id: { in: ids }, Optout: { is: null } },
    select: { id: true, phone: true, name: true, lastOrderAt: true },
  });

  // fatia em janelas de "ratePerSecond" por segundo
  for (let i = 0; i < customers.length; i += ratePerSecond) {
    const batch = customers.slice(i, i + ratePerSecond);

    await Promise.all(
      batch.map(async (c) => {
        // reutiliza seu sendOne para herdar logs e engagement
        const res = await sendOne({ customerId: c.id, messageTemplate });
        results.push({ id: c.id, ...res });
      })
    );

    // aguarda 1 segundo antes do próximo lote (evita burst)
    if (i + ratePerSecond < customers.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const ok = results.filter((r) => r.ok).length;
  return { total: results.length, ok, fail: results.length - ok, results };
}
