import prismaClient from "~/lib/prisma/client.server";
import type { WppSessionStatus } from "./types";

export async function upsertWhatsappSession(sessionKey: string) {
  return prismaClient.whatsappSession.upsert({
    where: { sessionKey },
    create: { sessionKey },
    update: {},
  });
}

export async function setSessionQRCode(sessionKey: string, qrcode?: string) {
  return prismaClient.whatsappSession.update({
    where: { sessionKey },
    data: { qrcode: qrcode ?? null, status: qrcode ? "qrcode" : "pending" },
  });
}

export async function setSessionStatus(
  sessionKey: string,
  status: WppSessionStatus,
  isActive?: boolean
) {
  return prismaClient.whatsappSession.update({
    where: { sessionKey },
    data: {
      status,
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(status === "logout" ? { qrcode: null } : {}),
    },
  });
}

export async function getSession(sessionKey: string) {
  return prismaClient.whatsappSession.findUnique({ where: { sessionKey } });
}
