import { jsonStringify } from "~/utils/json-helper";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { Check, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CloudinaryUploadWidget } from "~/lib/cloudinary";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Form, useFetcher } from "@remix-run/react";
import { cn } from "~/lib/utils";

interface MenuItemGalleryImagesProps {
  item?: MenuItemWithAssociations;
  images: MenuItemWithAssociations["MenuItemGalleryImage"];
}

export default function MenuItemGalleryImagesForm({
  item,
  images,
}: MenuItemGalleryImagesProps) {
  const fetcher = useFetcher();
  const [gallery, setGallery] =
    useState<MenuItemWithAssociations["MenuItemGalleryImage"]>(images || []);
  const isSaving = fetcher.state !== "idle";

  // mantém estado local sincronizado quando voltar do servidor
  useEffect(() => {
    setGallery(images || []);
  }, [images]);

  // helpers
  const submitUpdate = (next: typeof gallery) => {
    setGallery(next);
    fetcher.submit(
      {
        _action: "menu-item-gallery-images-update",
        itemId: item?.id || "",
        itemGalleryImages: jsonStringify(next),
      },
      { method: "post" }
    );
  };

  const handleSetPrimary = (imageId: string) => {
    // otimista: marca localmente
    const next = gallery.map((g) => ({ ...g, isPrimary: g.id === imageId }));
    setGallery(next);

    fetcher.submit(
      {
        _action: "menu-item-gallery-images-set-primary",
        itemId: item?.id || "",
        imageId,
      },
      { method: "post" }
    );
  };

  const handleDelete = (imageId: string) => {
    // otimista: remove local
    const next = gallery.filter((g) => g.id !== imageId);
    setGallery(next);

    fetcher.submit(
      {
        _action: "menu-item-gallery-images-delete",
        itemId: item?.id || "",
        imageId,
      },
      { method: "post" }
    );
  };

  return (
    <>
      {/* Galeria */}
      <div className="border rounded-md p-4 md:grid grid-cols-4 md:col-span-5 flex flex-wrap items-start flex-1 gap-3 mb-4">
        {gallery?.map((img) => {
          const isPrimary = !!img.isPrimary;
          return (
            <div
              key={img.id}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg p-2 border",
                isPrimary ? "border-blue-600" : "border-transparent"
              )}
            >
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-md bg-center bg-no-repeat bg-cover"
                  style={{
                    backgroundImage: `url(${img.thumbnailUrl || img.secureUrl || ""})`,
                  }}
                  aria-label={img.displayName || img.originalFileName || "Imagem"}
                />
                {/* ícone: principal */}
                {isPrimary && (
                  <div className="absolute -top-2 -right-2 bg-blue-600 w-6 h-6 rounded-full flex items-center justify-center shadow">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground max-w-20 text-center break-words">
                {img.displayName || img.originalFileName}
              </span>

              <div className="flex flex-col gap-1">
                {/* Tornar principal */}
                {!isPrimary && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => handleSetPrimary(img.id!)}
                    title="Tornar principal"
                  >
                    <Star className="w-3.5 h-3.5 mr-1" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest">
                      Tornar principal
                    </span>
                  </Button>
                )}

                {/* Remover */}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => handleDelete(img.id!)}
                  title="Remover imagem"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    Remover
                  </span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload */}
      <div className="md:col-span-2 flex items-center">
        <ImageUploader
          disabled={!item?.id}
          onComplete={(uploaded) => {
            // adiciona ao fim e salva automaticamente
            const next = [...gallery, ...uploaded];
            submitUpdate(next);
          }}
        />
      </div>

      {/* Barra de status */}
      <div className="mt-2 text-md text-muted-foreground font-neue">
        {isSaving ? "Salvando alterações…" : "Alterações salvas"}
      </div>
    </>
  );
}

interface ImageUploaderProps {
  onComplete?: (
    images: MenuItemWithAssociations["MenuItemGalleryImage"]
  ) => void;
  disabled?: boolean;
}

/** Botão que abre o widget da Cloudinary e, ao concluir, retorna as imagens processadas */
export function ImageUploader({ onComplete, disabled }: ImageUploaderProps) {
  // @ts-ignore
  function onUpload(error, result, widget) {
    if (error) {
      widget.close({ quiet: true });
      return;
    }

    const files = result?.info?.files || [];
    const uploaded = files.map((file: any) => {
      return {
        assetId: file.uploadInfo.asset_id || null,
        secureUrl: file.uploadInfo.secure_url || null,
        assetFolder: file.uploadInfo.asset_folder || null,
        originalFileName: file.uploadInfo.original_filename || null,
        displayName: file.uploadInfo.display_name || null,
        height: file.uploadInfo.height || null,
        width: file.uploadInfo.width || null,
        thumbnailUrl: file.uploadInfo.thumbnail_url || null,
        format: file.uploadInfo.format || null,
        publicId: file.uploadInfo.public_id || null,
        // não precisa setar isPrimary aqui; o servidor já lida quando é a 1ª imagem
      } as unknown as MenuItemWithAssociations["MenuItemGalleryImage"];
    });

    onComplete?.(uploaded);
  }

  return (
    <CloudinaryUploadWidget presetName="admin-cardapio" onUpload={onUpload}>
      {
        // @ts-ignore
        ({ open }) => (
          <Button
            onClick={open}
            className="uppercase font-body tracking-wider font-semibold"
            disabled={disabled}
          >
            Upload Image
          </Button>
        )
      }
    </CloudinaryUploadWidget>
  );
}
