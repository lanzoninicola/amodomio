import { ActionFunctionArgs } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok } from "~/utils/http-response.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const href = String(formData.get("href") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const groupTitle = String(formData.get("groupTitle") ?? "").trim();
  const pinnedRaw = String(formData.get("pinned") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();

  if (!href || !title) {
    return badRequest("Dados inválidos");
  }

  const pinned = pinnedRaw === "true" || pinnedRaw === "1" || pinnedRaw === "on";
  const now = new Date();

  if (pinned) {
    const existingPinned = await prismaClient.adminNavigationClick.findFirst({
      where: {
        href,
        pinned: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const result = existingPinned
      ? await prismaClient.adminNavigationClick.update({
          where: { id: existingPinned.id },
          data: {
            title,
            groupTitle: groupTitle || null,
            pinned: true,
            updatedAt: now,
          },
        })
      : await prismaClient.adminNavigationClick.create({
          data: {
            href,
            title,
            groupTitle: groupTitle || null,
            pinned: true,
            count: 0,
            lastClickedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });

    return ok({ href: result.href, pinned: result.pinned, requestId });
  }

  const existingUnpinned = await prismaClient.adminNavigationClick.findFirst({
    where: {
      href,
      pinned: false,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  await prismaClient.$transaction(async (tx) => {
    if (!existingUnpinned) {
      await tx.adminNavigationClick.create({
        data: {
          href,
          title,
          groupTitle: groupTitle || null,
          pinned: false,
          count: 0,
          lastClickedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    await tx.adminNavigationClick.deleteMany({
      where: {
        href,
        pinned: true,
      },
    });
  });

  return ok({ href, pinned: false, requestId });
}
