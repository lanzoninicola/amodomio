import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FileImage,
  FileVideo,
  Folder,
  ImageOff,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import MediaUploadPanel from "~/domain/media/components/media-upload-panel";
import {
  type LibraryPayload,
  type MediaAsset,
  normalizePath,
  type UploadKind,
} from "~/domain/media/media.shared";

type AssetLibraryPickerDialogProps = {
  allowedKinds?: Array<Extract<UploadKind, "image" | "video">>;
  defaultUploadPath?: string;
  disabled?: boolean;
  onSelect: (asset: MediaAsset) => void | Promise<void>;
  triggerLabel?: string;
};

type LibraryResponse = {
  ok?: boolean;
  library?: LibraryPayload;
};

function getKindLabel(kind: UploadKind) {
  if (kind === "video") return "Vídeo";
  if (kind === "audio") return "Áudio";
  return "Imagem";
}

function getKindIcon(kind: UploadKind) {
  if (kind === "video") return FileVideo;
  return FileImage;
}

function getAssetSearchText(asset: MediaAsset) {
  return [
    asset.fileName,
    asset.assetPath,
    asset.assetKey,
    asset.url,
    asset.kind,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function AssetLibraryPickerDialog({
  allowedKinds = ["image", "video"],
  defaultUploadPath = "uploads",
  disabled,
  onSelect,
  triggerLabel = "Selecionar do gerenciador",
}: AssetLibraryPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"select" | "upload">("select");
  const [library, setLibrary] = useState<LibraryPayload>({
    folders: [],
    assets: [],
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "image" | "video">(
    "all"
  );
  const [uploadPath, setUploadPath] = useState(() =>
    normalizePath(defaultUploadPath)
  );
  const [folderFilter, setFolderFilter] = useState("all");
  const [selectingAssetId, setSelectingAssetId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function loadLibrary() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch("/api/media/library");
        if (!response.ok) {
          throw new Error("Falha ao carregar a biblioteca de assets.");
        }
        const payload = (await response.json()) as LibraryResponse;
        if (!payload?.ok || !payload.library) {
          throw new Error("Resposta inválida da biblioteca de assets.");
        }
        if (!cancelled) {
          setLibrary(payload.library);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            String(
              (error as Error)?.message ||
                "Não foi possível carregar a biblioteca."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const folders = useMemo(
    () =>
      library.folders
        .map((folder) => folder.path)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [library.folders]
  );

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const allowed = new Set(allowedKinds);

    return library.assets.filter((asset) => {
      if (!allowed.has(asset.kind as "image" | "video")) return false;
      if (kindFilter !== "all" && asset.kind !== kindFilter) return false;
      if (folderFilter !== "all" && asset.assetPath !== folderFilter) {
        return false;
      }
      if (
        normalizedSearch &&
        !getAssetSearchText(asset).includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
  }, [allowedKinds, folderFilter, kindFilter, library.assets, search]);

  async function selectAsset(asset: MediaAsset) {
    setSelectingAssetId(asset.id);
    try {
      await onSelect(asset);
      setOpen(false);
    } finally {
      setSelectingAssetId(null);
    }
  }

  async function deleteAsset(asset: MediaAsset) {
    const confirmed = window.confirm(
      `Remover "${asset.fileName || asset.assetKey || "asset"}" do gerenciador?`
    );
    if (!confirmed) return;

    setDeletingAssetId(asset.id);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/media/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });

      if (!response.ok) {
        throw new Error("Não foi possível remover o asset.");
      }

      const payload = (await response.json()) as LibraryResponse;
      if (!payload?.ok || !payload.library) {
        throw new Error("Resposta inválida ao remover o asset.");
      }

      setLibrary(payload.library);
    } catch (error) {
      setErrorMessage(
        String((error as Error)?.message || "Não foi possível remover o asset.")
      );
    } finally {
      setDeletingAssetId(null);
    }
  }

  function handleUploaded(payload: LibraryPayload, kind: UploadKind) {
    setLibrary(payload);
    setSearch("");
    if (kind === "image" || kind === "video") {
      setKindFilter(kind);
    }
    setFolderFilter(normalizePath(uploadPath));
    setActiveTab("select");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setActiveTab("select");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="min-h-10"
        >
          <Folder className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[min(1120px,96vw)] overflow-hidden p-3 sm:p-5">
        <DialogHeader className="pr-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle>Selecionar asset do gerenciador</DialogTitle>
              <DialogDescription className="mt-1">
                Escolha uma imagem ou vídeo já cadastrado para vincular ao
                contexto atual.
              </DialogDescription>
            </div>
            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 w-full px-2 text-xs sm:mr-2 sm:w-auto"
            >
              <a href="/admin/assets" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Abrir assets
              </a>
            </Button>
          </div>
        </DialogHeader>

        {errorMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "select" | "upload")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="select" className="flex-1 sm:flex-none">
              Selecionar asset
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 sm:flex-none">
              Carregar asset
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, pasta ou URL"
                  className="min-h-10 pl-9"
                />
              </div>
              <div className="inline-flex min-h-10 items-center rounded-md border p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={kindFilter === "all" ? "default" : "ghost"}
                  className="min-h-8 flex-1 px-2 text-xs sm:flex-none"
                  onClick={() => setKindFilter("all")}
                >
                  Todos
                </Button>
                {allowedKinds.includes("image") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={kindFilter === "image" ? "default" : "ghost"}
                    className="min-h-8 flex-1 px-2 text-xs sm:flex-none"
                    onClick={() => setKindFilter("image")}
                  >
                    <FileImage className="mr-1 h-3.5 w-3.5" />
                    Imagem
                  </Button>
                ) : null}
                {allowedKinds.includes("video") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={kindFilter === "video" ? "default" : "ghost"}
                    className="min-h-8 flex-1 px-2 text-xs sm:flex-none"
                    onClick={() => setKindFilter("video")}
                  >
                    <FileVideo className="mr-1 h-3.5 w-3.5" />
                    Vídeo
                  </Button>
                ) : null}
              </div>
              <Select value={folderFilter} onValueChange={setFolderFilter}>
                <SelectTrigger className="min-h-10">
                  <SelectValue placeholder="Pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as pastas</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder} value={folder}>
                      {folder}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[min(52dvh,540px)] pr-1">
              {loading ? (
                <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando assets...
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="flex h-52 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <ImageOff className="h-6 w-6" />
                  Nenhum asset encontrado.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {filteredAssets.map((asset) => {
                    const KindIcon = getKindIcon(asset.kind);
                    const selecting = selectingAssetId === asset.id;
                    const deleting = deletingAssetId === asset.id;
                    return (
                      <div
                        key={asset.id}
                        className={cn(
                          "group overflow-hidden rounded-md border bg-background text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
                          (selecting || deleting) &&
                            "pointer-events-none opacity-70"
                        )}
                      >
                        <div className="relative h-32 bg-black sm:h-24">
                          <button
                            type="button"
                            className="block h-full w-full text-left"
                            onClick={() => void selectAsset(asset)}
                            aria-label="Selecionar asset"
                          >
                            {asset.kind === "video" ? (
                              <video
                                src={asset.url}
                                className="h-full w-full object-cover"
                                preload="metadata"
                                muted
                              />
                            ) : (
                              <img
                                src={asset.url}
                                alt={asset.fileName || "Asset"}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            )}
                          </button>
                          <span className="absolute left-2 top-2 inline-flex items-center rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                            <KindIcon className="mr-1 h-3 w-3" />
                            {getKindLabel(asset.kind)}
                          </span>
                          <button
                            type="button"
                            className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-600 text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:h-7 sm:w-7"
                            onClick={() => void deleteAsset(asset)}
                            aria-label="Remover asset"
                            title="Remover asset"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1.5 px-2 pb-2 pt-2">
                          <p className="truncate text-xs font-medium">
                            {asset.fileName || asset.assetKey || "Asset"}
                          </p>
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge
                              variant="outline"
                              className="max-w-full truncate rounded-md px-1.5 py-0 text-[10px] font-normal"
                              title={asset.assetPath}
                            >
                              {asset.assetPath}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              className="min-h-9 flex-1 px-2 text-xs sm:min-h-7 sm:text-[11px]"
                              disabled={selecting}
                              onClick={() => void selectAsset(asset)}
                            >
                              {selecting ? "Vinculando..." : "Selecionar"}
                            </Button>
                            <Button
                              asChild
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-9 px-2 text-xs sm:min-h-7 sm:text-[11px]"
                            >
                              <a
                                href={asset.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="mr-1 h-3 w-3 shrink-0" />
                                Abrir
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upload">
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Pasta de destino
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={uploadPath}
                    onChange={(event) =>
                      setUploadPath(normalizePath(event.target.value))
                    }
                    placeholder="marketing/publicacoes"
                    className="min-h-10"
                  />
                  {folders.length ? (
                    <Select onValueChange={setUploadPath}>
                      <SelectTrigger className="min-h-10 sm:w-56">
                        <SelectValue placeholder="Usar pasta existente" />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map((folder) => (
                          <SelectItem key={folder} value={folder}>
                            {folder}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </div>

              <MediaUploadPanel
                allowedKinds={allowedKinds}
                assetPath={uploadPath}
                disabled={loading}
                onUploaded={handleUploaded}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
