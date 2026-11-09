import type { HeadersFunction } from "@remix-run/node";
import * as XLSX from "xlsx";

import { getVisiblePublicPriceVariations } from "~/domain/cardapio/cardapio-index.shared";
import { findAllCardapioItemsGroupedByGroupLight } from "~/domain/cardapio/cardapio-items-source.server";

export const headers: HeadersFunction = () => ({
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

export async function loader() {
  const groups = (
    await findAllCardapioItemsGroupedByGroupLight(
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
      { imageTransform: false }
    )
  ).filter((group) =>
    group.productLine.toLocaleLowerCase("pt-BR").includes("pizza")
  );

  const items = groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupName: group.group,
    }))
  );
  const sizeColumns = new Map<
    string,
    { key: string; label: string; sortOrderIndex: number }
  >();

  items.flatMap(getVisiblePublicPriceVariations).forEach((variation) => {
    const key = getVariationKey(variation);
    const current = sizeColumns.get(key);
    const sortOrderIndex = Number(variation.sortOrderIndex || 0);
    if (!current || sortOrderIndex < current.sortOrderIndex) {
      sizeColumns.set(key, {
        key,
        label: variation.label,
        sortOrderIndex,
      });
    }
  });

  const sizes = [...sizeColumns.values()].sort(
    (a, b) =>
      a.sortOrderIndex - b.sortOrderIndex ||
      a.label.localeCompare(b.label, "pt-BR")
  );
  const rows = items
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((item) => {
      const variations = new Map(
        getVisiblePublicPriceVariations(item).map((variation) => [
          getVariationKey(variation),
          variation,
        ])
      );
      const ingredients = [item.baseIngredients, item.ingredients]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(", ");
      const row: Record<string, string | number> = {
        Sabor: item.name,
        Grupo: item.groupName,
        "Categoria comercial": item.commercialCategory || "",
        Ingredientes: ingredients,
        Descrição:
          item.longDescription?.trim() || item.description?.trim() || "",
      };

      sizes.forEach((size) => {
        const variation = variations.get(size.key);
        row[size.label] = variation ? Number(variation.priceAmount) : "";
      });

      row.Mídia = (item.mediaAssets || [])
        .map((asset) => asset.secureUrl?.trim())
        .filter(Boolean)
        .join("\n");
      return row;
    });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 55 },
    { wch: 65 },
    ...sizes.map(() => ({ wch: 14 })),
    { wch: 60 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sabores");
  const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(file, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="sabores-migracao-suitable.xlsx"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function getVariationKey(variation: { label: string }) {
  return variation.label.trim().toLocaleLowerCase("pt-BR");
}
