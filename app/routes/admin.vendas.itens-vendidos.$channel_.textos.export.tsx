import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import prismaClient from "~/lib/prisma/client.server";

function normalizeChannelKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toSafeFilenameSegment(value: string | null | undefined) {
  const normalized = String(value || "canal")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "canal";
}

async function loadChannelByKey(channelKey: string) {
  const db = prismaClient as any;
  return db.itemSellingChannel.findFirst({
    where: {
      key: { equals: channelKey, mode: "insensitive" },
    },
    select: {
      id: true,
      key: true,
      name: true,
    },
  });
}

export async function loader({ params }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const requestedChannelKey = normalizeChannelKey(params.channel);
  const selectedChannel = await loadChannelByKey(requestedChannelKey);

  if (!selectedChannel) {
    const fallbackChannel = await db.itemSellingChannel.findFirst({
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      select: { key: true },
    });
    return redirect(
      `/admin/vendas/itens-vendidos/${normalizeChannelKey(
        fallbackChannel?.key || "cardapio"
      )}/textos/export`
    );
  }

  const items = await db.item.findMany({
    where: {
      ItemSellingChannelItem: {
        some: {
          itemSellingChannelId: selectedChannel.id,
        },
      },
    },
    select: {
      id: true,
      name: true,
      active: true,
      canSell: true,
      ItemSellingInfo: {
        select: {
          baseIngredients: true,
          ingredients: true,
          longDescription: true,
          notesPublic: true,
          Category: { select: { name: true } },
          ItemGroup: { select: { name: true } },
        },
      },
      ItemSellingChannelItem: {
        where: { itemSellingChannelId: selectedChannel.id },
        select: {
          visible: true,
          sortOrderIndex: true,
        },
        take: 1,
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const channel = {
    id: String(selectedChannel.id),
    key: normalizeChannelKey(selectedChannel.key),
    name: selectedChannel.name || String(selectedChannel.key).toUpperCase(),
  };
  const rows = (items || [])
    .map((item: any) => {
      const channelLink = item.ItemSellingChannelItem?.[0] || null;
      return {
        id: String(item.id),
        name: item.name || "Item sem nome",
        active: Boolean(item.active),
        canSell: Boolean(item.canSell),
        visible: channelLink?.visible === true,
        groupName: item.ItemSellingInfo?.ItemGroup?.name || null,
        categoryName: item.ItemSellingInfo?.Category?.name || null,
        baseIngredients: item.ItemSellingInfo?.baseIngredients || "",
        ingredients: item.ItemSellingInfo?.ingredients || "",
        longDescription: item.ItemSellingInfo?.longDescription || "",
        notesPublic: item.ItemSellingInfo?.notesPublic || "",
        sortOrderIndex: Number(channelLink?.sortOrderIndex || 0),
      };
    })
    .sort(
      (a: any, b: any) =>
        Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );

  const payload = {
    generatedAt: new Date().toISOString(),
    purpose:
      "Analise IA das informacoes comerciais dos sabores cadastradas em ItemSellingInfo.",
    source: {
      route: `/admin/vendas/itens-vendidos/${channel.key}/textos`,
      model: "ItemSellingInfo",
      channel,
    },
    fields: {
      baseIngredients: "ItemSellingInfo.baseIngredients - base fixa da pizza.",
      ingredients:
        "ItemSellingInfo.ingredients - ingredientes publicos do sabor.",
      longDescription:
        "ItemSellingInfo.longDescription - descricao comercial extensa.",
      notesPublic:
        "ItemSellingInfo.notesPublic - observacoes publicas para o cliente.",
    },
    items: rows.map((item: any) => ({
      id: item.id,
      name: item.name,
      status: {
        active: item.active,
        canSell: item.canSell,
        visibleInChannel: item.visible,
      },
      organization: {
        groupName: item.groupName,
        categoryName: item.categoryName,
      },
      itemSellingInfo: {
        baseIngredients: item.baseIngredients || null,
        ingredients: item.ingredients || null,
        longDescription: item.longDescription || null,
        notesPublic: item.notesPublic || null,
      },
    })),
  };
  const filename = `informacoes-comerciais-${toSafeFilenameSegment(
    channel.key
  )}-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
