import { ChangeEvent, DragEvent, useCallback, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { toast } from "~/components/ui/use-toast";
import { Check, FileImage, FileVideo, GripVertical, ImagePlus, Star, Trash2, UploadCloud } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  getMenuItemAssetsApiEndpoints,
  parseMenuItemAssetsApiResponse,
  type MenuItemAssetDto,
} from "../menu-item-assets.shared";

interface MenuItemAssetsFormProps {
  menuItemId: string;
  initialImages: MenuItemAssetDto[];
}

function sortImages(images: MenuItemAssetDto[]) {
  return [...images].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

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

export default function MenuItemAssetsForm({
  menuItemId,
  initialImages,
}: MenuItemAssetsFormProps) {
  const [images, setImages] = useState<MenuItemAssetDto[]>(sortImages(initialImages || []));
  const [uploading, setUploading] = useState(false);
  const [draggingOverDropzone, setDraggingOverDropzone] = useState(false);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<"image" | "video">("image");
  const [linkingByUrl, setLinkingByUrl] = useState(false);
  const [urlToLink, setUrlToLink] = useState("");
  const [visibleFromUrl, setVisibleFromUrl] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const endpoints = useMemo(() => getMenuItemAssetsApiEndpoints(menuItemId), [menuItemId]);

  const primaryImage = useMemo(
    () => images.find((img) => img.isPrimary) || null,
    [images]
  );

  const galleryImages = useMemo(
    () => images.filter((img) => !img.isPrimary).sort((a, b) => a.sortOrder - b.sortOrder),
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
            const message = await readErrorMessage(response, "Falha no upload.");
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
          description: String((error as Error)?.message || "Não foi possível enviar os assets."),
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
        uploadKind === "image" ? file.type.startsWith("image/") : file.type.startsWith("video/")
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
        uploadKind === "image" ? file.type.startsWith("image/") : file.type.startsWith("video/")
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
      const confirmed = window.confirm("Excluir este asset?");
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

  const addImageByUrl = useCallback(async () => {
    const url = urlToLink.trim();
    if (!url) {
      toast({
        title: "URL obrigatória",
        description: "Informe a URL do asset para vincular.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLinkingByUrl(true);
      const response = await fetch(endpoints.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          kind: /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) ? "video" : "image",
          visible: visibleFromUrl,
          isPrimary: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao vincular URL");
      }

      setUrlToLink("");
      await refreshImages();
      toast({
        title: "Asset vinculado",
        description: "A URL foi vinculada ao item com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível vincular o asset por URL.",
        variant: "destructive",
      });
    } finally {
      setLinkingByUrl(false);
    }
  }, [endpoints.list, refreshImages, urlToLink, visibleFromUrl]);

  return (
    <section className="grid gap-6 lg:grid-cols-12">
      <div className="rounded-xl border p-4 lg:col-span-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Capa</h2>
        {primaryImage ? (
          <div className="flex items-center gap-4 lg:flex-col lg:items-start">
            {primaryImage.kind === "video" ? (
              <video
                src={primaryImage.url}
                className="h-28 w-28 rounded-lg object-cover border bg-black"
                controls
                preload="metadata"
              />
            ) : (
              <img
                src={primaryImage.url}
                alt="Imagem de capa"
                className="h-28 w-28 rounded-lg object-cover border"
              />
            )}
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
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma capa definida.</p>
        )}
      </div>

      <div className="lg:col-span-9 flex flex-col gap-4">
        <div
          className={cn(
            "rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            draggingOverDropzone ? "border-primary bg-primary/5" : "border-muted-foreground/30"
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
            Arraste {uploadKind === "image" ? "assets de imagem" : "assets de vídeo"} aqui ou selecione arquivos
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Upload múltiplo, somente {uploadKind === "image" ? "imagens" : "vídeos"}.
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

        <div className="rounded-xl border p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">
            Vincular por URL
          </h3>
          <div className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
            <Input
              placeholder="https://media....../images/menu-items/.../foto.webp"
              value={urlToLink}
              onChange={(e) => setUrlToLink(e.target.value)}
            />
            <div className="flex items-center justify-center gap-2 rounded-md border px-3">
              <span className="text-xs">Visível</span>
              <Switch
                checked={visibleFromUrl}
                onCheckedChange={(checked) => setVisibleFromUrl(Boolean(checked))}
              />
            </div>
            <Button
              type="button"
              onClick={addImageByUrl}
              disabled={linkingByUrl}
            >
              {linkingByUrl ? "Vinculando..." : "Vincular URL"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Galeria</h2>
          {galleryImages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum asset na galeria.</p>
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
                  {image.kind === "video" ? (
                    <video
                      src={image.url}
                      className="h-36 w-full rounded-md object-cover bg-black"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={image.url}
                      alt={image.slot || "asset"}
                      className="h-36 w-full rounded-md object-cover"
                    />
                  )}
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
    </section>
  );
}
