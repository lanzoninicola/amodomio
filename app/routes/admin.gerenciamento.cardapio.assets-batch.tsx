import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { useIsMobile } from "~/components/ui/use-is-mobile";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import {
  getItemAssetsApiEndpoints,
  parseMenuItemAssetsApiResponse,
  type MenuItemAssetDto,
} from "~/domain/menu-item-assets/menu-item-assets.shared";
import { cn } from "~/lib/utils";
import prismaClient from "~/lib/prisma/client.server";
import { Expand, ImageOff, Star, Trash2 } from "lucide-react";

type LoaderMenuItem = {
  id: string;
  name: string;
  active: boolean;
  visible: boolean;
  assets: MenuItemAssetDto[];
};

type PendingUpload = {
  id: string;
  file: File;
  kind: "image" | "video";
  previewUrl: string;
  isPrimary: boolean;
  saving: boolean;
};

async function readErrorMessage(response: Response, fallback: string) {
  const raw = await response.text().catch(() => "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      v2Details?: unknown;
      endpoint?: unknown;
      status?: unknown;
    };
    const pickDetailMessage = (value: unknown): string | null => {
      if (!value) return null;
      if (typeof value === "string") return value.trim() || null;
      if (typeof value !== "object") return null;
      const record = value as Record<string, unknown>;
      const direct = [record.message, record.error, record.detail].find(
        (item) => typeof item === "string" && item.trim()
      ) as string | undefined;
      if (direct) return direct.trim();
      return pickDetailMessage(record.details) || pickDetailMessage(record.v2Details) || null;
    };

    const detailed =
      pickDetailMessage(parsed.message) ||
      pickDetailMessage(parsed.details) ||
      pickDetailMessage(parsed.v2Details) ||
      pickDetailMessage(parsed.error);
    if (detailed) return detailed;

    const endpoint = typeof parsed.endpoint === "string" ? parsed.endpoint : null;
    const status = typeof parsed.status === "number" ? parsed.status : null;
    if (endpoint || status) {
      return `Falha no upload (${endpoint || "media-api"}, status ${status || "?"}).`;
    }
  } catch {
    // Non-JSON response
  }
  return raw.slice(0, 180) || fallback;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request);

  const items = await prismaClient.item.findMany({
    where: {
      active: true,
      canSell: true,
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      ItemSellingInfo: {
        select: {
          visible: true,
        },
      },
      ItemSellingChannelItem: {
        where: {
          ItemSellingChannel: {
            key: "cardapio",
          },
        },
        select: {
          visible: true,
        },
      },
      ItemGalleryImage: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          secureUrl: true,
          kind: true,
          isPrimary: true,
          visible: true,
          sortOrder: true,
          createdAt: true,
        },
      },
    },
  });

  const payload: LoaderMenuItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    active: item.active,
    visible: item.ItemSellingChannelItem.some((row) => row.visible === true),
    assets: item.ItemGalleryImage.filter((asset) => Boolean(asset.secureUrl)).map((asset) => ({
      id: asset.id,
      url: asset.secureUrl || "",
      kind: asset.kind === "video" ? "video" : "image",
      slot: asset.isPrimary ? "cover" : "gallery",
      isPrimary: asset.isPrimary,
      visible: asset.visible,
      sortOrder: asset.sortOrder,
      createdAt: asset.createdAt.toISOString(),
    })),
  }));

  return json({ items: payload });
}

export default function AdminCardapioAssetsBatchPage() {
  const isMobile = useIsMobile();
  const { items: loaderItems } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<LoaderMenuItem[]>(loaderItems || []);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    loaderItems?.[0]?.id || null
  );
  const [pendingUploadsByItem, setPendingUploadsByItem] = useState<
    Record<string, PendingUpload[]>
  >({});
  const [assetPreviewUrl, setAssetPreviewUrl] = useState<string | null>(null);
  const [assetPreviewKind, setAssetPreviewKind] = useState<"image" | "video" | null>(null);
  const [assetActionLoadingById, setAssetActionLoadingById] = useState<
    Record<string, boolean>
  >({});
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [unavailableAssetIdsByItem, setUnavailableAssetIdsByItem] = useState<
    Record<string, Record<string, true>>
  >({});

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  const updateItemAssets = (itemId: string, assets: MenuItemAssetDto[]) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, assets } : item))
    );
    setUnavailableAssetIdsByItem((current) => ({
      ...current,
      [itemId]: {},
    }));
  };

  const markAssetUnavailable = (itemId: string, assetId: string) => {
    setUnavailableAssetIdsByItem((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || {}),
        [assetId]: true,
      },
    }));
  };

  const isAssetUnavailable = (itemId: string, assetId: string) =>
    Boolean(unavailableAssetIdsByItem[itemId]?.[assetId]);

  const refreshItemAssets = async (itemId: string) => {
    const endpoints = getItemAssetsApiEndpoints(itemId);
    const response = await fetch(endpoints.list);
    if (!response.ok) throw new Error("Falha ao recarregar assets");

    const payload = await response.json();
    updateItemAssets(itemId, parseMenuItemAssetsApiResponse(payload));
  };

  const upsertPendingUploads = (itemId: string, uploads: PendingUpload[]) => {
    setPendingUploadsByItem((current) => ({
      ...current,
      [itemId]: uploads,
    }));
  };

  const onFilesSelectedForItem = (itemId: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    if (!files.length) {
      event.target.value = "";
      return;
    }

    const currentPending = pendingUploadsByItem[itemId] || [];
    const currentItem = items.find((item) => item.id === itemId) || null;
    const hasPrimary =
      Boolean(currentItem?.assets.some((asset) => asset.isPrimary)) ||
      currentPending.some((u) => u.isPrimary);

    const incoming = files.map((file, index) => {
      const kind: PendingUpload["kind"] = file.type.startsWith("video/") ? "video" : "image";
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
        isPrimary: !hasPrimary && index === 0,
        saving: false,
      };
    });

    upsertPendingUploads(itemId, [...currentPending, ...incoming]);
    event.target.value = "";
  };

  const removePending = (itemId: string, pendingId: string) => {
    const current = pendingUploadsByItem[itemId] || [];
    const target = current.find((item) => item.id === pendingId);
    if (target) URL.revokeObjectURL(target.previewUrl);
    upsertPendingUploads(
      itemId,
      current.filter((item) => item.id !== pendingId)
    );
  };

  const togglePendingPrimary = (itemId: string, pendingId: string, checked: boolean) => {
    const current = pendingUploadsByItem[itemId] || [];
    upsertPendingUploads(
      itemId,
      current.map((item) => {
        if (item.id === pendingId) return { ...item, isPrimary: checked };
        if (checked) return { ...item, isPrimary: false };
        return item;
      })
    );
  };

  const setPendingSaving = (itemId: string, pendingId: string, saving: boolean) => {
    const current = pendingUploadsByItem[itemId] || [];
    upsertPendingUploads(
      itemId,
      current.map((item) => (item.id === pendingId ? { ...item, saving } : item))
    );
  };

  const savePendingUpload = async (itemId: string, pending: PendingUpload) => {
    try {
      setPendingSaving(itemId, pending.id, true);

      const formData = new FormData();
      formData.append("file", pending.file, pending.file.name);
      formData.append("visible", "true");
      formData.append("isPrimary", pending.isPrimary ? "true" : "false");

      const endpoints = getItemAssetsApiEndpoints(itemId);
      const response = await fetch(endpoints.list, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Falha ao salvar asset.");
        throw new Error(message);
      }

      removePending(itemId, pending.id);
      await refreshItemAssets(itemId);
      toast({
        title: "Asset vinculado",
        description: `${pending.file.name} salva com sucesso.`,
      });
    } catch (error) {
      setPendingSaving(itemId, pending.id, false);
      toast({
        title: "Erro ao salvar",
        description: String((error as Error)?.message || "Não foi possível vincular este asset."),
        variant: "destructive",
      });
    }
  };

  const setAssetLoading = (assetId: string, loading: boolean) => {
    setAssetActionLoadingById((current) => ({
      ...current,
      [assetId]: loading,
    }));
  };

  const setAssetAsPrimary = async (itemId: string, assetId: string) => {
    try {
      const endpoints = getItemAssetsApiEndpoints(itemId);
      setAssetLoading(assetId, true);
      const response = await fetch(endpoints.primary(assetId), {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Falha ao definir capa");

      await refreshItemAssets(itemId);
      toast({
        title: "Capa atualizada",
        description: "Asset definido como capa com sucesso.",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível definir este asset como capa.",
        variant: "destructive",
      });
    } finally {
      setAssetLoading(assetId, false);
    }
  };

  const deleteCurrentAsset = async (itemId: string, assetId: string) => {
    try {
      const endpoints = getItemAssetsApiEndpoints(itemId);
      setAssetLoading(assetId, true);
      const response = await fetch(endpoints.item(assetId), {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Falha ao eliminar asset");

      await refreshItemAssets(itemId);
      toast({
        title: "Asset eliminado",
        description: "O asset foi removido do item.",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível eliminar este asset.",
        variant: "destructive",
      });
    } finally {
      setAssetLoading(assetId, false);
    }
  };

  const openItemEditor = (itemId: string) => {
    setSelectedItemId(itemId);
    if (isMobile) {
      setMobileEditorOpen(true);
    }
  };

  const renderEditorContent = (item: LoaderMenuItem) => {
    const itemPendingUploads = pendingUploadsByItem[item.id] || [];
    const itemPrimaryAsset = item.assets.find((asset) => asset.isPrimary) || null;
    const itemGalleryAssets = item.assets
      .filter((asset) => !asset.isPrimary)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">{item.name}</h2>
            <p className="text-xs text-muted-foreground">
              Faça upload e salve cada linha para agilizar o processo.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <Input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => onFilesSelectedForItem(item.id, event)}
              className="hidden"
            />
            <span className="rounded-md border border-black bg-black px-3 py-2 text-xs font-medium text-white hover:bg-black/90">
              Adicionar assets
            </span>
          </label>
        </div>

        <div className="space-y-3">
          {item.assets.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <ImageOff className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Nenhum asset vinculado</p>
                <p className="text-xs text-muted-foreground">
                  Adicione assets acima para criar capa e galeria deste sabor.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Capa
                </p>
                {itemPrimaryAsset ? (
                  <div>
                    <button
                      type="button"
                      className="group relative w-full"
                      onClick={() => {
                        setAssetPreviewUrl(itemPrimaryAsset.url);
                        setAssetPreviewKind(itemPrimaryAsset.kind);
                      }}
                    >
                      {itemPrimaryAsset.kind === "video" ? (
                        <video
                          src={itemPrimaryAsset.url}
                          className="h-28 w-full rounded object-cover bg-black"
                          controls
                          preload="metadata"
                        />
                      ) : isAssetUnavailable(item.id, itemPrimaryAsset.id) ? (
                        <div className="flex h-28 w-full items-center justify-center rounded border border-dashed bg-muted/20 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <ImageOff className="h-3.5 w-3.5" />
                            <span>Imagem indisponível</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={itemPrimaryAsset.url}
                          alt={`${item.name} capa`}
                          className="h-28 w-full rounded object-cover"
                          onError={() => markAssetUnavailable(item.id, itemPrimaryAsset.id)}
                        />
                      )}
                      <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[11px] text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <Expand className="h-3.5 w-3.5" />
                        Ampliar
                      </div>
                    </button>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" disabled>
                        <Star className="mr-1 h-3.5 w-3.5" />
                        Capa atual
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={Boolean(assetActionLoadingById[itemPrimaryAsset.id])}
                        onClick={() => deleteCurrentAsset(item.id, itemPrimaryAsset.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[86px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                    Sem capa definida
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Galeria
                </p>
                {itemGalleryAssets.length === 0 ? (
                  <div className="flex min-h-[86px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                    Nenhum asset na galeria
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {itemGalleryAssets.map((asset) => (
                      <div key={asset.id}>
                        <button
                          type="button"
                          className="group relative w-full"
                          onClick={() => {
                            setAssetPreviewUrl(asset.url);
                            setAssetPreviewKind(asset.kind);
                          }}
                        >
                          {asset.kind === "video" ? (
                            <video
                              src={asset.url}
                              className="h-20 w-full rounded object-cover bg-black"
                              controls
                              preload="metadata"
                            />
                          ) : isAssetUnavailable(item.id, asset.id) ? (
                            <div className="flex h-20 w-full items-center justify-center rounded border border-dashed bg-muted/20 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <ImageOff className="h-3.5 w-3.5" />
                                <span>Imagem indisponível</span>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={asset.url}
                              alt={`${item.name} galeria`}
                              className="h-20 w-full rounded object-cover"
                              onError={() => markAssetUnavailable(item.id, asset.id)}
                            />
                          )}
                          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[11px] text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <Expand className="h-3.5 w-3.5" />
                            Ampliar
                          </div>
                        </button>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={Boolean(assetActionLoadingById[asset.id])}
                            onClick={() => setAssetAsPrimary(item.id, asset.id)}
                          >
                            <Star className="mr-1 h-3.5 w-3.5" />
                            Capa
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={Boolean(assetActionLoadingById[asset.id])}
                            onClick={() => deleteCurrentAsset(item.id, asset.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider">
            Pendentes para salvar
          </p>
          {itemPendingUploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adicione assets para iniciar o vínculo em lote.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {itemPendingUploads.map((pending) => (
                <div key={pending.id} className="rounded-md border p-2">
                  <div className="flex flex-wrap items-start gap-2">
                    {pending.kind === "video" ? (
                      <video
                        src={pending.previewUrl}
                        className="h-16 w-20 rounded object-cover bg-black"
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={pending.previewUrl}
                        alt={pending.file.name}
                        className="h-16 w-20 rounded object-cover"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{pending.file.name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Checkbox
                          id={`primary-${item.id}-${pending.id}`}
                          checked={pending.isPrimary}
                          onCheckedChange={(checked) =>
                            togglePendingPrimary(item.id, pending.id, Boolean(checked))
                          }
                        />
                        <label
                          htmlFor={`primary-${item.id}-${pending.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Definir capa
                        </label>
                      </div>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending.saving}
                        onClick={() => savePendingUpload(item.id, pending)}
                      >
                        {pending.saving ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending.saving}
                        onClick={() => removePending(item.id, pending.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <section className="xl:col-span-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold uppercase tracking-wider">
            Sabores
          </h1>
          <span className="text-xs text-muted-foreground">
            {filteredItems.length} itens
          </span>
        </div>
        <Input
          placeholder="Buscar sabor..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-3"
        />
        <ScrollArea className={cn("pr-3", isMobile ? "h-[72dvh]" : "h-[65vh]")}>
          <div className="flex flex-col gap-2">
            {filteredItems.map((item) => {
              const total = item.assets.length;
              const hasPrimaryAvailable = item.assets.some(
                (asset) => asset.isPrimary && !isAssetUnavailable(item.id, asset.id)
              );
              const hasPrimaryUnavailable = item.assets.some(
                (asset) => asset.isPrimary && isAssetUnavailable(item.id, asset.id)
              );
              const isActive = item.id === selectedItemId;
              const pendingCount = (pendingUploadsByItem[item.id] || []).length;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItemEditor(item.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{item.name}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          item.visible
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                            : "border-amber-200 bg-amber-100 text-amber-700"
                        )}
                      >
                        {item.visible ? "Visível" : "Pausado"}
                      </span>
                      <span className="text-xs text-muted-foreground">{total}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasPrimaryAvailable
                      ? "Capa definida"
                      : hasPrimaryUnavailable
                        ? "Capa indisponível"
                        : "Sem capa"}
                  </p>
                  {pendingCount > 0 ? (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      {pendingCount} pendente(s) para salvar
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </section>

      {!isMobile ? (
        <section className="rounded-xl border p-4 xl:col-span-8">
          {selectedItem ? (
            renderEditorContent(selectedItem)
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione um sabor para começar o vínculo de assets.
            </p>
          )}
        </section>
      ) : null}

      <Dialog
        open={isMobile && mobileEditorOpen && Boolean(selectedItem)}
        onOpenChange={(open) => setMobileEditorOpen(open)}
      >
        <DialogContent className="h-[100dvh] w-screen max-w-none rounded-none p-0 sm:h-auto sm:max-w-5xl sm:rounded-xl sm:p-4">
          {selectedItem ? (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="border-b px-4 py-3 pr-10">
                <DialogTitle className="text-sm">Batch mobile</DialogTitle>
                <DialogDescription className="text-xs">
                  Fluxo otimizado para tela pequena: upload, capa, galeria e pendentes.
                </DialogDescription>
              </div>
              <ScrollArea className="flex-1 px-3 py-3 sm:px-0 sm:py-0">
                {renderEditorContent(selectedItem)}
              </ScrollArea>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(assetPreviewUrl)}
        onOpenChange={(open) => {
          if (open) return;
          setAssetPreviewUrl(null);
          setAssetPreviewKind(null);
        }}
      >
        <DialogContent className="max-w-4xl p-3 sm:p-4">
          <DialogTitle className="text-sm">Pré-visualização</DialogTitle>
          <DialogDescription className="text-xs">
            Visualização completa do asset selecionado.
          </DialogDescription>
          {assetPreviewUrl ? (
            assetPreviewKind === "video" ? (
              <video
                src={assetPreviewUrl}
                className="max-h-[78vh] w-full rounded object-contain bg-black"
                controls
                preload="metadata"
              />
            ) : (
              <img
                src={assetPreviewUrl}
                alt="Preview do asset"
                className="max-h-[78vh] w-full rounded object-contain"
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
