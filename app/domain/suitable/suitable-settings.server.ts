import prisma from "~/lib/prisma/client.server";

const ID = "default";

export async function getSuitableSettings() {
  const row = await prisma.suitableSettings.findUnique({ where: { id: ID } });
  return {
    paused: row?.paused ?? false,
    pausedAt: row?.pausedAt?.toISOString() ?? null,
    pausedBy: row?.pausedBy ?? null,
  };
}

/** Pausa só o preenchimento no KDS; o webhook continua gravando na caixa de entrada. */
export async function setSuitablePaused(paused: boolean, by: string | null) {
  await prisma.suitableSettings.upsert({
    where: { id: ID },
    create: { id: ID, paused, pausedAt: paused ? new Date() : null, pausedBy: paused ? by : null },
    update: { paused, pausedAt: paused ? new Date() : null, pausedBy: paused ? by : null },
  });
}
