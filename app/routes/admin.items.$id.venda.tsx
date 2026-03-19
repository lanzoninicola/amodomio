import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Store, Tags } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import MenuItemNavLink from "~/domain/cardapio/components/menu-item-nav-link/menu-item-nav-link";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";

type SellingChannelCatalogEntry = {
  key: string;
  name: string;
  description: string;
};

export const SELLING_CHANNEL_CATALOG: SellingChannelCatalogEntry[] = [
  { key: "cardapio", name: "CARDAPIO DIGITAL", description: "Canal direto do cardapio digital." },
  { key: "ecommerce", name: "ECOMMERCE", description: "Canal de venda online direto." },
  { key: "aiqfome", name: "AIQFOME", description: "Marketplace Aiqfome." },
  { key: "ifood", name: "IFOOD", description: "Marketplace iFood." },
];

const vendaNavigation = [
  { name: "Canais", href: "canais", icon: Store },
  { name: "Precos", href: "precos", icon: Tags },
];

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const db = prismaClient as any;
    const [item, linkedMenuItems, dbChannels] = await Promise.all([
      db.item.findUnique({
        where: { id },
        select: { id: true, name: true, canSell: true },
      }),
      db.menuItem.findMany({
        where: { itemId: id, deletedAt: null },
        select: { id: true, name: true, active: true, visible: true },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
      db.menuItemSellingChannel.findMany({
        select: {
          id: true,
          key: true,
          name: true,
          feeAmount: true,
          taxPerc: true,
          onlinePaymentTaxPerc: true,
          targetMarginPerc: true,
          isMarketplace: true,
          sortOrderIndex: true,
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
    ]);

    if (!item) return badRequest("Item não encontrado");

    const channelByKey = new Map(
      (dbChannels || []).map((channel: any) => [String(channel.key || "").toLowerCase(), channel])
    );

    const channels = SELLING_CHANNEL_CATALOG.map((catalogChannel) => {
      const dbChannel = channelByKey.get(catalogChannel.key);

      return {
        ...catalogChannel,
        id: dbChannel?.id || null,
        dbName: dbChannel?.name || null,
        feeAmount: Number(dbChannel?.feeAmount || 0),
        taxPerc: Number(dbChannel?.taxPerc || 0),
        onlinePaymentTaxPerc: Number(dbChannel?.onlinePaymentTaxPerc || 0),
        targetMarginPerc: Number(dbChannel?.targetMarginPerc || 0),
        isMarketplace: Boolean(dbChannel?.isMarketplace),
        isConfigured: Boolean(dbChannel),
      };
    });

    return ok({
      item,
      linkedMenuItems,
      channels,
    });
  } catch (error) {
    return serverError(error);
  }
}

export type AdminItemVendaOutletContext = {
  item: {
    id: string;
    name: string;
    canSell: boolean;
  };
  linkedMenuItems: Array<{
    id: string;
    name: string;
    active: boolean;
    visible: boolean;
  }>;
  channels: Array<
    SellingChannelCatalogEntry & {
      id: string | null;
      dbName: string | null;
      feeAmount: number;
      taxPerc: number;
      onlinePaymentTaxPerc: number;
      targetMarginPerc: number;
      isMarketplace: boolean;
      isConfigured: boolean;
    }
  >;
};

export default function AdminItemVendaLayout() {
  const loaderData = useLoaderData<typeof loader>();
  const location = useLocation();
  const payload = (loaderData?.payload || {}) as AdminItemVendaOutletContext;
  const activeSubtab = lastUrlSegment(location.pathname);
  const item = payload.item;
  const linkedMenuItems = payload.linkedMenuItems || [];

  if (!item) {
    return <div className="p-4 text-sm text-muted-foreground">{loaderData?.message || "Item não encontrado."}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Venda</h2>
            <p className="mt-1 text-sm text-slate-600">
              {linkedMenuItems.length} menu item(s) vinculados a este item para gestão de canais e preços públicos.
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              item.canSell ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }`}
          >
            {item.canSell ? "Pode vender" : "Venda desabilitada no item"}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {vendaNavigation.map((navItem) => {
            const Icon = navItem.icon;

            return (
              <MenuItemNavLink key={navItem.href} to={navItem.href} isActive={activeSubtab === navItem.href}>
                <span className="inline-flex items-center gap-2">
                  <Icon size={14} />
                  {navItem.name}
                </span>
              </MenuItemNavLink>
            );
          })}
        </div>

        <Separator className="my-4" />

        {!item.canSell ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este item está com a opção de venda desativada na aba Principal. Os dados abaixo ficam visíveis para consulta.
          </div>
        ) : null}
      </div>

      <Outlet context={payload} />
    </div>
  );
}
