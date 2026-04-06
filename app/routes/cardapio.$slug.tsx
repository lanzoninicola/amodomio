import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Await, Link, defer, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { LikeIt, ShareIt } from "~/domain/cardapio/components/cardapio-item-action-bar/cardapio-item-action-bar";
import { findCardapioItemBySlug } from "~/domain/cardapio/cardapio-items-source.server";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import { CardapioItemPrice } from "~/domain/cardapio/components/cardapio-item-price/cardapio-item-price";
import ItalyIngredientsStatement from "~/domain/cardapio/components/italy-ingredient-statement/italy-ingredient-statement";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { getEngagementSettings } from "~/domain/cardapio/engagement-settings.server";

function sanitizeMediaUrl(url?: string | null) {
  const normalized = typeof url === "string" ? url.trim() : "";
  if (!normalized) return "";
  return /^https?:\/\/res\.cloudinary\.com\//i.test(normalized) ? "" : normalized;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    return redirect("/cardapio");
  }

  // Aqui você pode buscar o item do cardápio pelo ID
  const itemQuery = prismaIt(findCardapioItemBySlug(slug as string));
  const engagementSettings = await getEngagementSettings();

  return defer({
    itemQuery,
    engagementSettings,
  });
}

export default function SingleCardapioItem() {
  const { itemQuery, engagementSettings } = useLoaderData<typeof loader>();


  return (
    <Suspense fallback={<SingleSkeletonLoading />}>
      <Await resolve={itemQuery}>
        {([err, item]) => {
          if (err || !item) return <NotFound />;

          const allMedia = (item.MenuItemGalleryImage || []).filter((media) =>
            Boolean(
              sanitizeMediaUrl(media?.secureUrl) ||
              sanitizeMediaUrl((media as { url?: string | null })?.url)
            )
          );
          const featuredImage = allMedia.find((img) => img.isPrimary) || allMedia[0] || null;
          const galleryMedia = allMedia.filter((media) => media.id !== featuredImage?.id);
          const imageUrl =
            sanitizeMediaUrl(featuredImage?.secureUrl) ||
            sanitizeMediaUrl((featuredImage as { url?: string | null })?.url) ||
            "";
          const featuredKind =
            featuredImage?.kind === "video" ||
              /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(imageUrl)
              ? "video"
              : "image";
          const ingredients = item.ingredients || "";

          useEffect(() => {
            document.title = item.name;
          }, [item.name]);

          return (
            <div className="relative min-h-screen flex flex-col mt-44 md:mt-52">
              <div className="mx-4 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-8 md:items-start">
                {/* Hero */}
                <div className="flex flex-col">
                  <div className="h-[40vh] sm:h-[70vh] md:h-[60vh] overflow-hidden">
                    <CardapioItemImageSingle
                      src={imageUrl || ""}
                      kind={featuredKind}
                      placeholder={item.imagePlaceholderURL || ""}
                      placeholderIcon={true}
                      cnContainer="h-full w-full object-cover"
                      enableOverlay={false}
                    />
                  </div>
                </div>

                <Separator className="my-2 md:hidden" />

                {/* Conteúdo */}
                <div className="flex flex-col">
                  {/* Ações */}
                  {(engagementSettings.sharesEnabled || engagementSettings.likesEnabled) && (
                    <div
                      className={`grid grid-cols-1 gap-2 mt-2 mb-4 md:mt-0 md:mb-0 ${engagementSettings.sharesEnabled && engagementSettings.likesEnabled ? "md:grid-cols-2" : "md:grid-cols-1"}`}
                    >
                      {engagementSettings.sharesEnabled && (
                        <ShareIt
                          item={item}
                          size={20}
                          cnContainer="w-full px-2 py-0 h-8 border border-black"
                        >
                          <span className="font-neue text-xs uppercase tracking-wide">Compartilhar</span>
                        </ShareIt>
                      )}
                      {engagementSettings.likesEnabled && (
                        <LikeIt
                          item={item}
                          size={20}
                          cnContainer="w-full px-2 py-0 h-8 bg-red-500 text-white"
                          color="white"
                        >
                          <span className="font-neue text-xs uppercase tracking-wide">Gostei</span>
                        </LikeIt>
                      )}
                    </div>
                  )}

                  <Separator className="my-4" />

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

                  {galleryMedia.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {galleryMedia.slice(0, 8).map((media, index) => {
                          const mediaUrl =
                            sanitizeMediaUrl(media?.secureUrl) ||
                            sanitizeMediaUrl((media as { url?: string | null })?.url) ||
                            "";
                          const mediaKind =
                            media?.kind === "video" ||
                              /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(mediaUrl)
                              ? "video"
                              : "image";

                          if (mediaKind === "video") {
                            return (
                              <video
                                key={`${item.id}-detail-gallery-${index}`}
                                src={mediaUrl}
                                className="h-16 w-16 shrink-0 rounded-md object-cover border border-zinc-200 bg-black"
                                muted
                                loop
                                autoPlay
                                playsInline
                                preload="metadata"
                              />
                            );
                          }

                          return (
                            <img
                              key={`${item.id}-detail-gallery-${index}`}
                              src={mediaUrl}
                              alt={`${item.name} galeria ${index + 1}`}
                              className="h-16 w-16 shrink-0 rounded-md object-cover border border-zinc-200"
                              loading="lazy"
                            />
                          );
                        })}
                      </div>
                    </>
                  )}

                  <Separator className="my-8" />

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
