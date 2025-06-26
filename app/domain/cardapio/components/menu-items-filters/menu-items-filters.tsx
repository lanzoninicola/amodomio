import { MenuItemGroup } from "@prisma/client";
import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import { MenuItemVisibilityFilterOption } from "./admin.gerenciamento.cardapio.main.list";
import { Category } from "~/domain/category/category.model.server";
import { jsonParse } from "~/utils/json-helper";


interface MenuItemsFiltersProps {
  initialItems: MenuItemWithSellPriceVariations[];
  groups: MenuItemGroup[];
  categories: Category[];
  cnContainer?: string
  onItemsChange: (filteredItems: MenuItemWithSellPriceVariations[]) => void;
}

export function MenuItemsFilters({
  initialItems,
  groups,
  categories,
  cnContainer,
  onItemsChange,
}: MenuItemsFiltersProps) {
  const [search, setSearch] = useState("");
  const [currentGroup, setCurrentGroup] = useState<MenuItemGroup["key"] | null>(null);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [currentFilter, setCurrentFilter] = useState<MenuItemVisibilityFilterOption | null>("active");

  const applyFilters = (
    groupKey: MenuItemGroup["key"] | null,
    category: Category | null,
    visibility: MenuItemVisibilityFilterOption | null,
    searchValue: string
  ) => {
    let filtered = [...initialItems];

    if (groupKey) filtered = filtered.filter(i => i.group?.key === groupKey);
    if (category) filtered = filtered.filter(i => i.category?.id === category.id);
    if (visibility === "active") filtered = filtered.filter(i => i.visible === true);
    if (visibility === "venda-pausada") filtered = filtered.filter(i => i.active && !i.visible);
    if (searchValue) {
      filtered = filtered.filter(i =>
        i.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
        i.ingredients?.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    onItemsChange(filtered);
  };

  useEffect(() => {
    applyFilters(currentGroup, currentCategory, currentFilter, search);
  }, []);

  return (
    <div className={
      cn(
        "flex flex-col md:grid md:grid-cols-8 gap-4 items-center bg-slate-50 py-2 px-4",
        cnContainer
      )
    }>
      <Select
        name="group"
        onValueChange={(value) => {
          const parsed = value ? jsonParse(value) : null;
          const key = parsed?.key || null;
          setCurrentGroup(key);
          applyFilters(key, currentCategory, currentFilter, search);
        }}
      >
        <SelectTrigger className="w-full md:col-span-1 bg-white">
          <SelectValue placeholder="Grupo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos os grupos</SelectItem>
          {groups.sort((a, b) => a.sortOrderIndex - b.sortOrderIndex).map((g) => (
            <SelectItem key={g.id} value={JSON.stringify(g)}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        name="category"
        onValueChange={(value) => {
          const parsed = jsonParse(value);
          setCurrentCategory(parsed);
          applyFilters(currentGroup, parsed, currentFilter, search);
        }}
        disabled={currentGroup === null}
      >
        <SelectTrigger className="w-full md:col-span-1 bg-white">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todas as categorias</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={JSON.stringify(c)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) => {
          const v = value as MenuItemVisibilityFilterOption;
          setCurrentFilter(v);
          applyFilters(currentGroup, currentCategory, v, search);
        }}
        defaultValue={"active"}
      >
        <SelectTrigger className="w-full bg-white md:col-span-1">
          <SelectValue placeholder="Filtrar vendas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Venda ativa</SelectItem>
          <SelectItem value="venda-pausada">Venda pausada</SelectItem>
        </SelectContent>
      </Select>

      <div className="grid place-items-center rounded-sm col-span-5 w-full" >
        <Input
          name="search"
          className="w-full py-4 text-lg bg-white"
          placeholder="Pesquisar o sabor..."
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            applyFilters(currentGroup, currentCategory, currentFilter, value);
          }}
          value={search}
        />
      </div>


    </div>
  );
}