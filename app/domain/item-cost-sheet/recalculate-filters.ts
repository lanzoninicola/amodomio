export type RouteFilters = {
  filterKind?: "sheet" | "item";
  itemId?: string;
  rootSheetId?: string;
  selectedFilterLabel?: string;
  search?: string;
  onlyActive: boolean;
  onlyWithComponents: boolean;
};

export type RootSheetOption = {
  id: string;
  name: string;
  itemName: string;
  itemId: string;
};

export type FilterOption = {
  value: string;
  label: string;
  searchText: string;
  kind: "sheet" | "item";
  rootSheetId?: string;
  itemId?: string;
};

export function parseRouteFilters(searchParams: URLSearchParams): RouteFilters {
  const filterKind = String(searchParams.get("filterKind") || "").trim();
  const onlyActiveParam = searchParams.get("onlyActive");
  const onlyWithComponentsParam = searchParams.get("onlyWithComponents");

  return {
    filterKind:
      filterKind === "sheet" || filterKind === "item" ? filterKind : undefined,
    rootSheetId:
      String(searchParams.get("rootSheetId") || "").trim() || undefined,
    itemId: String(searchParams.get("itemId") || "").trim() || undefined,
    selectedFilterLabel:
      String(searchParams.get("selectedFilterLabel") || "").trim() || undefined,
    search: String(searchParams.get("search") || "").trim() || undefined,
    onlyActive: onlyActiveParam === null ? true : onlyActiveParam === "1",
    onlyWithComponents:
      onlyWithComponentsParam === null ? true : onlyWithComponentsParam === "1",
  };
}

export function buildFiltersQuery(filters: RouteFilters): string {
  const params = new URLSearchParams();

  if (filters.filterKind) params.set("filterKind", filters.filterKind);
  if (filters.rootSheetId) params.set("rootSheetId", filters.rootSheetId);
  if (filters.itemId) params.set("itemId", filters.itemId);
  if (filters.selectedFilterLabel)
    params.set("selectedFilterLabel", filters.selectedFilterLabel);
  if (filters.search) params.set("search", filters.search);
  params.set("onlyActive", filters.onlyActive ? "1" : "0");
  params.set("onlyWithComponents", filters.onlyWithComponents ? "1" : "0");

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildFilterOptions(
  rootSheetOptions: RootSheetOption[]
): FilterOption[] {
  const itemOptionsById = new Map<
    string,
    {
      value: string;
      label: string;
      searchText: string;
      kind: "item";
      itemId: string;
    }
  >();

  const sheetOptions = rootSheetOptions.flatMap((sheet) => {
    const sheetName = String(sheet.name || "").trim();
    const itemName = String(sheet.itemName || "").trim();
    const rootSheetId = String(sheet.id || "");
    const itemId = String(sheet.itemId || "");
    const sheetSearch = [sheetName, itemName].filter(Boolean).join(" ");
    const itemLabel = itemName || sheetName;

    if (itemId && itemLabel && !itemOptionsById.has(itemId)) {
      itemOptionsById.set(itemId, {
        value: `item:${itemId}`,
        label: itemLabel,
        searchText: itemLabel,
        kind: "item",
        itemId,
      });
    }

    return [
      {
        value: `sheet:${rootSheetId}`,
        label: sheetName || itemName,
        searchText: sheetSearch,
        kind: "sheet" as const,
        rootSheetId,
      },
    ].filter((option) => option.label && option.rootSheetId);
  });

  return [...sheetOptions, ...itemOptionsById.values()];
}

export function getInitialFilterValue(filters: RouteFilters): string {
  if (filters.filterKind === "sheet" && filters.rootSheetId)
    return `sheet:${filters.rootSheetId}`;
  if (filters.filterKind === "item" && filters.itemId)
    return `item:${filters.itemId}`;
  return "";
}
