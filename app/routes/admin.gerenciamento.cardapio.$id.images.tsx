import { LoaderFunctionArgs } from "@remix-run/node";
import { Label } from "~/components/ui/label";
import MenuItemGalleryImagesForm from "~/domain/cardapio/components/menu-item-gallery-images/menu-item-gallery-images-form";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import { Await, defer, useActionData, useLoaderData } from "@remix-run/react";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { toast } from "~/components/ui/use-toast";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const itemId = params.id;

  if (!itemId) {
    return badRequest("Nenhum item encontrado");
  }

  let loggedUser: Promise<LoggedUser> = authenticator.isAuthenticated(request);

  const itemQryResult = prismaIt(menuItemPrismaEntity.findById(itemId));

  const data = Promise.all([
    itemQryResult,
    loggedUser
  ]);

  return defer({ data })
}

export async function action({ request }: LoaderFunctionArgs) {

  let formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);



  if (_action === "menu-item-gallery-images-update") {
    const itemId = values.itemId as string;
    const rawImages = values.itemGalleryImages as string;


    if (!itemId || !rawImages) {
      return badRequest("itemId ou itemImages ausentes.");
    }

    let incomingImages: any[] = [];
    try {
      incomingImages = jsonParse(rawImages);
      if (!Array.isArray(incomingImages)) badRequest("itemImages deve ser um array.");
    } catch (err) {
      return badRequest("Erro ao interpretar itemImages");
    }


    // 1. Busca imagens atuais do banco
    const existingImages = await prismaClient.menuItemGalleryImage.findMany({
      where: { menuItemId: itemId },
    });

    const existingByPublicId = new Map(
      existingImages.map((img) => [img.publicId, img])
    );
    const incomingPublicIds = new Set(incomingImages.map((img) => img.publicId));

    // 2. Atualiza ou cria novas imagens
    for (let index = 0; index < incomingImages.length; index++) {
      const img = incomingImages[index];
      const isPrimary = existingImages.length === 0 && index === 0; // Se for a primeira imagem, define como primária


      const existing = existingByPublicId.get(img.publicId);

      if (existing) {
        // Atualiza se mudou algo
        const needsUpdate =
          existing.thumbnailUrl !== img.thumbnailUrl ||
          existing.displayName !== img.displayName ||
          existing.format !== img.format ||
          existing.height !== img.height ||
          existing.width !== img.width


        if (needsUpdate) {
          await prismaClient.menuItemGalleryImage.update({
            where: { id: existing.id },
            data: {
              displayName: img.displayName || null,
              thumbnailUrl: img.thumbnailUrl || null,
              isPrimary
            },
          });
        }
      } else {
        // Cria novo registro
        await prismaClient.menuItemGalleryImage.create({
          data: {
            menuItemId: itemId,
            assetId: img.assetId || null,
            secureUrl: img.secureUrl,
            assetFolder: img.assetFolder || null,
            originalFileName: img.originalFileName || null,
            displayName: img.displayName || null,
            height: typeof img.height === "number" ? img.height : null,
            width: typeof img.width === "number" ? img.width : null,
            thumbnailUrl: img.thumbnailUrl || null,
            format: img.format || null,
            publicId: img.publicId,
            isPrimary,
          },
        });
      }
    }

    // 3. Remove imagens que não estão mais presentes
    const toDelete = existingImages.filter(
      (img) => !incomingPublicIds.has(img.publicId)
    );

    if (toDelete.length > 0) {
      await prismaClient.menuItemGalleryImage.deleteMany({
        where: {
          id: { in: toDelete.map((img) => img.id) },
        },
      });
    }

    return ok("Imagens atualizadas com sucesso");
  }

  if (_action === "menu-item-gallery-images-delete") {
    const imageId = values.imageId as string;
    const itemId = values.itemId as string;

    if (!imageId) {
      return badRequest("imageId ausente.");
    }

    // Verifica se a imagem existe
    const existingImage = await prismaClient.menuItemGalleryImage.findUnique({
      where: { id: imageId, menuItemId: itemId },
    });

    if (!existingImage) {
      return badRequest("Imagem não encontrada.");
    }

    // Deleta a imagem
    await prismaClient.menuItemGalleryImage.delete({
      where: { id: imageId, menuItemId: itemId },
    });

    // Se a imagem deletada for a primária, define outra como primária
    if (existingImage.isPrimary) {
      const nextPrimary = await prismaClient.menuItemGalleryImage.findFirst({
        where: { menuItemId: itemId, isPrimary: false },
      });
      if (nextPrimary) {
        await prismaClient.menuItemGalleryImage.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
      }
    }
    // Aqui você pode adicionar lógica para remover a imagem do Cloudinary, se necessário
    // Exemplo: await cloudinary.uploader.destroy(existingImage.publicId);


    return ok("Imagem deletada com sucesso");
  }

  if (_action === "menu-item-gallery-images-set-primary") {
    const imageId = values.imageId as string;
    const itemId = values.itemId as string;

    if (!imageId) {
      return badRequest("imageId ausente.");
    }

    // Verifica se a imagem existe
    const existingImage = await prismaClient.menuItemGalleryImage.findUnique({
      where: { id: imageId, menuItemId: itemId },
    });

    if (!existingImage) {
      return badRequest("Imagem não encontrada.");
    }

    // Remove a primariedade de todas as imagens do item
    await prismaClient.menuItemGalleryImage.updateMany({
      where: { menuItemId: itemId },
      data: { isPrimary: false },
    });

    // Define a imagem selecionada como primária
    await prismaClient.menuItemGalleryImage.update({
      where: { id: imageId, menuItemId: itemId },
      data: { isPrimary: true },
    });

    return ok("Imagem definida como primária com sucesso");
  }

  return null
}

export default function SingleMenuItemImagesHandlerPage() {
  const {
    data,
  } = useLoaderData<typeof loader>();


  const actionData = useActionData<typeof action>();

  if (actionData && actionData.status > 399) {
    toast({
      title: "Erro",
      description: actionData.message,
      variant: "destructive",
    });
  }

  if (actionData && actionData.status === 200) {
    toast({
      title: "Ok",
      description: actionData.message,
    });
  }


  return (

    <div className="min-h-[200px]">
      <Suspense fallback={<Loading />}>
        <Await resolve={data}>
          {
            ([itemQryResult, loggedUser]) => {

              return (
                <section className="flex flex-col gap-2">
                  <Label htmlFor="imageFile" className="font-semibold text-sm " >{`Imagens do sabor "${itemQryResult[1].name}"`}</Label>

                  <MenuItemGalleryImagesForm item={itemQryResult[1] || ""} images={itemQryResult[1]?.MenuItemGalleryImage || []} />

                </section>
              )
            }
          }
        </Await>
      </Suspense>
    </div>
  )
}