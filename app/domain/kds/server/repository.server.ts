import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { CHANNELS } from "~/domain/kds/constants";
export async function ensureHeader(dateInt: number, currentDate: Date) {
  const activeGoal = await prisma.financialDailyGoal.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return prisma.kdsDailyOrder.upsert({
    where: { dateInt },
    update: {},
    create: {
      date: currentDate,
      dateInt,
      totOrdersAmount: new Prisma.Decimal(0),
      financialDailyGoalId: activeGoal?.id ?? null,
    },
    select: { id: true },
  });
}
export async function recalcHeaderTotal(dateInt: number) {
  const agg = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt },
    _sum: { orderAmount: true },
  });
  await prisma.kdsDailyOrder.update({
    where: { dateInt },
    data: { totOrdersAmount: agg._sum.orderAmount ?? new Prisma.Decimal(0) },
  });
}
export async function getMaxes(dateInt: number) {
  const agg = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt },
    _max: { commandNumber: true, sortOrderIndex: true },
  });
  return {
    maxCmd: agg._max.commandNumber ?? 0,
    maxSort: agg._max.sortOrderIndex ?? 0,
  };
}
export async function listByDate(dateInt: number) {
  return prisma.kdsDailyOrderDetail.findMany({
    where: { dateInt },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });
}
export async function getDailyAggregates(dateInt: number) {
  const agg = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt, status: { not: "pendente" } },
    _sum: { orderAmount: true, motoValue: true },
    _count: { _all: true },
  });
  const cardAgg = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt, status: { not: "pendente" }, isCreditCard: true },
    _sum: { orderAmount: true },
  });
  const aiqfomeChannelStr = CHANNELS[2];
  const ifoodChannelStr = CHANNELS[3];
  const marketplaceAgg = await prisma.kdsDailyOrderDetail.aggregate({
    where: {
      dateInt,
      status: { not: "pendente" },
      channel: { in: [aiqfomeChannelStr, ifoodChannelStr] },
    },
    _sum: { orderAmount: true },
  });
  const byChannel = await prisma.kdsDailyOrderDetail.groupBy({
    by: ["channel"],
    where: { dateInt, status: { not: "pendente" } },
    _sum: { orderAmount: true, motoValue: true },
    _count: { _all: true },
  });
  const byStatus = await prisma.kdsDailyOrderDetail.groupBy({
    by: ["status"],
    where: { dateInt },
    _sum: { orderAmount: true, motoValue: true },
    _count: { _all: true },
  });
  return {
    total: Number(agg._sum.orderAmount ?? 0),
    moto: Number(agg._sum.motoValue ?? 0),
    count: agg._count._all ?? 0,
    card: Number(cardAgg._sum.orderAmount ?? 0),
    marketplace: Number(marketplaceAgg._sum.orderAmount ?? 0),
    byChannel: byChannel.map((x) => ({
      k: x.channel ?? "(sem canal)",
      total: Number(x._sum.orderAmount ?? 0),
      moto: Number(x._sum.motoValue ?? 0),
      count: x._count._all,
    })),
    byStatus: byStatus.map((x) => ({
      k: x.status ?? "(sem status)",
      total: Number(x._sum.orderAmount ?? 0),
      moto: Number(x._sum.motoValue ?? 0),
      count: x._count._all,
    })),
  };
}
export async function listMotoboy(dateInt: number) {
  return prisma.kdsDailyOrderDetail.findMany({
    where: { dateInt, OR: [{ hasMoto: true }, { motoValue: { gt: 0 } }] },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      commandNumber: true,
      isVendaLivre: true,
      orderAmount: true,
      motoValue: true,
      channel: true,
      status: true,
    },
  });
}

export async function listActiveOrdersByDate(dateInt: number) {
  return prisma.kdsDailyOrderDetail.findMany({
    where: {
      dateInt,
      status: { notIn: ["finalizado", "pendente"] },
      isVendaLivre: false,
      deletedAt: null,
    },
    orderBy: [{ commandNumber: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      dateInt: true,
      createdAt: true,
      commandNumber: true,
      status: true,
      orderAmount: true,
      takeAway: true,
      requestedForOven: true,
    },
  });
}

export type KdsStatus =
  | "novoPedido"
  | "emProducao"
  | "aguardandoForno"
  | "assando"
  | "finalizado";

/**
 * Atualiza o status do pedido e ajusta os timestamps de fase.
 * Regras:
 * - `novoPedido`: zera todos os *At
 * - `emProducao`: define `emProducaoAt` (se vazio) e limpa fases posteriores
 * - `aguardandoForno`: define `aguardandoFornoAt` (se vazio) e limpa posteriores
 * - `assando`: define `assandoAt` (se vazio) e limpa `finalizadoAt`
 * - `finalizado`: define/atualiza `finalizadoAt`
 *
 * Obs.: usamos "definir se null" para manter o primeiro instante da fase.
 * Ao voltar fases, limpamos os *At das fases posteriores para manter a linha do tempo consistente.
 */
export async function setOrderStatus(id: string, next: KdsStatus) {
  const now = new Date();

  // Pega status atual para evitar writes desnecessários (opcional)
  const current = await prisma.kdsDailyOrderDetail.findUnique({
    where: { id },
    select: {
      status: true,
      emProducaoAt: true,
      aguardandoFornoAt: true,
      assandoAt: true,
      finalizadoAt: true,
    },
  });
  if (!current) return;

  const data: any = { status: next };

  switch (next) {
    case "novoPedido": {
      data.emProducaoAt = null;
      data.aguardandoFornoAt = null;
      data.assandoAt = null;
      data.finalizadoAt = null;
      break;
    }
    case "emProducao": {
      data.emProducaoAt = current.emProducaoAt ?? now;
      data.aguardandoFornoAt = null;
      data.assandoAt = null;
      data.finalizadoAt = null;
      break;
    }
    case "aguardandoForno": {
      // Mantém emProducaoAt se já existir; não força agora para não falsificar tempos
      data.aguardandoFornoAt = current.aguardandoFornoAt ?? now;
      data.assandoAt = null;
      data.finalizadoAt = null;
      break;
    }
    case "assando": {
      data.assandoAt = current.assandoAt ?? now;
      data.finalizadoAt = null;
      break;
    }
    case "finalizado": {
      data.finalizadoAt = now; // registra o momento de conclusão
      break;
    }
  }

  await prisma.kdsDailyOrderDetail.update({
    where: { id },
    data,
  });
}
