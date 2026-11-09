import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma/client.server";
import { restApi } from "~/domain/rest-api/rest-api.entity.server";
import { ymdToDateInt } from "~/domain/kds/utils/date";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json({ ok: false, error: "Método inválido." }, { status: 405 });
  const limit = restApi.rateLimitCheck(request, { bucket: "kds-open-day" });
  if (!limit.success)
    return json(
      { ok: false, error: "Aguarde um minuto para tentar novamente." },
      { status: 429 }
    );
  const auth = restApi.authorize(request.headers.get("x-api-key"));
  if (auth.status !== 200)
    return json(
      { ok: false, error: "Confira a chave da API." },
      { status: auth.status === 500 ? 500 : 401 }
    );
  let date: string;
  try {
    const body = await request.json();
    date = body.date;
    const parsed = new Date(`${date}T12:00:00.000Z`);
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date.startsWith("0000") ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      throw new Error();
  } catch {
    return json(
      { ok: false, error: "Informe uma data válida." },
      { status: 400 }
    );
  }
  const dateInt = ymdToDateInt(date);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          let header = await tx.kdsDailyOrder.findUnique({
            where: { dateInt },
          });
          if (
            header &&
            ["OPENED", "REOPENED"].includes(
              header.operationStatus?.toUpperCase() || ""
            )
          )
            return {
              status: header.operationStatus!.toUpperCase(),
              created: 0,
            };
          if (!header) {
            const goal = await tx.financialDailyGoal.findFirst({
              where: { isActive: true },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            });
            header = await tx.kdsDailyOrder.create({
              data: {
                dateInt,
                date: new Date(`${date}T12:00:00.000Z`),
                financialDailyGoalId: goal?.id ?? null,
              },
            });
          }
          const reopening = header.operationStatus?.toUpperCase() === "CLOSED";
          let created = 0;
          if (!reopening) {
            // Match Atendimento's default opening: reserve commands 1–40,
            // keeping every existing command and its data untouched.
            const existing = await tx.kdsDailyOrderDetail.findMany({
              where: { dateInt },
              select: { commandNumber: true, sortOrderIndex: true },
            });
            const commands = new Set(existing.map((row) => row.commandNumber));
            let sort =
              Math.max(0, ...existing.map((row) => row.sortOrderIndex)) + 1000;
            const rows: Prisma.KdsDailyOrderDetailCreateManyInput[] = [];
            for (let commandNumber = 1; commandNumber <= 40; commandNumber++) {
              if (commands.has(commandNumber)) continue;
              rows.push({
                orderId: header.id,
                dateInt,
                commandNumber,
                isVendaLivre: false,
                sortOrderIndex: sort,
                orderAmount: 0,
                status: "pendente",
                channel: "",
                hasMoto: false,
                motoValue: 0,
                takeAway: false,
                isCreditCard: false,
                isCash: false,
                isOtherPaymentMethod: false,
              });
              sort += 1000;
            }
            if (rows.length)
              created = (
                await tx.kdsDailyOrderDetail.createMany({ data: rows })
              ).count;
          }
          const status = reopening ? "REOPENED" : "OPENED";
          await tx.kdsDailyOrder.update({
            where: { id: header.id },
            data: {
              operationStatus: status,
              openedAt: header.openedAt ?? new Date(),
            },
          });
          return { status, created };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return json(
        { ok: true, ...result },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      ) {
        if (attempt < 2) continue;
        return json(
          {
            ok: false,
            error: "O dia foi alterado por outra operação. Consulte novamente.",
          },
          { status: 409 }
        );
      }
      console.error("[KDS] Falha ao abrir dia", error);
      return json(
        {
          ok: false,
          error:
            "Não foi possível abrir o dia. Consulte novamente antes de tentar.",
        },
        { status: 500 }
      );
    }
  }
}
