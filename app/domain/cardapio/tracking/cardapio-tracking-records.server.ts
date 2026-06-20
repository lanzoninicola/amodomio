import type { CardapioTrackingRecord } from "./cardapio-tracking-events";
import prismaClient from "~/lib/prisma/client.server";

type Period = {
  start: Date;
  end: Date;
};

export async function saveCardapioTrackingRecord({
  record,
  clientId,
  path,
}: {
  record: CardapioTrackingRecord;
  clientId: string | null;
  path: string;
}) {
  return prismaClient.cardapioInteractionEvent.create({
    data: {
      ...record,
      clientId,
      path,
    },
  });
}

export async function readCardapioTrackingCounts({
  eventNames,
  period,
  value,
}: {
  eventNames: string[];
  period: Period;
  value?: string | null;
}) {
  return prismaClient.cardapioInteractionEvent.groupBy({
    by: ["eventName", "control", "value", "placement"],
    _count: { _all: true },
    where: {
      eventName: { in: eventNames },
      ...(value ? { value } : {}),
      createdAt: { gte: period.start, lt: period.end },
    },
  });
}

export async function readCardapioTrackingVisitors({
  eventName,
  period,
  value,
  distinguishValue = false,
}: {
  eventName: string;
  period: Period;
  value?: string | null;
  distinguishValue?: boolean;
}) {
  const distinct: Array<"clientId" | "value"> = distinguishValue
    ? ["clientId", "value"]
    : ["clientId"];

  return prismaClient.cardapioInteractionEvent.findMany({
    where: {
      eventName,
      ...(value ? { value } : {}),
      clientId: { not: null },
      createdAt: { gte: period.start, lt: period.end },
    },
    select: { clientId: true, value: true },
    distinct,
  });
}

export async function readCardapioCatalogVisitors(period: Period) {
  return prismaClient.itemInterestEvent.findMany({
    where: {
      type: "view_list",
      createdAt: { gte: period.start, lt: period.end },
      clientId: { not: null },
    },
    distinct: ["clientId"],
    select: { clientId: true },
  });
}
