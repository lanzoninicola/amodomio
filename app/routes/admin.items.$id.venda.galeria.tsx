import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import MenuItemAssetsForm from "~/domain/menu-item-assets/components/menu-item-assets-form";
import { getItemAssetsApiEndpoints } from "~/domain/menu-item-assets/menu-item-assets.shared";
import { listItemAssetsAdmin } from "~/domain/item/item-assets.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const item = await prismaClient.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!item) return badRequest("Item não encontrado");

    const assetList = await listItemAssetsAdmin(itemId);
    const assets = [
      ...(assetList.primary ? [assetList.primary] : []),
      ...assetList.gallery,
    ];

    return ok({
      item,
      assets,
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemVendaGaleriaRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const payload = (loaderData?.payload || {}) as {
    item?: {
      id: string;
      name: string;
    };
    assets?: Array<{
      id: string;
      url: string;
      kind: "image" | "video";
      slot: string | null;
      visible: boolean;
      isPrimary: boolean;
      sortOrder: number;
      createdAt: string;
    }>;
  };

  const item = payload.item || null;
  const assets = payload.assets || [];

  if (!item) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Item não encontrado</p>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <MenuItemAssetsForm
        initialImages={assets}
        endpoints={getItemAssetsApiEndpoints(item.id)}
      />
    </section>
  );
}
