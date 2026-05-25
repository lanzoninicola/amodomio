import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  GripVertical,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [
  { title: "Vendas | Ordenar itens por canal" },
];

type ChannelOption = {
  id: string;
  key: string;
  name: string;
};

type SortableSellingItem = {
  id: string;
  linkId: string;
  name: string;
  active: boolean;
  canSell: boolean;
  visible: boolean;
  upcoming: boolean;
  groupName: string | null;
  categoryName: string | null;
  sortOrderIndex: number;
};

function normalizeChannelKey(value: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function compareOrderRows(a: SortableSellingItem, b: SortableSellingItem) {
  return (
    Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
    a.name.localeCompare(b.name, "pt-BR") ||
    a.id.localeCompare(b.id)
  );
}

async function invalidateIfCardapio(channelId: string) {
  const db = prismaClient as any;
  const channel = await db.itemSellingChannel.findUnique({
    where: { id: channelId },
    select: { key: true },
  });

  if (normalizeChannelKey(channel?.key) === "cardapio") {
    await invalidateCardapioIndexCache();
  }
}

async function saveChannelOrder(channelId: string, orderedItemIds: string[]) {
  const db = prismaClient as any;
  const currentRows = await db.itemSellingChannelItem.findMany({
    where: { itemSellingChannelId: channelId },
    select: {
      id: true,
      itemId: true,
      sortOrderIndex: true,
      Item: { select: { name: true } },
    },
  });

  const currentItemIds = new Set(
    currentRows.map((row: any) => String(row.itemId))
  );
  const requested = Array.from(new Set(orderedItemIds.map(String))).filter(
    (id) => currentItemIds.has(id)
  );
  const requestedSet = new Set(requested);
  const missing = currentRows
    .filter((row: any) => !requestedSet.has(String(row.itemId)))
    .sort((a: any, b: any) => {
      const aItem = {
        id: String(a.itemId),
        name: a.Item?.name || "",
        sortOrderIndex: Number(a.sortOrderIndex || 0),
      };
      const bItem = {
        id: String(b.itemId),
        name: b.Item?.name || "",
        sortOrderIndex: Number(b.sortOrderIndex || 0),
      };
      return compareOrderRows(
        aItem as SortableSellingItem,
        bItem as SortableSellingItem
      );
    })
    .map((row: any) => String(row.itemId));

  const nextOrder = [...requested, ...missing];
  const linkIdByItemId = new Map(
    currentRows.map((row: any) => [String(row.itemId), String(row.id)])
  );

  await db.$transaction(
    nextOrder.map((itemId, index) =>
      db.itemSellingChannelItem.update({
        where: { id: linkIdByItemId.get(itemId) },
        data: { sortOrderIndex: index + 1 },
      })
    )
  );

  await invalidateIfCardapio(channelId);
  return nextOrder.length;
}

async function replicateChannelOrder(
  targetChannelId: string,
  sourceChannelId: string
) {
  if (targetChannelId === sourceChannelId) return 0;
  const db = prismaClient as any;

  const [targetRows, sourceRows] = await Promise.all([
    db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: targetChannelId },
      select: {
        id: true,
        itemId: true,
        sortOrderIndex: true,
        Item: { select: { name: true } },
      },
    }),
    db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: sourceChannelId },
      select: {
        itemId: true,
        sortOrderIndex: true,
        Item: { select: { name: true } },
      },
    }),
  ]);

  const sourceIndexByItemId = new Map(
    sourceRows
      .sort(
        (a: any, b: any) =>
          Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
          String(a.Item?.name || "").localeCompare(
            String(b.Item?.name || ""),
            "pt-BR"
          )
      )
      .map((row: any, index: number) => [String(row.itemId), index + 1])
  );

  const nextRows = targetRows.sort((a: any, b: any) => {
    const aSourceIndex = sourceIndexByItemId.get(String(a.itemId));
    const bSourceIndex = sourceIndexByItemId.get(String(b.itemId));
    if (aSourceIndex && bSourceIndex) return aSourceIndex - bSourceIndex;
    if (aSourceIndex) return -1;
    if (bSourceIndex) return 1;
    return (
      Number(a.sortOrderIndex || 0) - Number(b.sortOrderIndex || 0) ||
      String(a.Item?.name || "").localeCompare(
        String(b.Item?.name || ""),
        "pt-BR"
      )
    );
  });

  await db.$transaction(
    nextRows.map((row: any, index: number) =>
      db.itemSellingChannelItem.update({
        where: { id: row.id },
        data: { sortOrderIndex: index + 1 },
      })
    )
  );

  await invalidateIfCardapio(targetChannelId);
  return nextRows.length;
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const selectedChannelKey = normalizeChannelKey(params.channel || "");

    const channels = (await db.itemSellingChannel.findMany({
      select: { id: true, key: true, name: true },
      orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    })) as ChannelOption[];

    const selectedChannel =
      channels.find(
        (channel) => normalizeChannelKey(channel.key) === selectedChannelKey
      ) || null;

    if (!selectedChannel) {
      if (channels[0]?.key) {
        return redirect(
          `/admin/vendas/itens-vendidos/${normalizeChannelKey(
            channels[0].key
          )}/ordenar`
        );
      }

      return ok({ channels: [], selectedChannel: null, items: [] });
    }

    const rows = await db.itemSellingChannelItem.findMany({
      where: { itemSellingChannelId: selectedChannel.id },
      select: {
        id: true,
        itemId: true,
        visible: true,
        sortOrderIndex: true,
        Item: {
          select: {
            id: true,
            name: true,
            active: true,
            canSell: true,
            Category: { select: { name: true } },
            ItemSellingInfo: {
              select: {
                upcoming: true,
                Category: { select: { name: true } },
                ItemGroup: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const items: SortableSellingItem[] = rows
      .map((row: any) => ({
        id: String(row.itemId),
        linkId: String(row.id),
        name: row.Item?.name || "Item sem nome",
        active: Boolean(row.Item?.active),
        canSell: Boolean(row.Item?.canSell),
        visible: row.visible === true,
        upcoming: row.Item?.ItemSellingInfo?.upcoming === true,
        groupName: row.Item?.ItemSellingInfo?.ItemGroup?.name || null,
        categoryName:
          row.Item?.ItemSellingInfo?.Category?.name ||
          row.Item?.Category?.name ||
          null,
        sortOrderIndex: Number(row.sortOrderIndex || 0),
      }))
      .sort(compareOrderRows);

    return ok({ channels, selectedChannel, items });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const actionName = String(formData.get("_action") || "").trim();
    const channelId = String(formData.get("channelId") || "").trim();

    const selectedChannel = channelId
      ? await db.itemSellingChannel.findUnique({
          where: { id: channelId },
          select: { id: true, key: true },
        })
      : null;
    if (!selectedChannel) return badRequest("Canal de venda inválido.");

    if (actionName === "save-order") {
      const orderedItemIds = String(formData.get("orderedItemIds") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const total = await saveChannelOrder(channelId, orderedItemIds);
      return ok(`Ordem salva para ${total} item(ns).`);
    }

    if (actionName === "replicate-order") {
      const sourceChannelId = String(
        formData.get("sourceChannelId") || ""
      ).trim();
      const sourceChannel = sourceChannelId
        ? await db.itemSellingChannel.findUnique({
            where: { id: sourceChannelId },
            select: { id: true },
          })
        : null;
      if (!sourceChannel)
        return badRequest("Escolha um canal de origem válido.");
      if (sourceChannelId === channelId)
        return badRequest(
          "Escolha um canal de origem diferente do canal atual."
        );

      const total = await replicateChannelOrder(channelId, sourceChannelId);
      return ok(`Ordenamento replicado para ${total} item(ns).`);
    }

    return badRequest("Ação inválida.");
  } catch (error) {
    return serverError(error);
  }
}

function SortableItemRow({
  item,
  position,
  visiblePosition,
  scopeTotal,
  onMove,
}: {
  item: SortableSellingItem;
  position: number;
  visiblePosition: number;
  scopeTotal: number;
  onMove: (itemId: string, direction: "top" | "up" | "down" | "bottom") => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[2.75rem_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-100 bg-white px-4 py-3",
        isDragging && "relative z-10 shadow-lg"
      )}
    >
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        aria-label={`Arrastar ${item.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-950">
          {item.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {item.groupName ? <span>{item.groupName}</span> : null}
          {item.categoryName ? <span>{item.categoryName}</span> : null}
          {!item.active ? (
            <Badge
              variant="outline"
              className="border-slate-200 text-slate-500"
            >
              inativo
            </Badge>
          ) : null}
          {!item.canSell ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700"
            >
              sem venda
            </Badge>
          ) : null}
          {item.upcoming ? (
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700"
            >
              em breve
            </Badge>
          ) : null}
          {!item.visible ? (
            <Badge
              variant="outline"
              className="border-slate-200 text-slate-500"
            >
              oculto
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="font-mono text-xs text-slate-400">#{position}</div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Mover para o topo"
          disabled={visiblePosition <= 1}
          onClick={() => onMove(item.id, "top")}
        >
          <ChevronsUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Subir uma posição"
          disabled={visiblePosition <= 1}
          onClick={() => onMove(item.id, "up")}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Descer uma posição"
          disabled={visiblePosition >= scopeTotal}
          onClick={() => onMove(item.id, "down")}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          title="Mover para o fim"
          disabled={visiblePosition >= scopeTotal}
          onClick={() => onMove(item.id, "bottom")}
        >
          <ChevronsDown className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

export default function AdminVendasItensVendidosOrdenarPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const payload = (loaderData?.payload || {}) as {
    channels: ChannelOption[];
    selectedChannel: ChannelOption | null;
    items: SortableSellingItem[];
  };
  const channels = payload.channels || [];
  const selectedChannel = payload.selectedChannel;
  const sourceChannels = channels.filter(
    (channel) => channel.id !== selectedChannel?.id
  );
  const [items, setItems] = useState(payload.items || []);
  const [viewMode, setViewMode] = useState<"visible" | "hidden" | "all">(
    "visible"
  );
  const [sourceChannelId, setSourceChannelId] = useState(
    sourceChannels[0]?.id || ""
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor)
  );
  const orderedIds = useMemo(
    () => items.map((item) => item.id).join(","),
    [items]
  );
  const visibleItems = useMemo(
    () => items.filter((item) => item.visible),
    [items]
  );
  const hiddenItems = useMemo(
    () => items.filter((item) => !item.visible),
    [items]
  );
  const scopedItems = useMemo(() => {
    if (viewMode === "hidden") return hiddenItems;
    if (viewMode === "all") return items;
    return visibleItems;
  }, [hiddenItems, items, viewMode, visibleItems]);
  const scopedItemIds = useMemo(
    () => scopedItems.map((item) => item.id),
    [scopedItems]
  );

  useEffect(() => {
    setItems(payload.items || []);
  }, [payload.selectedChannel?.id, payload.items]);

  useEffect(() => {
    setSourceChannelId(sourceChannels[0]?.id || "");
  }, [selectedChannel?.id]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((currentItems) => {
      return moveItemInScope(currentItems, String(active.id), String(over.id));
    });
  }

  function handleChannelChange(channelKey: string) {
    navigate(`/admin/vendas/itens-vendidos/${channelKey}/ordenar`);
  }

  function handleMoveItem(
    itemId: string,
    direction: "top" | "up" | "down" | "bottom"
  ) {
    setItems((currentItems) => {
      const scope = resolveScopeItems(currentItems, viewMode);
      const currentScopeIndex = scope.findIndex((item) => item.id === itemId);
      if (currentScopeIndex < 0) return currentItems;

      const targetScopeIndex =
        direction === "top"
          ? 0
          : direction === "bottom"
          ? scope.length - 1
          : direction === "up"
          ? currentScopeIndex - 1
          : currentScopeIndex + 1;

      const targetItem = scope[targetScopeIndex];
      if (!targetItem || targetItem.id === itemId) return currentItems;
      return moveItemInScope(currentItems, itemId, targetItem.id);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-16">
      <section className="space-y-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/admin/vendas/itens-vendidos/${
              selectedChannel?.key || "cardapio"
            }`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            voltar para itens vendidos
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedChannel?.key || ""}
              onValueChange={handleChannelChange}
            >
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.key}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Form method="post">
              <input type="hidden" name="_action" value="save-order" />
              <input
                type="hidden"
                name="channelId"
                value={selectedChannel?.id || ""}
              />
              <input type="hidden" name="orderedItemIds" value={orderedIds} />
              <Button
                type="submit"
                className="h-9 gap-2 bg-slate-900 hover:bg-slate-700"
                disabled={!selectedChannel || items.length === 0}
              >
                <Save className="h-4 w-4" />
                Salvar ordem
              </Button>
            </Form>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">
            Ordenar itens no canal
          </h1>
          <p className="text-sm text-slate-500">
            {selectedChannel
              ? `${selectedChannel.name} · ${visibleItems.length} visível(is) · ${hiddenItems.length} oculto(s)`
              : "Nenhum canal cadastrado"}
          </p>
        </div>
      </section>

      {actionData?.message ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            actionData.status >= 400
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          {actionData.message}
        </div>
      ) : null}

      <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="sourceChannelId"
          >
            Replicar ordenamento de outro canal
          </label>
          <Select value={sourceChannelId} onValueChange={setSourceChannelId}>
            <SelectTrigger id="sourceChannelId" className="h-9 bg-white">
              <SelectValue placeholder="Escolha o canal de origem" />
            </SelectTrigger>
            <SelectContent>
              {sourceChannels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Form method="post">
          <input type="hidden" name="_action" value="replicate-order" />
          <input
            type="hidden"
            name="channelId"
            value={selectedChannel?.id || ""}
          />
          <input type="hidden" name="sourceChannelId" value={sourceChannelId} />
          <Button
            type="submit"
            variant="outline"
            className="h-9 gap-2 bg-white"
            disabled={!selectedChannel || !sourceChannelId}
          >
            <Copy className="h-4 w-4" />
            Replicar
          </Button>
        </Form>
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
            <Button
              type="button"
              variant={viewMode === "visible" ? "secondary" : "ghost"}
              className="h-8 px-3 text-sm"
              onClick={() => setViewMode("visible")}
            >
              Visíveis ({visibleItems.length})
            </Button>
            <Button
              type="button"
              variant={viewMode === "hidden" ? "secondary" : "ghost"}
              className="h-8 px-3 text-sm"
              onClick={() => setViewMode("hidden")}
            >
              Ocultos ({hiddenItems.length})
            </Button>
            <Button
              type="button"
              variant={viewMode === "all" ? "secondary" : "ghost"}
              className="h-8 px-3 text-sm"
              onClick={() => setViewMode("all")}
            >
              Todos ({items.length})
            </Button>
          </div>

          <div className="text-xs text-slate-500">
            Use o arraste para ajustes curtos ou os botões de seta para
            deslocamentos longos.
          </div>
        </div>

        <SortableContext
          items={scopedItemIds}
          strategy={verticalListSortingStrategy}
        >
          <ol className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {scopedItems.map((item, index) => (
              <SortableItemRow
                key={item.id}
                item={item}
                position={items.findIndex((row) => row.id === item.id) + 1}
                visiblePosition={index + 1}
                scopeTotal={scopedItems.length}
                onMove={handleMoveItem}
              />
            ))}
            {scopedItems.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-slate-400">
                {viewMode === "hidden"
                  ? "Nenhum item oculto neste canal."
                  : viewMode === "visible"
                  ? "Nenhum item visível neste canal."
                  : "Nenhum item vinculado a este canal."}
              </li>
            ) : null}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function resolveScopeItems(
  items: SortableSellingItem[],
  viewMode: "visible" | "hidden" | "all"
) {
  if (viewMode === "hidden") return items.filter((item) => !item.visible);
  if (viewMode === "all") return items;
  return items.filter((item) => item.visible);
}

function moveItemInScope(
  items: SortableSellingItem[],
  sourceItemId: string,
  targetItemId: string
) {
  const oldIndex = items.findIndex((item) => item.id === sourceItemId);
  const newIndex = items.findIndex((item) => item.id === targetItemId);
  if (oldIndex < 0 || newIndex < 0) return items;
  return arrayMove(items, oldIndex, newIndex);
}
