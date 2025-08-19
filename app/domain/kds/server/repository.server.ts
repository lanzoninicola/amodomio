import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
export async function ensureHeader(dateInt: number, currentDate: Date) {
  return prisma.kdsDailyOrder.upsert({
    where: { dateInt },
    update: {},
    create: { date: currentDate, dateInt, totOrdersAmount: new Prisma.Decimal(0) },
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
  return { maxCmd: agg._max.commandNumber ?? 0, maxSort: agg._max.sortOrderIndex ?? 0 };
}
export async function listByDate(dateInt: number) {
  return prisma.kdsDailyOrderDetail.findMany({
    where: { dateInt },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
  });
}
export async function getDailyAggregates(dateInt: number) {
  const agg = await prisma.kdsDailyOrderDetail.aggregate({
    where: { dateInt },
    _sum: { orderAmount: true, motoValue: true },
    _count: { _all: true },
  });
  const byChannel = await prisma.kdsDailyOrderDetail.groupBy({
    by: ["channel"],
    where: { dateInt },
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
    byChannel: byChannel.map(x => ({ k: x.channel ?? "(sem canal)", total: Number(x._sum.orderAmount ?? 0), moto: Number(x._sum.motoValue ?? 0), count: x._count._all })),
    byStatus: byStatus.map(x => ({ k: x.status ?? "(sem status)", total: Number(x._sum.orderAmount ?? 0), moto: Number(x._sum.motoValue ?? 0), count: x._count._all })),
  };
}
export async function listMotoboy(dateInt: number) {
  return prisma.kdsDailyOrderDetail.findMany({
    where: { dateInt, OR: [{ hasMoto: true }, { motoValue: { gt: 0 } }] },
    orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
    select: { id: true, commandNumber: true, isVendaLivre: true, orderAmount: true, motoValue: true, channel: true, status: true },
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
      id: true, dateInt: true, createdAt: true, commandNumber: true, status: true,
      orderAmount: true, takeAway: true, requestedForOven: true,
    },
  });
}

export async function setOrderStatus(id: string, status: string) {
  return prisma.kdsDailyOrderDetail.update({ where: { id }, data: { status } });
}
