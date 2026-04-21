import { describe, expect, it } from "vitest";
import {
  parseRouteFilters,
  buildFiltersQuery,
  buildFilterOptions,
  getInitialFilterValue,
  type RootSheetOption,
} from "~/domain/item-cost-sheet/recalculate-filters";

describe("parseRouteFilters", () => {
  function params(obj: Record<string, string>) {
    return new URLSearchParams(obj);
  }

  it("retorna defaults quando params estão vazios", () => {
    const result = parseRouteFilters(params({}));
    expect(result.filterKind).toBeUndefined();
    expect(result.rootSheetId).toBeUndefined();
    expect(result.itemId).toBeUndefined();
    expect(result.search).toBeUndefined();
    expect(result.onlyActive).toBe(true);
    expect(result.onlyWithComponents).toBe(true);
  });

  it("onlyActive false quando param é '0'", () => {
    const result = parseRouteFilters(params({ onlyActive: "0" }));
    expect(result.onlyActive).toBe(false);
  });

  it("onlyActive true quando param é '1'", () => {
    const result = parseRouteFilters(params({ onlyActive: "1" }));
    expect(result.onlyActive).toBe(true);
  });

  it("onlyWithComponents false quando param é '0'", () => {
    const result = parseRouteFilters(params({ onlyWithComponents: "0" }));
    expect(result.onlyWithComponents).toBe(false);
  });

  it("parseia filterKind sheet com rootSheetId", () => {
    const result = parseRouteFilters(
      params({ filterKind: "sheet", rootSheetId: "sheet-123" })
    );
    expect(result.filterKind).toBe("sheet");
    expect(result.rootSheetId).toBe("sheet-123");
  });

  it("parseia filterKind item com itemId", () => {
    const result = parseRouteFilters(
      params({ filterKind: "item", itemId: "item-456" })
    );
    expect(result.filterKind).toBe("item");
    expect(result.itemId).toBe("item-456");
  });

  it("ignora filterKind inválido", () => {
    const result = parseRouteFilters(params({ filterKind: "invalid" }));
    expect(result.filterKind).toBeUndefined();
  });

  it("parseia search", () => {
    const result = parseRouteFilters(params({ search: "pizza" }));
    expect(result.search).toBe("pizza");
  });

  it("trim em valores vazios resulta em undefined", () => {
    const result = parseRouteFilters(params({ rootSheetId: "  ", itemId: "" }));
    expect(result.rootSheetId).toBeUndefined();
    expect(result.itemId).toBeUndefined();
  });
});

describe("buildFiltersQuery", () => {
  it("retorna string vazia quando sem filtros significativos", () => {
    const result = buildFiltersQuery({
      onlyActive: false,
      onlyWithComponents: false,
    });
    expect(result).toBe("?onlyActive=0&onlyWithComponents=0");
  });

  it("inclui filterKind e rootSheetId", () => {
    const result = buildFiltersQuery({
      filterKind: "sheet",
      rootSheetId: "sheet-1",
      onlyActive: true,
      onlyWithComponents: false,
    });
    expect(result).toContain("filterKind=sheet");
    expect(result).toContain("rootSheetId=sheet-1");
    expect(result).toContain("onlyActive=1");
    expect(result).toContain("onlyWithComponents=0");
  });

  it("inclui search quando presente", () => {
    const result = buildFiltersQuery({
      search: "frango",
      onlyActive: true,
      onlyWithComponents: true,
    });
    expect(result).toContain("search=frango");
  });
});

describe("buildFilterOptions", () => {
  const sheets: RootSheetOption[] = [
    { id: "s1", name: "Ficha Pizza", itemName: "Pizza", itemId: "item-1" },
    { id: "s2", name: "Ficha Frango", itemName: "Frango", itemId: "item-2" },
    { id: "s3", name: "Ficha Pizza Especial", itemName: "Pizza", itemId: "item-1" },
  ];

  it("gera opções de ficha para cada sheet", () => {
    const options = buildFilterOptions(sheets);
    const sheetOptions = options.filter((o) => o.kind === "sheet");
    expect(sheetOptions).toHaveLength(3);
  });

  it("gera opções de item deduplicadas por itemId", () => {
    const options = buildFilterOptions(sheets);
    const itemOptions = options.filter((o) => o.kind === "item");
    expect(itemOptions).toHaveLength(2);
  });

  it("opção de ficha tem value prefixado com 'sheet:'", () => {
    const options = buildFilterOptions(sheets);
    const sheetOption = options.find((o) => o.kind === "sheet" && o.rootSheetId === "s1");
    expect(sheetOption?.value).toBe("sheet:s1");
  });

  it("opção de item tem value prefixado com 'item:'", () => {
    const options = buildFilterOptions(sheets);
    const itemOption = options.find((o) => o.kind === "item" && o.itemId === "item-1");
    expect(itemOption?.value).toBe("item:item-1");
  });

  it("retorna array vazio para lista vazia", () => {
    expect(buildFilterOptions([])).toEqual([]);
  });

  it("ignora sheets sem label ou rootSheetId", () => {
    const incomplete: RootSheetOption[] = [
      { id: "", name: "", itemName: "", itemId: "" },
    ];
    const options = buildFilterOptions(incomplete);
    const sheetOptions = options.filter((o) => o.kind === "sheet");
    expect(sheetOptions).toHaveLength(0);
  });
});

describe("getInitialFilterValue", () => {
  it("retorna 'sheet:<id>' quando filterKind é sheet", () => {
    expect(
      getInitialFilterValue({ filterKind: "sheet", rootSheetId: "s1", onlyActive: true, onlyWithComponents: true })
    ).toBe("sheet:s1");
  });

  it("retorna 'item:<id>' quando filterKind é item", () => {
    expect(
      getInitialFilterValue({ filterKind: "item", itemId: "item-1", onlyActive: true, onlyWithComponents: true })
    ).toBe("item:item-1");
  });

  it("retorna string vazia sem filtro ativo", () => {
    expect(
      getInitialFilterValue({ onlyActive: true, onlyWithComponents: true })
    ).toBe("");
  });

  it("retorna string vazia quando filterKind é sheet mas sem rootSheetId", () => {
    expect(
      getInitialFilterValue({ filterKind: "sheet", onlyActive: true, onlyWithComponents: true })
    ).toBe("");
  });
});
