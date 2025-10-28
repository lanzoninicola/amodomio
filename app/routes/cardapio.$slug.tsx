import { LoaderFunctionArgs, MetaDescriptor, redirect } from "@remix-run/node";
import { Await, Link, MetaFunction, defer, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { LikeIt, ShareIt } from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import { CardapioItemPrice, CardapioItemPriceSelect } from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
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
  const { itemQuery } = useLoaderData<typeof loader>();


  return (
    <Suspense fallback={<SingleSkeletonLoading />}>
      <Await resolve={itemQuery}>
        {([err, item]) => {
          if (err || !item) return <NotFound />;

          const imageUrl = item.MenuItemGalleryImage?.[0]?.secureUrl;
          const ingredients = item.ingredients || "";

          console.log({ price: item?.MenuItemSellingPriceVariation })

          useEffect(() => {
            document.title = item.name;
          }, [item.name]);

          return (
            <div className="relative min-h-screen flex flex-col mt-32">
              {/* Hero */}
              <div className="flex flex-col mx-4">
                <div className="h-[40vh] sm:h-[70vh] overflow-hidden rounded-t-xl ">
                  <CardapioItemImageSingle
                    src={imageUrl || ""}
                    placeholder={item.imagePlaceholderURL || ""}
                    placeholderIcon={true}
                    cnContainer="h-full w-full object-cover"
                    enableOverlay={false}
                  />

                </div>
                {/* Ações */}
                <div className="flex justify-between gap-4 my-4">
                  <ShareIt item={item} size={24} />
                  <LikeIt item={item} size={24} cnLabel="text-lg" />
                </div>
              </div>

              <Separator className="my-2" />
              {/* Conteúdo */}
              <div className="flex flex-col px-4">
                <div className="flex justify-between items-center mb-2">
                  <h1 className="font-neue text-2xl sm:text-3xl font-semibold tracking-tight">
                    {item.name}
                  </h1>
                  <ItalyIngredientsStatement showText={false} />
                </div>

                {/* Ingredientes */}
                <p className="font-neue text-base leading-snug tracking-wide">
                  {ingredients}
                </p>

                <Separator className="my-4" />

                {/* Preço */}
                <div className="transform transition-all duration-300 hover:scale-105 w-full">
                  <CardapioItemPrice
                    prices={item?.MenuItemSellingPriceVariation || []}
                    cnLabel="text-black/90 transition-colors duration-300 hover:text-black md:text-md"
                    cnValue="text-black font-bold transition-all duration-300 hover:text-orange-400 hover:scale-110 md:text-md"
                    showValuta={false}
                  />
                </div>

                <Link to={"/cardapio"} className="mt-6 md:mb-6">
                  <Button className="w-full uppercase tracking-wider font-neue">Voltar</Button>
                </Link>
              </div>
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="grid place-items-center h-screen  text-black">
      <h1 className="text-xl font-bold">Item não encontrado</h1>
    </div>
  );
}

function SingleSkeletonLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-black">
      <div className="animate-pulse space-y-4 w-3/4 max-w-md">
        <div className="h-64 bg-zinc-700 rounded-2xl"></div>
        <div className="h-6 bg-zinc-600 rounded"></div>
        <div className="h-4 bg-zinc-600 rounded w-1/2"></div>
        <div className="h-12 bg-zinc-600 rounded"></div>
      </div>
    </div>
  );
}