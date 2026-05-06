import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Label } from "~/components/ui/label";
import { authenticator } from "~/domain/auth/google.server";
import MenuItemAssetsForm from "~/domain/menu-item-assets/components/menu-item-assets-form";
import { listMenuItemAssetsAdmin } from "~/domain/cardapio/menu-item-assets.server";
import prismaClient from "~/lib/prisma/client.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request);

  const itemId = params.id;
  if (!itemId) {
    throw new Response("Nenhum item encontrado", { status: 400 });
  }

  const item = await prismaClient.menuItem.findUnique({
    where: { id: itemId },
    select: { id: true, name: true },
  });

  if (!item) {
    throw new Response("Item não encontrado", { status: 404 });
  }

  const assets = await listMenuItemAssetsAdmin(itemId);
  return json({
    item,
    assets: [...(assets.primary ? [assets.primary] : []), ...assets.gallery],
  });
}

export default function SingleMenuItemAssetsHandlerPage() {
  const { item, assets } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-[200px]">
      <section className="flex flex-col gap-4">
        <Label htmlFor="assetFile" className="font-semibold text-sm">
          {`Assets do sabor "${item.name}"`}
        </Label>

        <MenuItemAssetsForm menuItemId={item.id} initialImages={assets} />
      </section>
    </div>
  );
}
