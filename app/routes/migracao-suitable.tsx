import type { HeadersFunction, MetaFunction } from "@remix-run/node";
import { Await, defer, useLoaderData } from "@remix-run/react";
import { Check, Copy, Download, FileSpreadsheet } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

import Loading from "~/components/loading/loading";
import { Button } from "~/components/ui/button";
import type {
  CardapioIndexItem,
  CardapioMedia,
  GroupedItems,
} from "~/domain/cardapio/cardapio-index.shared";
import { getVisiblePublicPriceVariations } from "~/domain/cardapio/cardapio-index.shared";
import { findAllCardapioItemsGroupedByGroupLight } from "~/domain/cardapio/cardapio-items-source.server";

type CatalogItem = CardapioIndexItem & { groupName: string };

export const meta: MetaFunction = () => [
  { title: "Migração Suitable | A Modo Mio" },
  {
    name: "description",
    content:
      "Materiais e informações dos sabores de pizza para migração de cardápio.",
  },
  { name: "robots", content: "noindex, nofollow, noarchive" },
  { name: "googlebot", content: "noindex, nofollow, noarchive" },
];

export const headers: HeadersFunction = () => ({
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

export async function loader() {
  const groups = findAllCardapioItemsGroupedByGroupLight(
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
      imageTransform: false,
    }
  ).then((loadedGroups) =>
    loadedGroups.filter((group) =>
      group.productLine.toLocaleLowerCase("pt-BR").includes("pizza")
    )
  );

  return defer({ groups });
}

export default function MigracaoSuitablePage() {
  const { groups } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-white px-4 py-6 font-neue text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Sabores de pizza
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Materiais para migração do cardápio para o Suitable
          </p>
        </header>

        <Suspense fallback={<Loading cnContainer="min-h-[320px]" />}>
          <Await resolve={groups}>
            {(loadedGroups) => <FlavorCatalog groups={loadedGroups} />}
          </Await>
        </Suspense>
      </div>
    </main>
  );
}

function FlavorCatalog({ groups }: { groups: GroupedItems[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const items = useMemo(
    () =>
      groups
        .flatMap((group) =>
          group.items.map((item) => ({
            ...item,
            groupName: group.group,
          }))
        )
        .filter((item) =>
          normalizedQuery
            ? [
                item.name,
                item.groupName,
                item.commercialCategory,
                item.description,
                item.longDescription,
                item.baseIngredients,
                item.ingredients,
              ].some((value) =>
                String(value || "")
                  .toLocaleLowerCase("pt-BR")
                  .includes(normalizedQuery)
              )
            : true
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [groups, normalizedQuery]
  );
  const sizeColumns = useMemo(() => {
    const sizes = new Map<
      string,
      { key: string; label: string; sortOrderIndex: number }
    >();

    groups
      .flatMap((group) => group.items)
      .flatMap(getVisiblePublicPriceVariations)
      .forEach((variation) => {
        const key = getVariationKey(variation);
        const current = sizes.get(key);
        if (
          !current ||
          Number(variation.sortOrderIndex || 0) < current.sortOrderIndex
        ) {
          sizes.set(key, {
            key,
            label: variation.label,
            sortOrderIndex: Number(variation.sortOrderIndex || 0),
          });
        }
      });

    return [...sizes.values()].sort(
      (a, b) =>
        a.sortOrderIndex - b.sortOrderIndex ||
        a.label.localeCompare(b.label, "pt-BR")
    );
  }, [groups]);

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-y border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:border-x-0 sm:border-t-0 sm:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar sabor"
            className="h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none ring-zinc-900 transition focus:ring-1 sm:max-w-sm"
          />
          <p className="shrink-0 text-sm text-zinc-500">
            {items.length} {items.length === 1 ? "item" : "itens"}
          </p>
          <Button asChild className="ml-auto gap-2">
            <a href="/migracao-suitable/excel">
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </a>
          </Button>
        </div>
      </div>

      {items.length ? (
        <div className="max-h-[calc(100vh-13rem)] touch-pan-x overflow-auto overscroll-x-contain border-y border-zinc-200 sm:rounded-lg sm:border">
          <table className="w-full min-w-[1760px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 shadow-[0_1px_0_0_rgb(228_228_231)]">
              <tr>
                <th className="min-w-[170px] px-4 py-3 font-semibold">Sabor</th>
                <th className="min-w-[170px] px-4 py-3 font-semibold">Grupo</th>
                <th className="min-w-[190px] px-4 py-3 font-semibold">
                  Categoria comercial
                </th>
                <th className="min-w-[290px] px-4 py-3 font-semibold">
                  Ingredientes
                </th>
                <th className="min-w-[260px] px-4 py-3 font-semibold">
                  Descrição
                </th>
                {sizeColumns.map((size) => (
                  <th
                    key={size.key}
                    className="min-w-[120px] px-4 py-3 font-semibold"
                  >
                    {size.label}
                  </th>
                ))}
                <th className="min-w-[220px] px-4 py-3 font-semibold">Mídia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {items.map((item) => (
                <FlavorRow
                  key={item.id}
                  item={item}
                  sizeColumns={sizeColumns}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
          Nenhum sabor encontrado.
        </div>
      )}
    </>
  );
}

function FlavorRow({
  item,
  sizeColumns,
}: {
  item: CatalogItem;
  sizeColumns: Array<{ key: string; label: string }>;
}) {
  const media = (item.mediaAssets || []).filter((asset) =>
    Boolean(asset.secureUrl)
  );
  const description =
    item.longDescription?.trim() || item.description?.trim() || "";
  const ingredients = [item.baseIngredients, item.ingredients]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
  const variations = getVisiblePublicPriceVariations(item);
  const variationsBySize = new Map(
    variations.map((variation) => [getVariationKey(variation), variation])
  );

  return (
    <tr className="align-top hover:bg-zinc-50/60">
      <td className="px-4 py-4">
        <p className="font-semibold text-zinc-950">{item.name}</p>
        <CopyTextButton text={item.name} label="Copiar nome" />
      </td>
      <td className="px-4 py-4">
        <p className="text-zinc-700">{item.groupName}</p>
        <CopyTextButton text={item.groupName} label="Copiar grupo" />
      </td>
      <td className="px-4 py-4">
        <p
          className={
            item.commercialCategory ? "text-zinc-700" : "text-zinc-400"
          }
        >
          {item.commercialCategory || "Não disponível"}
        </p>
        {item.commercialCategory ? (
          <CopyTextButton
            text={item.commercialCategory}
            label="Copiar categoria"
          />
        ) : null}
      </td>
      <td className="px-4 py-4">
        <p className={ingredients ? "text-zinc-700" : "text-zinc-400"}>
          {ingredients || "Não informado"}
        </p>
        <CopyTextButton
          text={ingredients || "Não informado"}
          label="Copiar ingredientes"
        />
      </td>
      <td className="px-4 py-4">
        <p className={description ? "text-zinc-700" : "text-zinc-400"}>
          {description || "Não disponível"}
        </p>
        {description ? (
          <CopyTextButton text={description} label="Copiar descrição" />
        ) : null}
      </td>
      {sizeColumns.map((size) => {
        const variation = variationsBySize.get(size.key);
        return (
          <td key={size.key} className="px-4 py-4">
            {variation ? (
              <div className="flex items-center justify-between gap-2">
                <strong className="font-semibold text-zinc-950">
                  {formatMoney(variation.priceAmount)}
                </strong>
                <CopyIconButton
                  text={formatPriceNumber(variation.priceAmount)}
                  label={`Copiar preço de ${size.label}`}
                />
              </div>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </td>
        );
      })}
      <td className="px-4 py-4">
        <MediaCell assets={media} itemName={item.name} />
      </td>
    </tr>
  );
}

function MediaCell({
  assets,
  itemName,
}: {
  assets: CardapioMedia[];
  itemName: string;
}) {
  if (!assets.length) {
    return <p className="text-zinc-400">Mídia não disponível</p>;
  }

  return (
    <div className="space-y-2">
      {assets.map((asset, index) => (
        <MediaAsset
          key={`${asset.secureUrl}-${index}`}
          asset={asset}
          itemName={itemName}
          index={index}
        />
      ))}
    </div>
  );
}

function MediaAsset({
  asset,
  itemName,
  index,
}: {
  asset: CardapioMedia;
  itemName: string;
  index: number;
}) {
  const url = asset.secureUrl || "";
  const isVideo = isVideoAsset(asset);
  const filename = buildFilename(itemName, isVideo, url, index);
  const downloadUrl = `/migracao-suitable/download?src=${encodeURIComponent(
    url
  )}&filename=${encodeURIComponent(filename)}`;

  return (
    <div className="flex items-center gap-2">
      {isVideo ? (
        <video
          src={url}
          preload="metadata"
          className="h-12 w-16 shrink-0 rounded border border-zinc-200 bg-zinc-100 object-cover"
        />
      ) : (
        <img
          src={url}
          alt={`${itemName} - imagem ${index + 1}`}
          loading="lazy"
          className="h-12 w-16 shrink-0 rounded border border-zinc-200 bg-zinc-100 object-cover"
        />
      )}
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 px-2.5 text-xs transition hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white hover:shadow-md"
      >
        <a href={downloadUrl} download={filename}>
          <Download className="h-3.5 w-3.5" />
          Baixar {index + 1}
        </a>
      </Button>
    </div>
  );
}

function isVideoAsset(asset: CardapioMedia) {
  const url = asset.secureUrl || "";
  return (
    asset.kind?.toLocaleLowerCase() === "video" ||
    /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(url)
  );
}

function CopyIconButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-7 shrink-0 p-0 transition hover:-translate-y-0.5 hover:bg-red-700 hover:text-white hover:shadow-md"
      onClick={copy}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2 h-8 shrink-0 gap-1.5 px-2.5 text-xs transition hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white hover:shadow-md"
      onClick={copy}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatPriceNumber(value: number) {
  return Number(value || 0)
    .toFixed(2)
    .replace(".", ",");
}

function getVariationKey(variation: { label: string }) {
  return variation.label.trim().toLocaleLowerCase("pt-BR");
}

function buildFilename(
  itemName: string,
  isVideo: boolean,
  url: string,
  index: number
) {
  const urlExtension = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i)?.[1];
  const extension = urlExtension || (isVideo ? "mp4" : "jpg");
  const base = itemName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase();

  return `${base || "sabor"}-${isVideo ? "video" : "imagem"}-${
    index + 1
  }.${extension}`;
}
