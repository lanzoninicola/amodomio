import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import { toast } from "~/components/ui/use-toast";
import {
  Check,
  Download,
  Eye,
  ExternalLink,
  FileImage,
  FileVideo,
  FolderOpen,
  GripVertical,
  ImagePlus,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import AssetLibraryPickerDialog from "~/domain/media/components/asset-library-picker-dialog";
import type { MediaAsset } from "~/domain/media/media.shared";
import { cn } from "~/lib/utils";
import {
  parseMenuItemAssetsApiResponse,
  type MenuItemAssetDto,
} from "../menu-item-assets.shared";

interface MenuItemAssetsFormProps {
  initialImages: MenuItemAssetDto[];
  endpoints: {
    list: string;
    order: string;
    item: (assetId: string) => string;
    primary: (assetId: string) => string;
    visibility: (assetId: string) => string;
  };
}

function sortImages(images: MenuItemAssetDto[]) {
  return [...images].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function getDownloadName(asset: MenuItemAssetDto) {
  const urlPath = asset.url.split("?")[0] || "";
  const fileName = urlPath.split("/").pop();
  if (fileName?.includes(".")) return fileName;
  return `item-galeria-${asset.id}.${asset.kind === "video" ? "mp4" : "jpg"}`;
}

async function readErrorMessage(response: Response, fallback: string) {
  const raw = await response.text().catch(() => "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
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
      return pickDetailMessage(record.details);
    };

    const detailed =
      pickDetailMessage(parsed.message) ||
      pickDetailMessage(parsed.details) ||
      pickDetailMessage(parsed.error);
    if (detailed) return detailed;

    const endpoint =
      typeof parsed.endpoint === "string" ? parsed.endpoint : null;
    const status = typeof parsed.status === "number" ? parsed.status : null;
    if (endpoint || status) {
      return `Falha no upload (${endpoint || "media-api"}, status ${
        status || "?"
      }).`;
    }
  } catch {
    // Non-JSON response
  }
  return raw.slice(0, 180) || fallback;
}

export default function MenuItemAssetsForm({
  initialImages,
  endpoints: endpointsProp,
}: MenuItemAssetsFormProps) {
  const [images, setImages] = useState<MenuItemAssetDto[]>(
    sortImages(initialImages || [])
  );
  const [uploading, setUploading] = useState(false);
  const [draggingOverDropzone, setDraggingOverDropzone] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [assetSource, setAssetSource] = useState<"computer" | "library">(
    "computer"
  );
  const [uploadKind, setUploadKind] = useState<"image" | "video">("image");
  const [linkingFromLibrary, setLinkingFromLibrary] = useState(false);
  const [visibleFromLibrary, setVisibleFromLibrary] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<MenuItemAssetDto | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const endpoints = useMemo(() => endpointsProp, [endpointsProp]);

  const primaryImage = useMemo(
    () => images.find((img) => img.isPrimary) || null,
    [images]
  );

  const galleryImages = useMemo(
    () =>
      images
        .filter((img) => !img.isPrimary)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [images]
  );

  const refreshImages = useCallback(async () => {
    const response = await fetch(endpoints.list);
    if (!response.ok) {
      throw new Error("Falha ao carregar assets");
    }

    const payload = await response.json();
    setImages(sortImages(parseMenuItemAssetsApiResponse(payload)));
  }, [endpoints.list]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      setUploading(true);
      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("visible", "true");

          const response = await fetch(endpoints.list, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const message = await readErrorMessage(
              response,
              "Falha no upload."
            );
            throw new Error(message);
          }
        }

        await refreshImages();
        toast({
          title: "Upload concluído",
          description: `${files.length} asset(s) enviado(s).`,
        });
      } catch (error) {
        toast({
          title: "Erro no upload",
          description: String(
            (error as Error)?.message || "Não foi possível enviar os assets."
          ),
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [endpoints.list, refreshImages]
  );

  const onInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []).filter((file) =>
        uploadKind === "image"
          ? file.type.startsWith("image/")
          : file.type.startsWith("video/")
      );
      await uploadFiles(files);
      event.target.value = "";
    },
    [uploadFiles, uploadKind]
  );

  const onDropFiles = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDraggingOverDropzone(false);
      const files = Array.from(event.dataTransfer.files || []).filter((file) =>
        uploadKind === "image"
          ? file.type.startsWith("image/")
          : file.type.startsWith("video/")
      );
      await uploadFiles(files);
    },
    [uploadFiles, uploadKind]
  );

  const toggleVisibility = useCallback(
    async (asset: MenuItemAssetDto) => {
      const response = await fetch(endpoints.visibility(asset.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: !asset.visible }),
      });

      if (!response.ok) {
        toast({
          title: "Erro",
          description: "Não foi possível alterar a visibilidade.",
          variant: "destructive",
        });
        return;
      }

      await refreshImages();
    },
    [endpoints, refreshImages]
  );

  const setPrimary = useCallback(
    async (imageId: string) => {
      const response = await fetch(endpoints.primary(imageId), {
        method: "PATCH",
      });

      if (!response.ok) {
        toast({
          title: "Erro",
          description: "Não foi possível definir a capa.",
          variant: "destructive",
        });
        return;
      }

      await refreshImages();
    },
    [endpoints, refreshImages]
  );

  const deleteImage = useCallback(
    async (asset: MenuItemAssetDto) => {
      const confirmed = window.confirm(
        asset.isPrimary
          ? "Excluir a capa deste item? Se existir outro asset, ele será definido como nova capa."
          : "Excluir este asset?"
      );
      if (!confirmed) return;

      const response = await fetch(endpoints.item(asset.id), {
        method: "DELETE",
      });

      if (!response.ok) {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o asset.",
          variant: "destructive",
        });
        return;
      }

      const payload = await response.json();
      setImages(sortImages(parseMenuItemAssetsApiResponse(payload)));
    },
    [endpoints]
  );

  const reorderGallery = useCallback(
    async (orderedIds: string[]) => {
      const response = await fetch(endpoints.order, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });

      if (!response.ok) {
        toast({
          title: "Erro",
          description: "Não foi possível reordenar a galeria.",
          variant: "destructive",
        });
        return;
      }

      const payload = await response.json();
      setImages(sortImages(parseMenuItemAssetsApiResponse(payload)));
    },
    [endpoints.order]
  );

  const onGalleryDrop = useCallback(
    async (targetImageId: string) => {
      if (!draggingImageId || draggingImageId === targetImageId) return;

      const currentIds = galleryImages.map((img) => img.id);
      const from = currentIds.indexOf(draggingImageId);
      const to = currentIds.indexOf(targetImageId);
      if (from < 0 || to < 0) return;

      const nextIds = [...currentIds];
      const [moved] = nextIds.splice(from, 1);
      nextIds.splice(to, 0, moved);

      setDraggingImageId(null);
      await reorderGallery(nextIds);
    },
    [draggingImageId, galleryImages, reorderGallery]
  );

  const addAssetFromLibrary = useCallback(
    async (asset: MediaAsset) => {
      try {
        setLinkingFromLibrary(true);
        const response = await fetch(endpoints.list, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: asset.url,
            kind: asset.kind === "video" ? "video" : "image",
            visible: visibleFromLibrary,
            isPrimary: false,
            mediaAssetId: asset.id,
          }),
        });

        if (!response.ok) {
          throw new Error("Falha ao vincular asset");
        }

        await refreshImages();
        toast({
          title: "Asset vinculado",
          description: "O asset do gerenciador foi vinculado ao item.",
        });
      } catch (error) {
        toast({
          title: "Erro",
          description: "Não foi possível vincular o asset selecionado.",
          variant: "destructive",
        });
      } finally {
        setLinkingFromLibrary(false);
      }
    },
    [endpoints.list, refreshImages, visibleFromLibrary]
  );

  return (
    <section className="grid gap-6 lg:grid-cols-12">
      <div className="rounded-xl border p-4 lg:col-span-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">
          Capa
        </h2>
        {primaryImage ? (
          <div className="flex items-center gap-4 lg:flex-col lg:items-start">
            <button
              type="button"
              className="group relative h-28 w-28 overflow-hidden rounded-lg border bg-black text-left"
              onClick={() => setPreviewAsset(primaryImage)}
              aria-label="Visualizar capa em tamanho maior"
            >
              {primaryImage.kind === "video" ? (
                <video
                  src={primaryImage.url}
                  className="h-full w-full object-cover"
                  preload="metadata"
                  muted
                />
              ) : (
                <img
                  src={primaryImage.url}
                  alt="Imagem de capa"
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                <Eye className="h-5 w-5" />
              </span>
            </button>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                Tipo: {primaryImage.kind === "video" ? "Vídeo" : "Capa"}
              </p>
              <p className="text-xs text-muted-foreground">
                {primaryImage.visible ? "Visível no site" : "Oculta no site"}
              </p>
              <div className="inline-flex items-center gap-1 text-xs text-green-700">
                <Check className="h-3.5 w-3.5" />
                Imagem principal
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setPreviewAsset(primaryImage)}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  Ver
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                >
                  <a
                    href={primaryImage.url}
                    download={getDownloadName(primaryImage)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Baixar
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => deleteImage(primaryImage)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma capa definida.
          </p>
        )}
      </div>

      <div className="lg:col-span-9 flex flex-col gap-4">
        <div className="rounded-xl border p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Adicionar asset
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha se o arquivo vem do computador ou do gerenciador de
                assets.
              </p>
            </div>
            <div className="inline-flex w-full items-center rounded-md border p-1 sm:w-auto">
              <Button
                type="button"
                size="sm"
                variant={assetSource === "computer" ? "default" : "ghost"}
                className="h-8 flex-1 px-2 text-xs sm:flex-none"
                onClick={() => setAssetSource("computer")}
              >
                <UploadCloud className="mr-1 h-3.5 w-3.5" />
                Computador
              </Button>
              <Button
                type="button"
                size="sm"
                variant={assetSource === "library" ? "default" : "ghost"}
                className="h-8 flex-1 px-2 text-xs sm:flex-none"
                onClick={() => setAssetSource("library")}
              >
                <FolderOpen className="mr-1 h-3.5 w-3.5" />
                Gerenciador
              </Button>
            </div>
          </div>

          {assetSource === "computer" ? (
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                draggingOverDropzone
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingOverDropzone(true);
              }}
              onDragLeave={() => setDraggingOverDropzone(false)}
              onDrop={onDropFiles}
            >
              <div className="mb-3 inline-flex items-center rounded-md border p-1 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={uploadKind === "image" ? "default" : "ghost"}
                  className="h-7 px-2"
                  onClick={() => setUploadKind("image")}
                >
                  <FileImage className="h-3.5 w-3.5 mr-1" />
                  Imagem
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={uploadKind === "video" ? "default" : "ghost"}
                  className="h-7 px-2"
                  onClick={() => setUploadKind("video")}
                >
                  <FileVideo className="h-3.5 w-3.5 mr-1" />
                  Vídeo
                </Button>
              </div>
              <UploadCloud className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Arraste{" "}
                {uploadKind === "image"
                  ? "assets de imagem"
                  : "assets de vídeo"}{" "}
                aqui ou selecione arquivos
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Upload múltiplo, somente{" "}
                {uploadKind === "image" ? "imagens" : "vídeos"}.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {uploading ? "Enviando..." : "Selecionar assets"}
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={uploadKind === "image" ? "image/*" : "video/*"}
                className="hidden"
                onChange={onInputChange}
              />
            </div>
          ) : (
            <div className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Selecionar asset do gerenciador
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A modal permite buscar imagens e vídeos cadastrados no
                    sistema e vincular ao item.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex h-10 items-center justify-center gap-2 rounded-md border px-3">
                    <span className="text-xs">Visível</span>
                    <Switch
                      checked={visibleFromLibrary}
                      onCheckedChange={(checked) =>
                        setVisibleFromLibrary(Boolean(checked))
                      }
                    />
                  </div>
                  <AssetLibraryPickerDialog
                    disabled={linkingFromLibrary}
                    onSelect={addAssetFromLibrary}
                    triggerLabel={
                      linkingFromLibrary ? "Vinculando..." : "Escolher asset"
                    }
                  />
                </div>
              </div>
              <div className="mt-3">
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                >
                  <a
                    href="/admin/assets"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Abrir página do gerenciador
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">
            Galeria
          </h2>
          {galleryImages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum asset na galeria.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {galleryImages.map((image) => (
                <div
                  key={image.id}
                  className="rounded-lg border p-3 bg-background"
                  draggable
                  onDragStart={() => setDraggingImageId(image.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onGalleryDrop(image.id)}
                >
                  <div className="relative mb-3">
                    <button
                      type="button"
                      className="group relative h-36 w-full overflow-hidden rounded-md bg-black text-left"
                      onClick={() => setPreviewAsset(image)}
                      aria-label="Visualizar asset em tamanho maior"
                    >
                      {image.kind === "video" ? (
                        <video
                          src={image.url}
                          className="h-full w-full object-cover"
                          preload="metadata"
                          muted
                        />
                      ) : (
                        <img
                          src={image.url}
                          alt={image.slot || "asset"}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                        <Eye className="h-5 w-5" />
                      </span>
                    </button>
                    <div className="absolute right-2 top-2 rounded-md bg-black/70 p-1 text-white">
                      <GripVertical className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-muted-foreground truncate">
                      Tipo: {image.kind === "video" ? "Vídeo" : "Galeria"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Visível</span>
                      <Switch
                        checked={image.visible}
                        onCheckedChange={() => toggleVisibility(image)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setPreviewAsset(image)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver
                    </Button>
                    <Button asChild variant="outline" className="text-xs">
                      <a
                        href={image.url}
                        download={getDownloadName(image)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Baixar
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setPrimary(image.id)}
                    >
                      <Star className="h-3.5 w-3.5 mr-1" />
                      Capa
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="text-xs"
                      onClick={() => deleteImage(image)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={Boolean(previewAsset)}
        onOpenChange={(open) => !open && setPreviewAsset(null)}
      >
        <DialogContent className="max-h-[92vh] max-w-[min(1100px,94vw)] overflow-hidden p-4 sm:p-5">
          <DialogHeader className="pr-8">
            <DialogTitle>
              {previewAsset?.isPrimary ? "Capa" : "Asset da galeria"}
            </DialogTitle>
            <DialogDescription>
              {previewAsset?.visible ? "Visível no site" : "Oculto no site"}
            </DialogDescription>
          </DialogHeader>
          {previewAsset ? (
            <div className="space-y-3">
              <div className="flex max-h-[68vh] items-center justify-center overflow-hidden rounded-lg border bg-black">
                {previewAsset.kind === "video" ? (
                  <video
                    src={previewAsset.url}
                    className="max-h-[68vh] w-full object-contain"
                    controls
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={previewAsset.url}
                    alt={
                      previewAsset.isPrimary
                        ? "Imagem de capa"
                        : "Imagem da galeria"
                    }
                    className="max-h-[68vh] w-full object-contain"
                  />
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button asChild variant="outline">
                  <a
                    href={previewAsset.url}
                    download={getDownloadName(previewAsset)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar arquivo
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
