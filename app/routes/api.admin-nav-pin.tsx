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

  const result = await prismaClient.adminNavigationClick.upsert({
    where: { href },
    create: {
      href,
      title,
      groupTitle: groupTitle || null,
      pinned,
      count: 0,
      lastClickedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      title,
      groupTitle: groupTitle || null,
      pinned,
      updatedAt: now,
    },
  });

  return ok({ href: result.href, pinned: result.pinned, requestId });
}
