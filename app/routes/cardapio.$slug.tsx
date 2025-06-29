
import { LoaderFunctionArgs, MetaDescriptor, redirect } from "@remix-run/node";
import { Await, MetaFunction, defer, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect } from "react";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import CardapioItemPrice from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";




export async function loader({ request, params }: LoaderFunctionArgs) {

  const { slug } = params;

  if (!slug) {
    return redirect("/cardapio");
  }

  // Aqui você pode buscar o item do cardápio pelo ID
  const itemQuery = prismaIt(menuItemPrismaEntity.findBySlug(slug as string));

  return defer({
    itemQuery,
  });

}

export default function SingleCardapioItem() {
  const { itemQuery } = useLoaderData<typeof loader>()

  return (

    <Suspense fallback={
      <div
        className="min-h-screen flex items-center justify-center ">
        <Loading />
      </div>

    }>
      <Await resolve={itemQuery}>
        {([err, item]) => {

          if (err) {

            return <div className="grid place-items-center w-screen h-screen">
              <h1 className="text-2xl font-neue text-brand-blue font-bold">Nenhum item encontrado</h1>
            </div>
          }

          const itemImageUrl = item?.MenuItemGalleryImage?.[0]?.secureUrl
          const itemImagePlaceholder = item?.imagePlaceholderURL
          const itemName = item?.name
          const itemIngredients = item?.ingredients

          useEffect(() => {
            if (item) {
              document.title = itemName || ""
              document.querySelector("meta[name='description']")?.setAttribute("content", `Pizza com ${itemIngredients}` || "")
            }
          }, [item])

          // @ts-ignore
          return (
            <>
              <CardapioItemImageSingle
                src={itemImageUrl || ""}
                placeholder={itemImagePlaceholder || ""}
                placeholderIcon={true}
                cnPlaceholderIcon="w-[100px]"
                placeholderText="Imagem ainda não disponível"
                cnPlaceholderText="font-neue uppercase font-semibold tracking-wider mt-2"
              />
              {/* Overlay de gradiente preto */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

              {/* Conteúdo de texto fixo no fundo */}
              <div className="absolute bottom-0 w-full px-6 pb-8 text-white z-10">

                <h1 className=" font-urw text-2xl font-semibold ">{itemName}</h1>
                <p className="font-neue leading-snug tracking-wider text-[15px] my-2">{itemIngredients}</p>
                <Separator className="my-6 bg-white/20" />
                <CardapioItemPrice prices={item?.MenuItemSellingPriceVariation || []} cnLabel="text-white" cnValue="text-white" showValuta={false} />
              </div>
            </>

          )
        }}
      </Await>
    </Suspense>


  );
}