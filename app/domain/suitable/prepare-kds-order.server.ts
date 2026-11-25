import type { Prisma } from "@prisma/client";

type KdsRow = Prisma.KdsDailyOrderDetailGetPayload<{}>;

export class SuitableKdsConflict extends Error {}

/** Deve executar na mesma transação que preenche a comanda e confirma a inbox. */
export async function prepareSuitableKdsOrder(
  tx: Prisma.TransactionClient,
  headerId: string,
  dateInt: number,
  commandNumber: number,
  isEmpty: (row: KdsRow) => boolean
) {
  // Serializa importações do dia antes de escolher/criar uma comanda.
  await tx.$queryRaw`SELECT id FROM kds_daily_orders WHERE id = ${headerId} FOR UPDATE`;
  let target = await tx.kdsDailyOrderDetail.findFirst({
    where: { dateInt, commandNumber, deletedAt: null, isVendaLivre: false },
  });
  if (target && !isEmpty(target))
    throw new SuitableKdsConflict(`Comanda #${commandNumber} já está preenchida. Confira o pedido antes de importar.`);
  if (!target) {
    const max = await tx.kdsDailyOrderDetail.aggregate({ where: { dateInt }, _max: { sortOrderIndex: true } });
    target = await tx.kdsDailyOrderDetail.create({
      data: {
        orderId: headerId, dateInt, commandNumber,
        sortOrderIndex: (max._max.sortOrderIndex ?? 0) + 1000,
        status: "pendente", orderAmount: 0, motoValue: 0, isVendaLivre: false,
      },
    });
  }
  const header = await tx.kdsDailyOrder.findUniqueOrThrow({ where: { id: headerId } });
  const status = header.operationStatus?.toUpperCase();
  if (status !== "OPENED" && status !== "REOPENED") {
    await tx.kdsDailyOrder.update({
      where: { id: headerId },
      data: {
        operationStatus: status === "CLOSED" ? "REOPENED" : "OPENED",
        openedAt: new Date(), closedAt: null,
      },
    });
  }
  return target;
}
