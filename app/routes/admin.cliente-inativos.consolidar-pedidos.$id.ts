import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";

export async function action({ request, params }: ActionFunctionArgs) {
  console.log("action delete pedido");
  if (request.method !== "DELETE") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const id = params.id;
  if (!id)
    return json({ ok: false, error: "ID não informado" }, { status: 400 });

  try {
    await prismaClient.customerOrderItem.deleteMany({ where: { orderId: id } });
    await prismaClient.customerOrder.delete({ where: { id } });
    return json({ ok: true, id });
  } catch (err: any) {
    return json(
      { ok: false, error: err.message || "Erro ao remover pedido" },
      { status: 500 }
    );
  }
}
