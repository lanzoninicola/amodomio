import { jsonStringify } from "~/utils/json-helper";
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { CloudinaryUploadWidget } from "~/lib/cloudinary";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Form } from "@remix-run/react";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { cn } from "~/lib/utils";
import { image } from "@cloudinary/url-gen/qualifiers/source";

interface MenuItemGalleryImagesProps {
  item?: MenuItemWithAssociations;
  /** array of images */
  images: MenuItemWithAssociations["MenuItemGalleryImage"];
}

export default function MenuItemGalleryImagesForm({ item, images }: MenuItemGalleryImagesProps) {
  const [imagesUploaded, setImagesUploaded] = useState<MenuItemWithAssociations["MenuItemGalleryImage"]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);




  return (
    <>

      <div className="flex flex-col gap-4 w-full border py-2 px-4 rounded-lg
      md:grid md:grid-cols-8 md:gap-y-0 md:gap-x-4">

        <div className="md:col-span-5  flex items-start gap-2">
          {
            images.map((image, index) => {
              return (
                <div key={image.id} className="flex flex-col items-center justify-center gap-1">

                  <div className="flex flex-col gap-x-4 justify-center items-center relative">

                    <div className="w-16 h-16 bg-muted rounded-lg bg-center bg-no-repeat bg-cover"
                      style={{ backgroundImage: `url(${image.thumbnailUrl || ""})` }}></div>
                    <span className="text-[10px] text-muted-foreground">
                      {image.displayName || image.originalFileName}
                    </span>
                    {
                      image.isPrimary && (

                        <div className="absolute top-1 right-1 bg-black w-5 h-5 p-[.15rem] rounded-full flex items-center justify-center cursor-pointer">
                          <Check color="white" />
                        </div>

                      )
                    }
                    <Form method="post">
                      <input type="hidden" name="imageId" value={image.id} />
                      <input type="hidden" name="itemId" value={item?.id} />
                      <button
                        type="submit"
                        name="_action"
                        value="menu-item-gallery-images-delete"
                        className="absolute top-1 left-1 bg-red-500 w-4 h-4 p-[.15rem] rounded-full flex items-center justify-center cursor-pointer"
                        title="Remover Imagem">
                        <span className="text-white text-[11px] font-semibold">X</span>
                      </button>
                    </Form>

                  </div>
                  <Form method="post">
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="itemId" value={item?.id} />
                    <button
                      type="submit"
                      name="_action"
                      value="menu-item-gallery-images-set-primary"
                      className={
                        cn(
                          "bg-blue-500 rounded-md px-2 py-1 flex items-center justify-center cursor-pointer",
                          image.isPrimary ? "bg-blue-600 cursor-not-allowed" : "",
                          "hover:bg-blue-600 transition-colors duration-200",
                          image.isPrimary ? "hidden" : "block"
                        )
                      }
                      title="Definir como Imagem Principal">
                      <p className="text-white text-[10px] font-semibold leading-none uppercase tracking-widest">
                        principal
                      </p>
                    </button>
                  </Form>
                </div>
              )
            }
            )
          }
        </div>
        <Separator orientation="vertical" className="hidden md:h-12 md:block md:col-span-1" />
        <div className="md:col-span-2 flex gap-4 items-center">
          <ImageUploader
            setImagesUploaded={setImagesUploaded}
            setUploadError={setUploadError}

          />
        </div>
      </div>


      <Form method="post" className="flex flex-col gap-2 w-full">
        <input type="hidden" name="itemId" value={item?.id} />
        <input type="hidden" id="itemGalleryImages" name="itemGalleryImages" defaultValue={jsonStringify(
          [
            ...images,
            ...imagesUploaded,
          ]
        )} />
        <div className="flex flex-col w-full">
          {uploadError && (
            <div className="text-red-500 text-sm mt-2">
              Erro ao fazer upload da imagem: {uploadError}
            </div>
          )}
          {
            imagesUploaded && imagesUploaded.length > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                {imagesUploaded.length} imagem{imagesUploaded.length > 1 ? "s" : ""} carregada{imagesUploaded.length > 1 ? "s" : ""}
              </div>
            )
          }
          <SubmitButton
            actionName="menu-item-gallery-images-update"
            className="mt-4 w-full uppercase font-body tracking-widest font-semibold text-[10px]"
            idleText="Salvar Imagens"
            loadingText="Salvando Imagens..."
            disabled={imagesUploaded?.length === 0 || !item?.id}
          />
        </div>
      </Form>
    </>
  )
}

interface ImageUploaderProps {
  setImagesUploaded?: (images: MenuItemWithAssociations["MenuItemGalleryImage"]) => void;
  setUploadError?: (error: string) => void;
  disabled?: boolean;
}

/**
 *  The button that opens the Cloudinary upload widget and handles the image upload.
 */
export function ImageUploader({
  setImagesUploaded = (images: MenuItemWithAssociations["MenuItemGalleryImage"]) => console.log(images),
  setUploadError = (error: string) => console.error(error),
  disabled = false
}: ImageUploaderProps) {

  // @ts-ignore
  function onUpload(error, result, widget) {

    console.log("onUpload", { error, result });

    // the "Browse" button is clicked and the upload starts to upload the image to the cloudinary server

    if (error) {
      setUploadError(error);
      widget.close({
        quiet: true,
      });
      return;
    }

    const cloudinaryResponsePayloadInfoFiles = result?.info?.files || []

    const uploadInfoFiles = cloudinaryResponsePayloadInfoFiles.map((file: any) => {
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
        publicId: file.uploadInfo.public_id || null
      } as unknown as MenuItemWithAssociations["MenuItemGalleryImage"];
    });

    setImagesUploaded(uploadInfoFiles);

  }

  return (
    <CloudinaryUploadWidget
      presetName="admin-cardapio"
      onUpload={onUpload}
    >

      {
        // @ts-ignore
        ({ open }) => {
          return <Button
            variant={"outline"}
            onClick={open}
            className="uppercase font-body tracking-wider font-semibold text-xs"
            disabled={disabled}
          >

            Upload Image
          </Button>;
        }
      }
    </CloudinaryUploadWidget>

  )
}