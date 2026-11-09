import prisma from "~/lib/prisma/client.server";

export async function ensureKdsWhatsappSetting() {
  const setting = await prisma.setting.findFirst({
    where: { context: "kds", name: "cozinha-whatsapp-enabled" },
    orderBy: { createdAt: "desc" },
  });
  return (
    setting ??
    prisma.setting.create({
      data: {
        context: "kds",
        name: "cozinha-whatsapp-enabled",
        type: "boolean",
        value: "false",
        createdAt: new Date(),
      },
    })
  );
}
