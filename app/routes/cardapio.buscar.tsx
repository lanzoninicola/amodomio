import type { Tag } from "@prisma/client";
import { Await, Link, defer, useLoaderData } from "@remix-run/react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import Loading from "~/components/loading/loading";
import type { CardapioIndexItem } from "~/domain/cardapio/cardapio-index.shared";
import { CardapioItemsGrid } from "~/domain/cardapio/components/cardapio-index/cardapio-index-sections";
import { findAllCardapioItemsLight } from "~/domain/cardapio/cardapio-items-source.server";
import { tagPrismaEntity } from "~/domain/tags/tag.prisma.entity.server";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";

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
    <section className="min-h-screen bg-zinc-50 px-4 pb-16 pt-12 md:px-8 md:pt-24">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-start gap-4 ">
          <Link
            to={WEBSITE_LINKS.cardapioPublic.href}
            prefetch="intent"
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition active:bg-zinc-100"
            aria-label="Voltar ao cardápio"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="mt-1 font-lora text-3xl font-bold tracking-tighter text-zinc-950 md:text-5xl">
              Encontre seu sabor
            </h1>
            <p className="mt-2 max-w-2xl font-neue text-sm  text-zinc-600 md:text-base">
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
          <h2 className="font-neue text-sm font-semibold uppercase tracking-normal text-zinc-950">
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
          {/* <p className="mt-3 font-lora text-xl font-bold text-zinc-950">
            O que você gostaria de comer hoje?
          </p> */}
          <p className="mx-auto mt-2 max-w-md font-neue text-sm text-zinc-500">
            Digite um ingrediente, nome de pizza ou toque em uma etiqueta.
          </p>
        </div>
      ) : results.length ? (
        <CardapioItemsGrid
          items={results}
          interestTrackingEnabled={false}
          likesEnabled={false}
        />
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

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}
