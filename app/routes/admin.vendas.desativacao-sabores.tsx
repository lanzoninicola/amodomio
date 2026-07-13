import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import {
  ChevronLeft,
  EyeOff,
  Loader2,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { getAuthenticatedSessionFromRequest } from "~/domain/auth/user-session.server";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { logCrmWhatsappSentEventByPhone } from "~/domain/crm/crm-whatsapp-events.server";
import { pickLatestActiveSheet } from "~/domain/item/item-selling-price-calculation.server";
import {
  MENU_ENGINEERING_TAG_NAMES,
  resolveMenuEngineeringTag,
} from "~/domain/menu-engineering/menu-engineering-tags";
import { normalizePhone } from "~/domain/z-api/zapi.service";
import { sendTextMessage } from "~/domain/z-api/zapi.service.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [
  { title: "Vendas | Desativacao de sabores" },
];

const PAGE_SIZE = 60;
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type OperatorContext = {
  userId: string | null;
  sessionId: string | null;
  sessionKey: string;
  label: string;
};

type FlavorRow = {
  id: string;
  name: string;
  groupName: string | null;
  channelId: string;
  channelName: string;
  channelVisible: boolean;
  menuEngineeringTagTitle: string | null;
  menuEngineeringTagColor: string | null;
  referenceVariationName: string | null;
  referencePriceAmount: number | null;
  referenceBaseCostAmount: number | null;
  referenceCostPercentage: number | null;
  referenceProfitPercentage: number | null;
};

type BatchItemRow = {
  id: string;
  itemName: string;
  channelName: string;
  tag: string | null;
  variationName: string | null;
  priceAmount: number | null;
  costPercentage: number | null;
  profitPercentage: number | null;
};

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return BRL_FORMATTER.format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(1)}%`;
}

function parsePage(raw: string | null) {
  const parsed = Number(raw || "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

async function getOperatorContext(request: Request): Promise<OperatorContext> {
  const sessionResult = await getAuthenticatedSessionFromRequest(request);

  if (sessionResult.user) {
    return {
      userId: sessionResult.user.id,
      sessionId: sessionResult.user.sessionId,
      sessionKey: sessionResult.user.sessionId,
      label:
        sessionResult.user.name ||
        sessionResult.user.username ||
        sessionResult.user.email ||
        "operador",
    };
  }

  const legacyUser = await authenticator.isAuthenticated(request);
  if (!legacyUser) throw redirect("/login");

  const userId = legacyUser.id || null;
  const fallbackKey = `legacy:${userId || legacyUser.email || legacyUser.name}`;

  return {
    userId,
    sessionId: null,
    sessionKey: fallbackKey,
    label: legacyUser.name || legacyUser.email || "operador",
  };
}

async function findOpenBatch(operator: OperatorContext) {
  return prismaClient.itemSellingVisibilityDisableBatch.findFirst({
    where: {
      status: "open",
      operatorSessionId: operator.sessionKey,
    },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function getOrCreateOpenBatch(operator: OperatorContext) {
  const current = await findOpenBatch(operator);
  if (current) return current;

  return prismaClient.itemSellingVisibilityDisableBatch.create({
    data: {
      operatorUserId: operator.userId,
      operatorSessionId: operator.sessionKey,
    },
    include: {
      items: true,
    },
  });
}

function mapFlavorRow(
  item: any,
  channel: { id: string; name: string },
  dnaPercentage: number
): FlavorRow {
  const channelLink = (item.ItemSellingChannelItem || [])[0] || null;
  const prices = item.ItemSellingPriceVariation || [];
  const referencePrice =
    prices.find((row: any) => row.ItemVariation?.isReference) ||
    prices[0] ||
    null;
  const referenceVariationId = String(
    referencePrice?.itemVariationId || referencePrice?.ItemVariation?.id || ""
  );
  const activeReferenceSheet = referenceVariationId
    ? pickLatestActiveSheet(
        (item.ItemCostSheet || []).filter(
          (sheet: any) =>
            String(sheet.itemVariationId || "") === referenceVariationId
        )
      )
    : null;
  const displayActiveSheet =
    activeReferenceSheet || item.ItemCostSheet?.[0] || null;
  const referencePriceAmount = referencePrice
    ? Number(referencePrice.priceAmount || 0)
    : null;
  const referenceBaseCostAmount = displayActiveSheet
    ? Number(displayActiveSheet.costAmount || 0)
    : null;
  const referenceCostPercentage =
    referenceBaseCostAmount != null &&
    referencePriceAmount != null &&
    referencePriceAmount > 0
      ? Number(
          ((referenceBaseCostAmount / referencePriceAmount) * 100).toFixed(1)
        )
      : null;
  const referenceDnaAmount =
    referencePriceAmount != null
      ? Number(((referencePriceAmount * dnaPercentage) / 100).toFixed(2))
      : null;
  const referenceProfitPercentage =
    referenceBaseCostAmount != null &&
    referenceDnaAmount != null &&
    referencePriceAmount != null &&
    referencePriceAmount > 0
      ? Number(
          (
            ((referencePriceAmount -
              referenceBaseCostAmount -
              referenceDnaAmount) /
              referencePriceAmount) *
            100
          ).toFixed(1)
        )
      : null;
  const menuEngineeringTag =
    (item.ItemTag || [])
      .map((row: any) =>
        resolveMenuEngineeringTag(row.Tag?.name, row.Tag?.colorHEX)
      )
      .find(Boolean) || null;

  return {
    id: String(item.id),
    name: item.name || "Item sem nome",
    groupName:
      item.ItemSellingInfo?.ItemGroup?.name ||
      item.ItemSellingInfo?.Category?.name ||
      item.Category?.name ||
      null,
    channelId: channel.id,
    channelName: channel.name,
    channelVisible: channelLink?.visible === true,
    menuEngineeringTagTitle: menuEngineeringTag?.title || null,
    menuEngineeringTagColor: menuEngineeringTag?.colorHEX || null,
    referenceVariationName:
      referencePrice?.ItemVariation?.Variation?.name || null,
    referencePriceAmount,
    referenceBaseCostAmount,
    referenceCostPercentage,
    referenceProfitPercentage,
  };
}

function buildBatchMessage(params: {
  operatorLabel: string;
  batchId: string | null;
  items: BatchItemRow[];
}) {
  const lines = params.items.map((item) => {
    const details = [
      item.tag ? `ME: ${item.tag}` : null,
      item.variationName ? `tam: ${item.variationName}` : null,
      `PV: ${formatMoney(item.priceAmount)}`,
      `ficha/venda: ${formatPercent(item.costPercentage)}`,
      `margem: ${formatPercent(item.profitPercentage)}`,
    ].filter(Boolean);

    return `- ${item.itemName} (${item.channelName}) - ${details.join(" | ")}`;
  });

  return [
    "Oi, preciso desativar estes sabores nos outros sistemas:",
    "",
    ...lines,
    "",
    `Lote: ${params.batchId || "-"}`,
    `Operador: ${params.operatorLabel}`,
  ].join("\n");
}

function mapBatchItems(items: any[]): BatchItemRow[] {
  return items.map((item) => ({
    id: String(item.id),
    itemName: item.itemNameSnapshot,
    channelName: item.channelNameSnapshot,
    tag: item.menuEngineeringTagSnapshot || null,
    variationName: item.referenceVariationNameSnapshot || null,
    priceAmount:
      item.referencePriceAmount == null
        ? null
        : Number(item.referencePriceAmount),
    costPercentage:
      item.referenceCostPercentage == null
        ? null
        : Number(item.referenceCostPercentage),
    profitPercentage:
      item.referenceProfitPercentage == null
        ? null
        : Number(item.referenceProfitPercentage),
  }));
}

async function loadItemForChannel(itemId: string, channelId: string) {
  return prismaClient.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      Category: { select: { name: true } },
      ItemSellingInfo: {
        select: {
          Category: { select: { name: true } },
          ItemGroup: { select: { name: true } },
        },
      },
      ItemTag: {
        where: {
          deletedAt: null,
          Tag: {
            name: { in: MENU_ENGINEERING_TAG_NAMES },
            deletedAt: null,
          },
        },
        select: {
          Tag: {
            select: {
              name: true,
              colorHEX: true,
            },
          },
        },
      },
      ItemCostSheet: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          itemId: true,
          itemVariationId: true,
          costAmount: true,
          updatedAt: true,
          activatedAt: true,
        },
        orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }],
      },
      ItemSellingChannelItem: {
        where: { itemSellingChannelId: channelId },
        select: {
          visible: true,
          itemSellingChannelId: true,
        },
      },
      ItemSellingPriceVariation: {
        where: { itemSellingChannelId: channelId },
        select: {
          itemVariationId: true,
          priceAmount: true,
          ItemVariation: {
            select: {
              id: true,
              isReference: true,
              Variation: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const operator = await getOperatorContext(request);
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const requestedChannel = String(url.searchParams.get("channel") || "")
    .trim()
    .toLowerCase();
  const page = parsePage(url.searchParams.get("page"));
  const activeTab =
    String(url.searchParams.get("tab") || "sabores") === "lote"
      ? "lote"
      : "sabores";

  const [channels, sellingPriceConfig, openBatch, recipients, recentBatches] =
    await Promise.all([
      prismaClient.itemSellingChannel.findMany({
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: {
          id: true,
          key: true,
          name: true,
        },
      }),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
      findOpenBatch(operator),
      prismaClient.userAccess.findMany({
        where: {
          isActive: true,
          mobilePhone: { not: null },
        },
        select: {
          id: true,
          name: true,
          username: true,
          mobilePhone: true,
        },
        orderBy: [{ name: "asc" }, { username: "asc" }],
      }),
      prismaClient.itemSellingVisibilityDisableBatch.findMany({
        where: {
          operatorSessionId: operator.sessionKey,
          status: "sent",
        },
        select: {
          id: true,
          recipientPhone: true,
          sentAt: true,
          _count: { select: { items: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 8,
      }),
    ]);

  const selectedChannel =
    channels.find(
      (channel) => String(channel.key || "").toLowerCase() === requestedChannel
    ) ||
    channels.find(
      (channel) => String(channel.key || "").toLowerCase() === "cardapio"
    ) ||
    channels[0] ||
    null;

  if (!selectedChannel) {
    return ok({
      payload: {
        activeTab,
        q,
        page,
        channels: [],
        selectedChannelKey: "",
        rows: [],
        totalItems: 0,
        totalPages: 1,
        openBatch: null,
        recipients,
        recentBatches,
        defaultMessage: "",
      },
    });
  }

  const where: any = {
    canSell: true,
    ItemSellingChannelItem: {
      some: {
        itemSellingChannelId: selectedChannel.id,
      },
    },
    ItemTag: {
      some: {
        deletedAt: null,
        Tag: {
          name: { in: MENU_ENGINEERING_TAG_NAMES },
          deletedAt: null,
        },
      },
    },
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      {
        ItemSellingInfo: {
          is: { slug: { contains: q, mode: "insensitive" } },
        },
      },
    ];
  }

  const [totalItems, items] = await Promise.all([
    prismaClient.item.count({ where }),
    prismaClient.item.findMany({
      where,
      select: {
        id: true,
        name: true,
        Category: { select: { name: true } },
        ItemSellingInfo: {
          select: {
            Category: { select: { name: true } },
            ItemGroup: { select: { name: true } },
          },
        },
        ItemTag: {
          where: {
            deletedAt: null,
            Tag: {
              name: { in: MENU_ENGINEERING_TAG_NAMES },
              deletedAt: null,
            },
          },
          select: {
            Tag: {
              select: {
                name: true,
                colorHEX: true,
              },
            },
          },
        },
        ItemCostSheet: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            itemId: true,
            itemVariationId: true,
            costAmount: true,
            updatedAt: true,
            activatedAt: true,
          },
          orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }],
        },
        ItemSellingChannelItem: {
          where: { itemSellingChannelId: selectedChannel.id },
          select: {
            visible: true,
            itemSellingChannelId: true,
            sortOrderIndex: true,
          },
        },
        ItemSellingPriceVariation: {
          where: { itemSellingChannelId: selectedChannel.id },
          select: {
            itemVariationId: true,
            priceAmount: true,
            ItemVariation: {
              select: {
                id: true,
                isReference: true,
                Variation: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const rows = items.map((item: any) =>
    mapFlavorRow(
      item,
      selectedChannel,
      Number(sellingPriceConfig.dnaPercentage || 0)
    )
  );
  const batchItems = openBatch ? mapBatchItems(openBatch.items || []) : [];

  return ok({
    payload: {
      activeTab,
      q,
      page,
      channels,
      selectedChannelKey: String(selectedChannel.key || "").toLowerCase(),
      selectedChannelName: selectedChannel.name,
      rows,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / PAGE_SIZE)),
      openBatch: openBatch
        ? {
            id: openBatch.id,
            status: openBatch.status,
            itemCount: batchItems.length,
            createdAt: openBatch.createdAt.toISOString(),
            items: batchItems,
          }
        : null,
      recipients,
      recentBatches: recentBatches.map((batch) => ({
        id: batch.id,
        recipientPhone: batch.recipientPhone,
        sentAt: batch.sentAt ? batch.sentAt.toISOString() : null,
        itemCount: batch._count.items,
      })),
      defaultMessage: buildBatchMessage({
        operatorLabel: operator.label,
        batchId: openBatch?.id || null,
        items: batchItems,
      }),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const operator = await getOperatorContext(request);
  const formData = await request.formData();
  const intent = str(formData.get("_intent"));

  try {
    if (intent === "toggle-visibility") {
      const itemId = str(formData.get("itemId"));
      const channelId = str(formData.get("channelId"));
      const nextVisible = str(formData.get("visible")) === "true";

      if (!itemId || !channelId) {
        return badRequest("Item e canal sao obrigatorios.");
      }

      const [item, channel, sellingPriceConfig] = await Promise.all([
        loadItemForChannel(itemId, channelId),
        prismaClient.itemSellingChannel.findUnique({
          where: { id: channelId },
          select: { id: true, name: true },
        }),
        menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
      ]);

      if (!item?.id || !channel?.id) {
        return badRequest("Item ou canal nao encontrado.");
      }

      const previousVisible =
        item.ItemSellingChannelItem?.[0]?.visible === true;
      const rowSnapshot = mapFlavorRow(
        item,
        channel,
        Number(sellingPriceConfig.dnaPercentage || 0)
      );

      await prismaClient.itemSellingChannelItem.update({
        where: {
          itemId_itemSellingChannelId: {
            itemId,
            itemSellingChannelId: channelId,
          },
        },
        data: {
          visible: nextVisible,
        },
      });

      const openBatch = await getOrCreateOpenBatch(operator);

      if (!nextVisible) {
        await prismaClient.itemSellingVisibilityDisableBatchItem.upsert({
          where: {
            batchId_itemId_itemSellingChannelId: {
              batchId: openBatch.id,
              itemId,
              itemSellingChannelId: channelId,
            },
          },
          create: {
            batchId: openBatch.id,
            itemId,
            itemSellingChannelId: channelId,
            previousVisible,
            nextVisible: false,
            itemNameSnapshot: rowSnapshot.name,
            channelNameSnapshot: rowSnapshot.channelName,
            menuEngineeringTagSnapshot: rowSnapshot.menuEngineeringTagTitle,
            referenceVariationNameSnapshot: rowSnapshot.referenceVariationName,
            referencePriceAmount: rowSnapshot.referencePriceAmount,
            referenceCostPercentage: rowSnapshot.referenceCostPercentage,
            referenceProfitPercentage: rowSnapshot.referenceProfitPercentage,
          },
          update: {
            previousVisible,
            nextVisible: false,
            itemNameSnapshot: rowSnapshot.name,
            channelNameSnapshot: rowSnapshot.channelName,
            menuEngineeringTagSnapshot: rowSnapshot.menuEngineeringTagTitle,
            referenceVariationNameSnapshot: rowSnapshot.referenceVariationName,
            referencePriceAmount: rowSnapshot.referencePriceAmount,
            referenceCostPercentage: rowSnapshot.referenceCostPercentage,
            referenceProfitPercentage: rowSnapshot.referenceProfitPercentage,
          },
        });

        await prismaClient.itemSellingVisibilityDisableBatch.update({
          where: { id: openBatch.id },
          data: { updatedAt: new Date() },
        });

        return ok({
          message: "Sabor ocultado e adicionado ao lote da sessao.",
          payload: { batchId: openBatch.id, visible: false },
        });
      }

      await prismaClient.itemSellingVisibilityDisableBatchItem.deleteMany({
        where: {
          batchId: openBatch.id,
          itemId,
          itemSellingChannelId: channelId,
        },
      });
      await prismaClient.itemSellingVisibilityDisableBatch.update({
        where: { id: openBatch.id },
        data: { updatedAt: new Date() },
      });

      return ok({
        message: "Sabor reativado no canal e removido do lote aberto.",
        payload: { batchId: openBatch.id, visible: true },
      });
    }

    if (intent === "send-batch") {
      const batchId = str(formData.get("batchId"));
      const recipientUserId = str(formData.get("recipientUserId"));
      const manualPhone = str(formData.get("recipientPhone"));
      const messageText = str(formData.get("messageText"));

      if (!batchId) return badRequest("Lote nao informado.");
      if (!messageText) return badRequest("Mensagem obrigatoria.");

      const batch =
        await prismaClient.itemSellingVisibilityDisableBatch.findFirst({
          where: {
            id: batchId,
            status: "open",
            operatorSessionId: operator.sessionKey,
          },
          include: { items: true },
        });

      if (!batch)
        return badRequest("Lote aberto nao encontrado para esta sessao.");
      if (!batch.items.length) return badRequest("O lote nao possui sabores.");

      const recipient = recipientUserId
        ? await prismaClient.userAccess.findUnique({
            where: { id: recipientUserId },
            select: { id: true, mobilePhone: true },
          })
        : null;
      const recipientPhone = normalizePhone(
        manualPhone || recipient?.mobilePhone || ""
      );

      if (!recipientPhone) {
        return badRequest("Informe um telefone valido para WhatsApp.");
      }

      const zapiResponse = await sendTextMessage({
        phone: recipientPhone,
        message: messageText,
      });

      await prismaClient.itemSellingVisibilityDisableBatch.update({
        where: { id: batch.id },
        data: {
          status: "sent",
          recipientUserId: recipient?.id || null,
          recipientPhone,
          messageText,
          sentAt: new Date(),
          zapiResponse: zapiResponse as any,
        },
      });

      await logCrmWhatsappSentEventByPhone({
        phone: recipientPhone,
        source: "admin.vendas.desativacao-sabores",
        messageText,
        payload: {
          batchId: batch.id,
          itemCount: batch.items.length,
          zapiResponse,
        },
      });

      return ok({
        message: "Mensagem enviada por WhatsApp e lote marcado como enviado.",
        payload: { batchId: batch.id },
      });
    }

    return badRequest("Acao invalida.");
  } catch (error) {
    return serverError(error);
  }
}

function VisibilitySwitch({ row }: { row: FlavorRow }) {
  const fetcher = useFetcher<any>();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.message) {
      toast({ title: fetcher.data.message });
    }
  }, [fetcher.data]);

  return (
    <fetcher.Form method="post" className="flex items-center gap-2">
      <input type="hidden" name="_intent" value="toggle-visibility" />
      <input type="hidden" name="itemId" value={row.id} />
      <input type="hidden" name="channelId" value={row.channelId} />
      <input
        type="hidden"
        name="visible"
        value={row.channelVisible ? "false" : "true"}
      />
      <Switch
        checked={row.channelVisible}
        disabled={busy}
        onCheckedChange={() =>
          fetcher.submit(
            {
              _intent: "toggle-visibility",
              itemId: row.id,
              channelId: row.channelId,
              visible: row.channelVisible ? "false" : "true",
            },
            { method: "post" }
          )
        }
      />
      <span className="min-w-16 text-xs text-slate-500">
        {busy ? "salvando" : row.channelVisible ? "visivel" : "oculto"}
      </span>
    </fetcher.Form>
  );
}

export default function AdminVendasDesativacaoSaboresPage() {
  const data = useLoaderData<typeof loader>() as any;
  const payload = data.payload;
  const [searchParams] = useSearchParams();
  const [messageText, setMessageText] = useState(payload.defaultMessage || "");
  const sendFetcher = useFetcher<any>();
  const activeTab = payload.activeTab as "sabores" | "lote";

  useEffect(() => {
    setMessageText(payload.defaultMessage || "");
  }, [payload.defaultMessage]);

  useEffect(() => {
    if (sendFetcher.data?.message) {
      toast({ title: sendFetcher.data.message });
    }
  }, [sendFetcher.data]);

  const tabHref = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    return (tab: "sabores" | "lote") => {
      params.set("tab", tab);
      return `/admin/vendas/desativacao-sabores?${params.toString()}`;
    };
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-5">
      <section className="space-y-5 border-b border-slate-200/80 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin/vendas/itens-vendidos"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">vendas</span>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                Desativacao de sabores
              </h1>
              <p className="text-sm text-slate-500">
                Oculte sabores nos canais de venda e envie o lote por WhatsApp.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-8 border-b border-slate-200">
            <Link
              to={tabHref("sabores")}
              className={[
                "inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition",
                activeTab === "sabores"
                  ? "border-sky-500 text-slate-950"
                  : "border-transparent text-slate-400 hover:text-slate-700",
              ].join(" ")}
            >
              <span className="size-2 rounded-full bg-sky-500" />
              Sabores
            </Link>
            <Link
              to={tabHref("lote")}
              className={[
                "inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition",
                activeTab === "lote"
                  ? "border-emerald-500 text-slate-950"
                  : "border-transparent text-slate-400 hover:text-slate-700",
              ].join(" ")}
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              Lote ({payload.openBatch?.itemCount || 0})
            </Link>
          </nav>
        </div>
      </section>

      {activeTab === "sabores" ? (
        <section className="space-y-4">
          <Form
            method="get"
            className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_auto]"
          >
            <input type="hidden" name="tab" value="sabores" />
            <div className="space-y-1.5">
              <Label htmlFor="q">Buscar sabor</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={payload.q}
                  className="pl-9"
                  placeholder="Nome ou slug"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="channel">Canal</Label>
              <select
                id="channel"
                name="channel"
                defaultValue={payload.selectedChannelKey}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                {payload.channels.map((channel: any) => (
                  <option
                    key={channel.id}
                    value={String(channel.key).toLowerCase()}
                  >
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">
                Filtrar
              </Button>
            </div>
          </Form>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Table className="min-w-[1120px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Sabor</TableHead>
                  <TableHead>Menu Engineering</TableHead>
                  <TableHead>Preco venda</TableHead>
                  <TableHead>% ficha / venda</TableHead>
                  <TableHead>Margem</TableHead>
                  <TableHead>Visualizacao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-sm text-slate-500"
                    >
                      Nenhum sabor encontrado para este canal.
                    </TableCell>
                  </TableRow>
                ) : null}
                {payload.rows.map((row: FlavorRow) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          to={`/admin/items/${row.id}/venda`}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {row.name}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {row.groupName || "Sem grupo"} · {row.channelName}
                          {row.referenceVariationName
                            ? ` · ${row.referenceVariationName}`
                            : ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.menuEngineeringTagTitle ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-slate-50"
                          style={{
                            color: row.menuEngineeringTagColor || undefined,
                          }}
                        >
                          {row.menuEngineeringTagTitle}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {formatMoney(row.referencePriceAmount)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          row.referenceCostPercentage != null &&
                          row.referenceCostPercentage >= 35
                            ? "font-semibold text-red-600"
                            : "font-semibold text-slate-900"
                        }
                      >
                        {formatPercent(row.referenceCostPercentage)}
                      </span>
                      <div className="text-xs text-slate-500">
                        ficha {formatMoney(row.referenceBaseCostAmount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          row.referenceProfitPercentage != null &&
                          row.referenceProfitPercentage < 15
                            ? "font-semibold text-amber-600"
                            : "font-semibold text-emerald-700"
                        }
                      >
                        {formatPercent(row.referenceProfitPercentage)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <VisibilitySwitch row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {payload.totalItems} sabores · pagina {payload.page} de{" "}
              {payload.totalPages}
            </span>
            <div className="flex gap-2">
              {payload.page > 1 ? (
                <Link
                  to={`?${new URLSearchParams({
                    tab: "sabores",
                    q: payload.q || "",
                    channel: payload.selectedChannelKey,
                    page: String(payload.page - 1),
                  }).toString()}`}
                >
                  <Button variant="outline" size="sm">
                    Anterior
                  </Button>
                </Link>
              ) : null}
              {payload.page < payload.totalPages ? (
                <Link
                  to={`?${new URLSearchParams({
                    tab: "sabores",
                    q: payload.q || "",
                    channel: payload.selectedChannelKey,
                    page: String(payload.page + 1),
                  }).toString()}`}
                >
                  <Button variant="outline" size="sm">
                    Proxima
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    Lote aberto da sessao
                  </h2>
                  <p className="text-sm text-slate-500">
                    {payload.openBatch
                      ? `${payload.openBatch.itemCount} sabores aguardando aviso.`
                      : "Nenhum sabor desativado nesta sessao."}
                  </p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <EyeOff size={14} />
                  {payload.openBatch?.id || "sem lote"}
                </Badge>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Sabor</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Preco</TableHead>
                    <TableHead>Ficha</TableHead>
                    <TableHead>Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!payload.openBatch?.items?.length ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-sm text-slate-500"
                      >
                        Desative um sabor na primeira aba para montar o lote.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {payload.openBatch?.items?.map((item: BatchItemRow) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {item.itemName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.tag || "Sem tag"}
                          {item.variationName ? ` · ${item.variationName}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>{item.channelName}</TableCell>
                      <TableCell>{formatMoney(item.priceAmount)}</TableCell>
                      <TableCell>
                        {formatPercent(item.costPercentage)}
                      </TableCell>
                      <TableCell>
                        {formatPercent(item.profitPercentage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <sendFetcher.Form
            method="post"
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            <input type="hidden" name="_intent" value="send-batch" />
            <input
              type="hidden"
              name="batchId"
              value={payload.openBatch?.id || ""}
            />
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <Select name="recipientUserId">
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar UserAccess" />
                </SelectTrigger>
                <SelectContent>
                  {payload.recipients.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.username} · {user.mobilePhone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipientPhone">Telefone alternativo</Label>
              <Input
                id="recipientPhone"
                name="recipientPhone"
                placeholder="5544999999999"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="messageText">Mensagem</Label>
              <Textarea
                id="messageText"
                name="messageText"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                className="min-h-[280px] font-mono text-xs"
              />
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={
                sendFetcher.state !== "idle" ||
                !payload.openBatch?.itemCount ||
                !messageText.trim()
              }
            >
              {sendFetcher.state !== "idle" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Enviar via API
            </Button>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MessageSquare size={16} />
                Lotes enviados
              </div>
              <div className="space-y-2">
                {payload.recentBatches.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum envio nesta sessao.
                  </p>
                ) : null}
                {payload.recentBatches.map((batch: any) => (
                  <div
                    key={batch.id}
                    className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    <div className="font-medium text-slate-900">
                      {batch.itemCount} sabores · {batch.recipientPhone || "-"}
                    </div>
                    <div>
                      {batch.sentAt
                        ? new Date(batch.sentAt).toLocaleString("pt-BR")
                        : "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </sendFetcher.Form>
        </section>
      )}
    </div>
  );
}
