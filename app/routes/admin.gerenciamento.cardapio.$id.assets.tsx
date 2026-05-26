import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import prismaClient from "~/lib/prisma/client.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request);

  const itemId = params.id;
  if (!itemId) {
    throw new Response("Nenhum item encontrado", { status: 400 });
  }

  const item = await prismaClient.menuItem.findUnique({
    where: { id: itemId },
    select: { itemId: true },
  });

  if (!item?.itemId) {
    throw new Response("Item nativo não encontrado", { status: 404 });
  }

  throw redirect(`/admin/items/${item.itemId}/venda/galeria`);
}
