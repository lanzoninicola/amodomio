import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";
async function buildRedirectPath(menuItemId?: string | null) {
  const resolvedMenuItemId = String(menuItemId || "").trim();
  if (!resolvedMenuItemId) return "/admin/items";

  const menuItem = await (prismaClient as any).menuItem.findUnique({
    where: { id: resolvedMenuItemId },
    select: { id: true, itemId: true },
  });

  const itemId = String(menuItem?.itemId || menuItem?.id || resolvedMenuItemId).trim();
  return `/admin/items/${itemId}/venda/precos/editar`;
}

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(await buildRedirectPath(params.id));
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const menuItemId = String(formData.get("menuItemId") || params.id || "").trim();
  return redirect(await buildRedirectPath(menuItemId));
}

export default function SingleMenuItemVendaPriceChannelLegacyRedirect() {
  return null;
}
