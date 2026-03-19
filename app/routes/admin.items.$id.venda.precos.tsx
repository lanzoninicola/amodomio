import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { SELLING_CHANNEL_CATALOG } from "./admin.items.$id.venda";

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const db = prismaClient as any;
    const item = await db.item.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!item) return badRequest("Item não encontrado");

    const [menuItems, allSizes] = await Promise.all([
      db.menuItem.findMany({
        where: { itemId: id, deletedAt: null },
        select: {
          id: true,
          name: true,
          active: true,
          visible: true,
          sortOrderIndex: true,
          MenuItemSellingPriceVariation: {
            select: {
              id: true,
              priceAmount: true,
              showOnCardapio: true,
              updatedAt: true,
              MenuItemSize: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                  nameShort: true,
                  nameAbbreviated: true,
                  sortOrderIndex: true,
                },
              },
              MenuItemSellingChannel: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
      db.menuItemSize.findMany({
        select: {
          id: true,
          key: true,
          name: true,
          nameShort: true,
          nameAbbreviated: true,
          sortOrderIndex: true,
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
    ]);

    const channels = SELLING_CHANNEL_CATALOG.map((channel) => ({
      key: channel.key,
      name: channel.name,
    }));

    const normalizedMenuItems = (menuItems || []).map((menuItem: any) => {
      const variationMap = new Map<string, any>(
        (allSizes || []).map((size: any) => [
          size.id,
          {
            id: size.id,
            key: size.key || null,
            name: size.nameShort || size.nameAbbreviated || size.name || "Sem variação",
            fullName: size.name || "Sem variação",
            sortOrderIndex: Number(size.sortOrderIndex || 0),
            channels: {},
          },
        ])
      );

      for (const priceVariation of menuItem.MenuItemSellingPriceVariation || []) {
        const size = priceVariation.MenuItemSize;
        if (!size?.id) continue;

        if (!variationMap.has(size.id)) {
          variationMap.set(size.id, {
            id: size.id,
            key: size.key || null,
            name: size.nameShort || size.nameAbbreviated || size.name || "Sem variação",
            fullName: size.name || "Sem variação",
            sortOrderIndex: Number(size.sortOrderIndex || 0),
            channels: {},
          });
        }

        const channelKey = String(priceVariation.MenuItemSellingChannel?.key || "").toLowerCase();
        if (!channelKey) continue;

        variationMap.get(size.id).channels[channelKey] = {
          id: priceVariation.id,
          priceAmount: Number(priceVariation.priceAmount || 0),
          showOnCardapio: Boolean(priceVariation.showOnCardapio),
          updatedAt: priceVariation.updatedAt || null,
          channelName: priceVariation.MenuItemSellingChannel?.name || null,
        };
      }

      return {
        id: menuItem.id,
        name: menuItem.name,
        active: Boolean(menuItem.active),
        visible: Boolean(menuItem.visible),
        variations: Array.from(variationMap.values()).sort(
          (a: any, b: any) => Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0)
        ),
      };
    });

    return ok({
      item,
      channels,
      menuItems: normalizedMenuItems,
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemVendaPrecosRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const payload = (loaderData?.payload || {}) as {
    channels?: Array<{ key: string; name: string }>;
    menuItems?: Array<{
      id: string;
      name: string;
      active: boolean;
      visible: boolean;
      variations: Array<{
        id: string;
        key: string | null;
        name: string;
        fullName: string;
        channels: Record<
          string,
          {
            id: string;
            priceAmount: number;
            showOnCardapio: boolean;
            updatedAt: string | null;
            channelName: string | null;
          }
        >;
      }>;
    }>;
  };

  const channels = payload.channels || [];
  const menuItems = payload.menuItems || [];

  return (
    <div className="space-y-4">
      {menuItems.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Nenhum menu item vinculado a este item para exibir preços públicos.
        </div>
      ) : (
        menuItems.map((menuItem) => (
          <section key={menuItem.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preços públicos</h2>
                <div className="mt-1 text-base font-semibold text-slate-900">{menuItem.name}</div>
                <div className="text-xs text-slate-500">{menuItem.id}</div>
              </div>
              <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className={`rounded-full px-2 py-1 ${menuItem.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {menuItem.active ? "Ativo" : "Inativo"}
                </span>
                <span className={`rounded-full px-2 py-1 ${menuItem.visible ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                  {menuItem.visible ? "Visível" : "Oculto"}
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-700">Variação</th>
                    {channels.map((channel) => (
                      <th key={channel.key} className="px-3 py-2 text-left font-semibold text-slate-700">
                        {channel.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {menuItem.variations.length === 0 ? (
                    <tr>
                      <td colSpan={channels.length + 1} className="px-3 py-4 text-slate-500">
                        Nenhuma variação com preço de venda cadastrada.
                      </td>
                    </tr>
                  ) : (
                    menuItem.variations.map((variation) => (
                      <tr key={variation.id}>
                        <td className="sticky left-0 border-t border-slate-100 bg-white px-3 py-3 align-top">
                          <div className="font-medium text-slate-900">{variation.name}</div>
                          <div className="text-xs text-slate-500">{variation.fullName}</div>
                        </td>
                        {channels.map((channel) => {
                          const priceRecord = variation.channels[channel.key];
                          const isPublic = Boolean(priceRecord?.showOnCardapio);

                          return (
                            <td key={channel.key} className="border-t border-slate-100 px-3 py-3 align-top">
                              {priceRecord ? (
                                <div className="space-y-1">
                                  <div className={`font-semibold ${isPublic ? "text-slate-900" : "text-slate-400"}`}>
                                    {formatCurrency(priceRecord.priceAmount)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {isPublic ? "Publicado" : "Nao publico"}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Sem preço</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
