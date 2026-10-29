import prisma from "~/lib/prisma/client.server";

export type OffHoursResponseType = "text" | "video" | "image";

export type OffHoursMessageInput = {
  label: string;
  responseType: OffHoursResponseType;
  message: string;
  video: string;
  videoCaption: string;
  image: string;
  imageCaption: string;
};

export function parseOffHoursResponseType(value: unknown): OffHoursResponseType {
  const raw = String(value || "").toLowerCase();
  return raw === "video" || raw === "image" ? raw : "text";
}

export async function listOffHoursMessages() {
  return prisma.offHoursMessage.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
}

export async function getActiveOffHoursMessage() {
  return prisma.offHoursMessage.findFirst({ where: { isActive: true } });
}

export async function createOffHoursMessage(input: OffHoursMessageInput) {
  return prisma.offHoursMessage.create({ data: { ...input, isActive: false } });
}

export async function updateOffHoursMessage(id: string, input: OffHoursMessageInput) {
  return prisma.offHoursMessage.update({ where: { id }, data: input });
}

export async function activateOffHoursMessage(id: string) {
  await prisma.$transaction([
    prisma.offHoursMessage.updateMany({
      where: { isActive: true, NOT: { id } },
      data: { isActive: false },
    }),
    prisma.offHoursMessage.update({ where: { id }, data: { isActive: true } }),
  ]);
}

export async function deleteOffHoursMessage(id: string) {
  await prisma.offHoursMessage.delete({ where: { id } });
}
