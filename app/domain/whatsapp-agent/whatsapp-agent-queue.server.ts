import prisma from "~/lib/prisma/client.server";

type EnqueueWhatsappAgentMessageInput = {
  externalId: string;
  phone?: string;
  customerId?: string;
  messageText?: string;
};

export async function enqueueWhatsappAgentMessage(
  input: EnqueueWhatsappAgentMessageInput
) {
  const phone = input.phone?.trim();
  const inboundText = input.messageText?.trim();
  if (!phone) return { queued: false, reason: "missing_phone" } as const;
  if (!inboundText) return { queued: false, reason: "missing_text" } as const;

  const job = await prisma.whatsappAgentJob.upsert({
    where: { externalId: input.externalId },
    create: {
      externalId: input.externalId,
      phone,
      customerId: input.customerId,
      inboundText,
    },
    update: {},
    select: { id: true, status: true },
  });

  return { queued: true, jobId: job.id, status: job.status } as const;
}
