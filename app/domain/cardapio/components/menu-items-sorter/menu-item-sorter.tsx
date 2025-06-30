import { useState } from "react";
import { MenuItemWithCostVariations, MenuItemWithSellPriceVariations, SellPriceVariation } from "../../menu-item.types";
import { MenuItem } from "@prisma/client";
import { Separator } from "@radix-ui/react-separator";

type SortOrderType = "default" | "alphabetical-asc" | "alphabetical-desc" | "price-asc" | "price-desc" | "profit-asc" | "profit-desc";


interface MenuItemSorterProps<T> {
  items: T[];
  setItems: (items: T[]) => void;
}

export default function MenuItemSorter<T extends MenuItem | MenuItemWithSellPriceVariations | MenuItemWithCostVariations>({ items, setItems }: MenuItemSorterProps<T>) {
  const [sortOrderType, setSortOrderType] = useState<SortOrderType>("default")

  const handleSort = (type: SortOrderType) => {
    setSortOrderType(type)

    let sortedItems: T[] = []

    switch (type) {
      case "alphabetical-asc":
        sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name))
        break;
      case "alphabetical-desc":
        sortedItems = [...items].sort((a, b) => b.name.localeCompare(a.name))
        break;
      case "price-asc":
        sortedItems = [...items].sort((a, b) => {

          const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
          const aPrice = a.sellPriceVariations.find(predicateFn)?.priceAmount || 0;
          const bPrice = b.sellPriceVariations.find(predicateFn)?.priceAmount || 0
          return aPrice - bPrice;
        });
        break;
      case "price-desc":
        sortedItems = [...items].sort((a, b) => {
          const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
          const aPrice = a.sellPriceVariations.find(predicateFn)?.priceAmount || 0;
          const bPrice = b.sellPriceVariations.find(predicateFn)?.priceAmount || 0
          return bPrice - aPrice;
        });
        break;
      case "profit-asc":
        sortedItems = [...items].sort((a, b) => {
          const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
          const aPrice = a.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0;
          const bPrice = b.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0
          return aPrice - bPrice;
        });
        break;
      case "profit-desc":
        sortedItems = [...items].sort((a, b) => {
          const predicateFn = (record: SellPriceVariation) => record.sizeKey === "pizza-medium"
          const aPrice = a.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0;
          const bPrice = b.sellPriceVariations.find(predicateFn)?.profitActualPerc || 0
          return bPrice - aPrice;
        });
        break;
      case "default":
        sortedItems = items
        break;
      default:
        break;
    }

    setItems(sortedItems)
  }

  return (
    <div className="flex flex-row gap-x-4  items-center justify-end col-span-7 mb-4">
      <span className="text-xs">Ordenamento:</span>
      <div className="flex flex-row gap-x-4 ">

        <SortOrderOption
          label="Padrão"
          sortOrderType="default"
          handleSort={handleSort}
        />
        <Separator orientation="vertical" className="h-4" />


        <SortOrderOption
          label="A-Z"
          sortOrderType="alphabetical-asc"
          handleSort={handleSort}
        />
        <SortOrderOption
          label="Z-A"
          sortOrderType="alphabetical-desc"
          handleSort={handleSort}
        />

        <Separator orientation="vertical" className="h-4" />

        <SortOrderOption
          label="Preço crescente (Tamanho Medio)"
          sortOrderType="price-asc"
          handleSort={handleSort}
        />
        <SortOrderOption
          label="Preço decrescente (Tamanho Medio)"
          sortOrderType="price-desc"
          handleSort={handleSort}
        />

        <Separator orientation="vertical" className="h-4" />

        <SortOrderOption
          label="Profito crescente (Tamanho Medio)"
          sortOrderType="profit-asc"
          handleSort={handleSort}
        />
        <SortOrderOption
          label="Profito decrescente (Tamanho Medio)"
          sortOrderType="profit-desc"
          handleSort={handleSort}
        />
      </div>
    </div>
  )
}

const SortOrderOption = ({
  label,
  sortOrderType,
  handleSort,
}: {
  label: string;
  sortOrderType: SortOrderType;
  handleSort: (type: SortOrderType) => void;
}) => {
  return (
    <span
      className="text-xs text-muted-foreground hover:underline hover:cursor-pointer"
      onClick={() => handleSort(sortOrderType)}
    >
      {label}
    </span>
  );
}