import { ActionFunctionArgs } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok } from "~/utils/http-response.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const href = String(formData.get("href") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const groupTitle = String(formData.get("groupTitle") ?? "").trim();

  if (!href || !title) {
    return badRequest("Dados inválidos");
  }

  const now = new Date();

  const existing = await prismaClient.adminNavigationClick.findFirst({
    where: {
      href,
      pinned: false,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (existing) {
    await prismaClient.adminNavigationClick.update({
      where: { id: existing.id },
      data: {
        title,
        groupTitle: groupTitle || null,
        count: { increment: 1 },
        lastClickedAt: now,
        updatedAt: now,
      },
    });
  } else {
    await prismaClient.adminNavigationClick.create({
      data: {
        href,
        title,
        groupTitle: groupTitle || null,
        count: 1,
        lastClickedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return ok({ href });
}
