import type { Tag } from "@prisma/client";
import { Await, Link, defer, useLoaderData } from "@remix-run/react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import Loading from "~/components/loading/loading";
import CardapioItemImageSingle from "~/domain/cardapio/components/cardapio-item-image-single/cardapio-item-image-single";
import {
  buildImageSrcSet,
  type CardapioIndexItem,
  getCardapioItemHref,
  getPrimaryCardapioMedia,
  getVisiblePublicPriceVariations,
} from "~/domain/cardapio/cardapio-index.shared";
import { findAllCardapioItemsLight } from "~/domain/cardapio/cardapio-items-source.server";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import formatMoneyString from "~/utils/format-money-string";

export async function loader() {
  const items = findAllCardapioItemsLight(
    {
      where: {
        visible: true,
        active: true,
        upcoming: false,
      },
      option: {
        sorted: true,
        direction: "asc",
      },
    },
    {
      imageTransform: true,
      imageScaleWidth: 375,
    }
  );

  const tags = tagPrismaEntity.findAll({ public: true });

  return defer({ items, tags });
}

export default function CardapioSearch() {
  const { items, tags } = useLoaderData<typeof loader>();

  return (
    <section className="min-h-screen bg-zinc-50 px-4 pb-16 pt-[calc(5.5rem+env(safe-area-inset-top))] md:px-8 md:pt-24">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-start gap-4 border-b border-zinc-200 pb-6">
          <Link
            to={WEBSITE_LINKS.cardapioPublic.href}
            prefetch="intent"
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition active:bg-zinc-100"
            aria-label="Voltar ao cardápio"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="font-neue text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Cardápio A Modo Mio
            </p>
            <h1 className="mt-1 font-lora text-3xl font-bold tracking-tight text-zinc-950 md:text-5xl">
              Encontre seu sabor
            </h1>
            <p className="mt-2 max-w-2xl font-neue text-sm leading-relaxed text-zinc-600 md:text-base">
              Busque por pizza, ingrediente ou escolha uma das etiquetas da
              casa.
            </p>
          </div>
        </div>

        <Suspense fallback={<Loading cnContainer="min-h-[320px]" />}>
          <Await resolve={Promise.all([items, tags])}>
            {([loadedItems, loadedTags]) => (
              <CardapioSearchContent items={loadedItems} tags={loadedTags} />
            )}
          </Await>
        </Suspense>
      </div>
    </section>
  );
}

function CardapioSearchContent({
  items,
  tags,
}: {
  items: CardapioIndexItem[];
  tags: Tag[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchText(query);

  const results = useMemo(() => {
    if (!normalizedQuery) return [];

    return items.filter((item) => {
      const searchableText = [
        item.name,
        item.description,
        item.ingredients,
        ...(item.tags?.public ?? []),
        ...(item.tags?.all ?? []),
      ]
        .filter(Boolean)
        .map((value) => normalizeSearchText(String(value)))
        .join(" ");

      return searchableText.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  const onTagSelected = (tag: Tag) => {
    setQuery(tag.name);
  };

  return (
    <div className="space-y-8">
      <div className="sticky top-[calc(1rem+env(safe-area-inset-top))] z-30 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-[0_10px_35px_rgba(0,0,0,0.16)] backdrop-blur-xl md:static md:p-4">
        <label htmlFor="cardapio-search" className="sr-only">
          Buscar no cardápio
        </label>
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 shrink-0 text-zinc-500" />
          <input
            id="cardapio-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: burrata, bacon ou vegetariana"
            className="h-11 min-w-0 flex-1 bg-transparent font-neue text-base text-zinc-950 outline-none placeholder:text-zinc-400"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 active:bg-zinc-200"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-neue text-sm font-bold uppercase tracking-[0.16em] text-zinc-950">
            Explorar por etiqueta
          </h2>
          {normalizedQuery ? (
            <span className="font-neue text-xs text-zinc-500">
              {results.length}{" "}
              {results.length === 1 ? "resultado" : "resultados"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const isSelected =
              normalizedQuery === normalizeSearchText(tag.name);

            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onTagSelected(tag)}
                className={
                  isSelected
                    ? "rounded-full border border-zinc-950 bg-zinc-950 px-3 py-2 font-neue text-xs font-bold uppercase tracking-wide text-white"
                    : "rounded-full border border-black/10 bg-white px-3 py-2 font-neue text-xs font-bold uppercase tracking-wide text-zinc-700 shadow-sm transition active:bg-zinc-100"
                }
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      {!normalizedQuery ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <Search className="mx-auto h-7 w-7 text-zinc-400" />
          <p className="mt-3 font-lora text-xl font-bold text-zinc-950">
            O que você gostaria de comer hoje?
          </p>
          <p className="mx-auto mt-2 max-w-md font-neue text-sm text-zinc-500">
            Digite um ingrediente, nome de pizza ou toque em uma etiqueta.
          </p>
        </div>
      ) : results.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <CardapioSearchResult key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-lora text-xl font-bold text-zinc-950">
            Nenhum sabor encontrado
          </p>
          <p className="mt-2 font-neue text-sm text-zinc-500">
            Tente outro ingrediente ou escolha uma etiqueta acima.
          </p>
        </div>
      )}
    </div>
  );
}

function CardapioSearchResult({ item }: { item: CardapioIndexItem }) {
  const media = getPrimaryCardapioMedia(item);
  const mediaUrl = media?.secureUrl ?? "";
  const mediaKind =
    media?.kind === "video" ||
    /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(mediaUrl)
      ? "video"
      : "image";
  const priceLabel = getPriceLabel(item);

  return (
    <li className="overflow-hidden rounded-2xl bg-zinc-950 shadow-sm">
      <Link
        to={getCardapioItemHref(item)}
        prefetch="intent"
        className="group block h-full touch-manipulation"
      >
        <div className="h-44 overflow-hidden">
          <CardapioItemImageSingle
            src={mediaUrl}
            srcSet={buildImageSrcSet(media?.variants)}
            sizes="(max-width: 640px) calc(50vw - 16px), (max-width: 1024px) calc(33vw - 24px), 320px"
            kind={mediaKind}
            placeholder={media?.thumbnailUrl || item.imagePlaceholderURL || ""}
            placeholderIcon={false}
            cnPlaceholderText="font-lora font-bold leading-none text-white/80"
            cnPlaceholderContainer="from-zinc-900 via-zinc-800 to-zinc-700"
            cnContainer="h-full w-full transition duration-300 group-hover:scale-[1.02]"
            enableOverlay={false}
          />
        </div>
        <div className="flex min-h-[150px] flex-col p-4 text-white">
          <h3 className="font-neue text-base font-bold uppercase leading-tight">
            {item.name}
          </h3>
          <p className="mt-2 line-clamp-3 font-lora text-sm leading-relaxed text-white/75">
            {item.ingredients || item.description || "Conheça este sabor."}
          </p>
          <div className="mt-auto flex items-end justify-between gap-3 pt-5">
            <span className="font-neue text-sm font-semibold text-white">
              {priceLabel}
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
              <ArrowRight className="h-5 w-5" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function getPriceLabel(item: CardapioIndexItem) {
  const variations = getVisiblePublicPriceVariations(item);
  if (!variations.length) return "Ver detalhes";

  const prices = variations
    .map((variation) => Number(variation.priceAmount))
    .filter(Number.isFinite);
  if (!prices.length) return "Ver detalhes";

  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum
    ? formatMoneyString(minimum)
    : `De ${formatMoneyString(minimum)} a ${formatMoneyString(maximum)}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}
