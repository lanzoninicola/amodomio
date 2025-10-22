import { LoaderFunctionArgs, MetaDescriptor, redirect } from "@remix-run/node";
import { Await, MetaFunction, defer, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect } from "react";
import Loading from "~/components/loading/loading";
import { Separator } from "~/components/ui/separator";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import { CardapioItemPrice } from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";
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
      <SingleSkeletonLoading />
    }>
      <Await resolve={itemQuery}>
        {([err, item]) => {

          if (err) {
            return (
              <div className="grid place-items-center w-screen h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-black">
                <div className="text-center space-y-4 animate-fade-in">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center animate-bounce">
                    <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-neue text-white font-bold">Nenhum item encontrado</h1>
                  <p className="text-gray-400">O item que você procura não existe ou foi removido</p>
                </div>
              </div>
            )
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
            <div className="relative min-h-screen overflow-hidden">
              {/* Container da imagem com parallax effect */}
              <div className="relative w-full h-screen transition-transform duration-700 hover:scale-105">
                <CardapioItemImageSingle
                  src={itemImageUrl || ""}
                  placeholder={itemImagePlaceholder || ""}
                  placeholderIcon={true}
                  cnPlaceholderIcon="w-[100px] animate-bounce"
                  cnPlaceholderText="font-neue uppercase font-semibold tracking-wider mt-2 animate-fadeIn"
                />

                {/* Overlay de gradiente aprimorado com múltiplas camadas */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/30" />

                {/* Efeito de brilho sutil nas bordas */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
              </div>

              {/* Conteúdo de texto com glassmorphism */}
              <div className="absolute bottom-0 w-full px-6 pb-8 text-white z-10">
                {/* Container principal com backdrop blur */}
                <div className="backdrop-blur-sm rounded-t-3xl p-6 -mx-6 transition-all duration-500">

                  {/* Header com título */}
                  <div className="mb-4">
                    <h1 className="font-urw text-3xl font-semibold mb-2 animate-fade-in-up transition-all duration-300 hover:text-orange-400">
                      {itemName}
                    </h1>

                    {/* Statement da Itália com animação */}
                    <div className="transform transition-all duration-300 hover:scale-105">
                      <ItalyIngredientsStatement cnText="text-white/90 max-w-[280px] transition-colors duration-300 hover:text-white" />
                    </div>
                  </div>

                  {/* Ingredientes com animação */}
                  <div className="mb-6">
                    <p className="font-neue leading-snug tracking-wide text-[16px] text-white/90 transition-all duration-300 hover:text-white hover:tracking-wider">
                      {itemIngredients}
                    </p>
                  </div>

                  {/* Separador com efeito glow */}
                  <div className="relative my-6">
                    <Separator className="bg-white/20 transition-all duration-300 hover:bg-white/40" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm"></div>
                  </div>

                  {/* Preços com cards aprimorados */}
                  <div className="transform transition-all duration-300 hover:scale-105">
                    <CardapioItemPrice
                      prices={item?.MenuItemSellingPriceVariation || []}
                      cnLabel="text-white/90 transition-colors duration-300 hover:text-white"
                      cnValue="text-white font-bold transition-all duration-300 hover:text-orange-400 hover:scale-110"
                      showValuta={false}
                    />
                  </div>
                </div>
              </div>


            </div>
          )
        }}
      </Await>
    </Suspense>
  );
}


function SingleSkeletonLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-black">
      {/* Loading aprimorado com shimmer effect */}
      <div className="w-full max-w-md px-6">
        <div className="animate-pulse space-y-6">
          {/* Skeleton da imagem */}
          <div className="w-full h-64 bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl relative overflow-hidden">
            <div className="absolute inset-0 -skew-x-12 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>

          {/* Skeleton do conteúdo */}
          <div className="space-y-4">
            <div className="h-8 bg-gray-700 rounded-lg w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-20 bg-gray-700 rounded-lg"></div>
            <div className="flex gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 h-16 bg-gray-700 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>


    </div>
  )
}