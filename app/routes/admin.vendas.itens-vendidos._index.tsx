import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const url = new URL(request.url);
  const requestedChannel = String(url.searchParams.get("channel") || "")
    .trim()
    .toLowerCase();
  url.searchParams.delete("channel");

  if (requestedChannel) {
    const queryString = url.searchParams.toString();
    return redirect(
      `/admin/vendas/itens-vendidos/${requestedChannel}${
        queryString ? `?${queryString}` : ""
      }`
    );
  }

  const channel = await db.itemSellingChannel.findFirst({
    select: { key: true },
    orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
  });

  if (!channel?.key) {
    return redirect("/admin/vendas/itens-vendidos/cardapio");
  }

  return redirect(
    `/admin/vendas/itens-vendidos/${String(channel.key).toLowerCase()}`
  );
}
