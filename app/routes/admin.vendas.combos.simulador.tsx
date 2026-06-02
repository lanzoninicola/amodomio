import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "~/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import { pickLatestActiveSheet } from "~/domain/item/item-selling-price-calculation.server";
import {
  analyzeComboPricing,
  buildComboSalesComparison,
  type ComboPricingAnalysis,
  type ComboPricingMode,
  type ComboPricingStatus,
  type ComboSalesComparison,
} from "~/domain/sell-price/combo-pricing";
import {
  formatMoney,
  formatPercent,
  formatStatus,
} from "~/domain/sell-price/components/combo-generator-shared";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";

type ChannelOption = {
  id: string;
  key: string;
  name: string;
  targetMarginPerc: number;
};

type TagOption = {
  id: string;
  name: string;
};

export type ComboItemOption = {
  optionId: string;
  itemId: string;
  itemName: string;
  itemSlug: string | null;
  itemVariationId: string;
  variationName: string;
  variationCode: string | null;
  isReference: boolean;
  categoryName: string | null;
  groupName: string | null;
  priceAmount: number;
  costAmount: number | null;
  costSource: "sheet" | "missing";
  activeSheetId: string | null;
  isValidForSale: boolean;
  invalidReasons: string[];
  tags: TagOption[];
};

type ComboLine = {
  optionId: string;
  quantity: number;
};

type VariationFilterOption = {
  key: string;
  label: string;
};

const resultTabs = [
  {
    to: "precificacao",
    label: "Precificacao",
    dotClassName: "bg-sky-500",
  },
  {
    to: "simulador-venda",
    label: "Simulador",
    dotClassName: "bg-emerald-300",
  },
];

export type ComboGeneratorSelectedLine = ComboItemOption & { quantity: number };

export type AdminVendasGeradorCombosOutletContext = {
  selectedLines: ComboGeneratorSelectedLine[];
  totals: ComboPricingAnalysis;
  salesComparison: ComboSalesComparison;
  pricingMode: ComboPricingMode;
  discountPercentage: number;
  discountAmount: number;
  fixedPriceAmount: number;
  copySimulationMessage: () => void;
  copySimulation: () => void;
  clearLines: () => void;
};

function parseDecimal(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCopyText(params: {
  selectedChannelName: string;
  targetMarginPerc: number;
  lines: Array<ComboItemOption & { quantity: number }>;
  costTotal: number;
  individualPriceTotal: number;
  discountPerc: number | null;
  marginPerc: number | null;
  breakEvenPrice: number;
  recommendedPrice: number;
  dnaAmount: number;
  profitAmount: number;
  equivalentDiscountAmount: number;
  status: ComboPricingStatus;
  isValidForSale: boolean;
  invalidReasons: string[];
  salesComparison: ComboSalesComparison;
}) {
  const lineText = params.lines
    .map((line) => {
      return `- ${line.quantity}x ${line.itemName} (${
        line.variationName
      }) - preco unit. ${formatMoney(
        line.priceAmount
      )} - custo ficha unit. ${formatMoney(line.costAmount)}`;
    })
    .join("\n");

  return [
    "Simulacao de combo",
    `Canal: ${params.selectedChannelName}`,
    `Margem alvo: ${formatPercent(params.targetMarginPerc)}`,
    "",
    lineText || "- Nenhum item selecionado",
    "",
    `Custo total da ficha tecnica: ${formatMoney(params.costTotal)}`,
    `Soma individual: ${formatMoney(params.individualPriceTotal)}`,
    `Preco final do combo: ${formatMoney(
      params.individualPriceTotal - params.equivalentDiscountAmount
    )}`,
    `Desconto equivalente: ${formatMoney(
      params.equivalentDiscountAmount
    )} (${formatPercent(params.discountPerc)})`,
    `DNA aplicado: ${formatMoney(params.dnaAmount)}`,
    `Lucro estimado: ${formatMoney(params.profitAmount)}`,
    `Margem simulada: ${formatPercent(params.marginPerc)}`,
    `Preco de equilibrio: ${formatMoney(params.breakEvenPrice)}`,
    `Preco recomendado: ${formatMoney(params.recommendedPrice)}`,
    `Status: ${formatStatus(params.status)}`,
    "",
    "Comparativo de venda",
    `Venda avulsa - receita: ${formatMoney(
      params.salesComparison.individualSale.priceAmount
    )} - lucro: ${formatMoney(
      params.salesComparison.individualSale.profitAmount
    )} - margem: ${formatPercent(
      params.salesComparison.individualSale.profitPerc
    )}`,
    `Venda combo - receita: ${formatMoney(
      params.salesComparison.comboSale.priceAmount
    )} - lucro: ${formatMoney(
      params.salesComparison.comboSale.profitAmount
    )} - margem: ${formatPercent(params.salesComparison.comboSale.profitPerc)}`,
    `Diferenca de lucro: ${formatMoney(
      params.salesComparison.profitDeltaAmount
    )} (${formatPercent(params.salesComparison.profitDeltaPerc)})`,
    `Diferenca de margem: ${formatPercent(
      params.salesComparison.marginDeltaPerc
    )}`,
    `Valido para venda: ${params.isValidForSale ? "sim" : "nao"}`,
    ...(params.invalidReasons.length > 0
      ? ["Motivos:", ...params.invalidReasons.map((reason) => `- ${reason}`)]
      : []),
  ].join("\n");
}

function buildComboShareMessage(params: {
  selectedChannelName: string;
  lines: Array<ComboItemOption & { quantity: number }>;
  individualPriceTotal: number;
  comboPrice: number;
  equivalentDiscountAmount: number;
  equivalentDiscountPercentage: number;
  recommendedPrice: number;
  status: ComboPricingStatus;
}) {
  const lineText = params.lines
    .map((line) => {
      const quantityText = Number(line.quantity || 0).toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      });
      return `- ${quantityText}x ${line.itemName} (${line.variationName})`;
    })
    .join("\n");

  return [
    "*Simulacao de combo*",
    `Canal: ${params.selectedChannelName}`,
    "",
    "*Itens*",
    lineText || "- Nenhum item selecionado",
    "",
    "*Precos*",
    `Preco pleno: ${formatMoney(params.individualPriceTotal)}`,
    `Preco simulado: ${formatMoney(params.comboPrice)}`,
    `Desconto: ${formatMoney(params.equivalentDiscountAmount)} (${formatPercent(
      params.equivalentDiscountPercentage
    )})`,
    `Preco recomendado: ${formatMoney(params.recommendedPrice)}`,
    `Status: ${formatStatus(params.status)}`,
  ].join("\n");
}

export const meta: MetaFunction = () => [
  { title: "Vendas | Combos | Simulador" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;

    const [channels, sellingPriceConfig] = await Promise.all([
      db.itemSellingChannel.findMany({
        select: {
          id: true,
          key: true,
          name: true,
          targetMarginPerc: true,
          sortOrderIndex: true,
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
      menuItemSellingPriceUtilityEntity.getSellingPriceConfig(),
    ]);

    const channelOptions: ChannelOption[] = (channels || []).map(
      (channel: any) => ({
        id: String(channel.id),
        key: String(channel.key || "").toLowerCase(),
        name: channel.name || String(channel.key || "").toUpperCase(),
        targetMarginPerc: Number(channel.targetMarginPerc || 0),
      })
    );

    const selectedChannel =
      channelOptions.find((channel) => channel.key === "cardapio") || null;

    if (!selectedChannel) {
      return ok({
        channels: [],
        options: [],
        summary: {
          totalOptions: 0,
          missingCost: 0,
          selectedChannelName: null,
          targetMarginPerc: 0,
          dnaPerc: 0,
        },
      });
    }

    const itemWhere: any = {
      canSell: true,
      active: true,
    };

    const priceRows = await db.itemSellingPriceVariation.findMany({
      where: {
        itemSellingChannelId: selectedChannel.id,
        priceAmount: { gt: 0 },
        Item: itemWhere,
        ItemVariation: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        itemId: true,
        itemVariationId: true,
        priceAmount: true,
        Item: {
          select: {
            id: true,
            name: true,
            Category: { select: { name: true } },
            ItemSellingInfo: {
              select: {
                slug: true,
                Category: { select: { name: true } },
                ItemGroup: { select: { name: true } },
              },
            },
            ItemTag: {
              where: { deletedAt: null },
              select: {
                Tag: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        ItemVariation: {
          select: {
            id: true,
            isReference: true,
            Variation: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { Item: { name: "asc" } },
        { ItemVariation: { isReference: "desc" } },
      ],
      take: 500,
    });

    const itemIds = Array.from(
      new Set(
        (priceRows || []).map((row: any) => String(row.itemId)).filter(Boolean)
      )
    );
    const itemVariationIds = Array.from(
      new Set(
        (priceRows || [])
          .map((row: any) => String(row.itemVariationId))
          .filter(Boolean)
      )
    );

    const activeSheets =
      itemIds.length === 0 || itemVariationIds.length === 0
        ? []
        : await db.itemCostSheet.findMany({
            where: {
              itemId: { in: itemIds },
              itemVariationId: { in: itemVariationIds },
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              itemId: true,
              itemVariationId: true,
              costAmount: true,
              updatedAt: true,
              activatedAt: true,
            },
            orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }],
          });

    const activeSheetsByVariation = new Map<string, any[]>();
    for (const sheet of activeSheets || []) {
      const key = `${String(sheet.itemId)}:${String(sheet.itemVariationId)}`;
      const current = activeSheetsByVariation.get(key) || [];
      current.push(sheet);
      activeSheetsByVariation.set(key, current);
    }

    const options: ComboItemOption[] = (priceRows || []).map((row: any) => {
      const itemId = String(row.itemId || "");
      const itemVariationId = String(row.itemVariationId || "");
      const activeSheet = pickLatestActiveSheet(
        activeSheetsByVariation.get(`${itemId}:${itemVariationId}`) || []
      );
      const costAmount = activeSheet
        ? Number(activeSheet.costAmount || 0)
        : null;
      const invalidReasons = activeSheet
        ? []
        : ["Item sem ficha tecnica ativa."];

      return {
        optionId: String(row.id),
        itemId,
        itemName: row.Item?.name || "Item sem nome",
        itemSlug: row.Item?.ItemSellingInfo?.slug || null,
        itemVariationId,
        variationName: row.ItemVariation?.Variation?.name || "Sem variacao",
        variationCode: row.ItemVariation?.Variation?.code || null,
        isReference: Boolean(row.ItemVariation?.isReference),
        categoryName:
          row.Item?.ItemSellingInfo?.Category?.name ||
          row.Item?.Category?.name ||
          null,
        groupName: row.Item?.ItemSellingInfo?.ItemGroup?.name || null,
        priceAmount: Number(row.priceAmount || 0),
        costAmount,
        costSource: activeSheet ? "sheet" : "missing",
        activeSheetId: activeSheet?.id || null,
        isValidForSale: invalidReasons.length === 0,
        invalidReasons,
        tags: (row.Item?.ItemTag || [])
          .map((itemTag: any) => itemTag.Tag)
          .filter(Boolean)
          .map((tag: any) => ({
            id: String(tag.id),
            name: tag.name || "Tag sem nome",
          })),
      };
    });

    return ok({
      channels: channelOptions,
      options,
      summary: {
        totalOptions: options.length,
        missingCost: options.filter((option) => option.costAmount == null)
          .length,
        selectedChannelName: selectedChannel.name,
        targetMarginPerc: selectedChannel.targetMarginPerc,
        dnaPerc: Number(sellingPriceConfig?.dnaPercentage || 0),
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasGeradorCombosPage() {
  const loaderData = useLoaderData<typeof loader>();
  const hasLoaderError = Boolean(
    loaderData?.status && loaderData.status >= 400
  );
  const payload = (loaderData?.payload || {}) as {
    channels: ChannelOption[];
    options: ComboItemOption[];
    summary: {
      totalOptions: number;
      missingCost: number;
      selectedChannelName: string | null;
      targetMarginPerc: number;
      dnaPerc: number;
    };
  };

  const [selectedOptionId, setSelectedOptionId] = useState(
    payload.options?.[0]?.optionId || ""
  );
  const [variationFilter, setVariationFilter] = useState("__all__");
  const [lines, setLines] = useState<ComboLine[]>([]);
  const [pricingMode, setPricingMode] = useState<ComboPricingMode>(
    "PERCENTAGE_DISCOUNT"
  );
  const [discountPercentage, setDiscountPercentage] = useState("10");
  const [discountAmount, setDiscountAmount] = useState("");
  const [fixedPriceAmount, setFixedPriceAmount] = useState("");

  useEffect(() => {
    setVariationFilter("__all__");
    setPricingMode("PERCENTAGE_DISCOUNT");
    setDiscountPercentage("10");
    setDiscountAmount("");
    setFixedPriceAmount("");
    setLines([]);
  }, [payload.summary?.targetMarginPerc]);

  const variationOptions = useMemo<VariationFilterOption[]>(() => {
    const byKey = new Map<string, VariationFilterOption>();
    for (const option of payload.options || []) {
      const key =
        option.variationCode || option.variationName || option.itemVariationId;
      if (!key || byKey.has(key)) continue;
      byKey.set(key, {
        key,
        label: option.variationName || option.variationCode || "Sem variacao",
      });
    }
    return Array.from(byKey.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR")
    );
  }, [payload.options]);

  const filteredOptions = useMemo(() => {
    if (variationFilter === "__all__") return payload.options || [];
    return (payload.options || []).filter((option) => {
      const key =
        option.variationCode || option.variationName || option.itemVariationId;
      return key === variationFilter;
    });
  }, [payload.options, variationFilter]);

  const itemSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    return filteredOptions.map((option) => ({
      value: option.optionId,
      label: `${option.itemName} - ${option.variationName} - ${formatMoney(
        option.priceAmount
      )}`,
      searchText: [
        option.itemName,
        option.variationName,
        option.variationCode,
        option.itemSlug,
        option.categoryName,
        option.groupName,
        option.tags.map((tag) => tag.name).join(" "),
      ]
        .filter(Boolean)
        .join(" "),
    }));
  }, [filteredOptions]);

  useEffect(() => {
    const nextOption = filteredOptions?.[0]?.optionId || "";
    const stillAvailable = (filteredOptions || []).some(
      (option) => option.optionId === selectedOptionId
    );
    if (!stillAvailable) setSelectedOptionId(nextOption);
  }, [filteredOptions, selectedOptionId]);

  const optionById = useMemo(() => {
    return new Map(
      (payload.options || []).map((option) => [option.optionId, option])
    );
  }, [payload.options]);

  const selectedLines = useMemo(() => {
    return lines
      .map((line) => {
        const option = optionById.get(line.optionId);
        if (!option) return null;
        return { ...option, quantity: line.quantity };
      })
      .filter(Boolean) as Array<ComboItemOption & { quantity: number }>;
  }, [lines, optionById]);

  const totals = useMemo<ComboPricingAnalysis>(() => {
    return analyzeComboPricing({
      lines: selectedLines.map((line) => ({
        unitPrice: line.priceAmount,
        unitCost: line.costAmount,
        quantity: line.quantity,
        isValidForSale: line.isValidForSale,
        invalidReasons: line.invalidReasons,
      })),
      pricingMode,
      discountPercentage: parseDecimal(discountPercentage),
      discountAmount: parseDecimal(discountAmount),
      fixedPriceAmount: parseDecimal(fixedPriceAmount),
      dnaPerc: Number(payload.summary?.dnaPerc || 0),
      targetMarginPerc: Number(payload.summary?.targetMarginPerc || 0),
    });
  }, [
    discountAmount,
    discountPercentage,
    fixedPriceAmount,
    payload.summary?.dnaPerc,
    payload.summary?.targetMarginPerc,
    pricingMode,
    selectedLines,
  ]);

  const salesComparison = useMemo<ComboSalesComparison>(() => {
    return buildComboSalesComparison({
      individualTotalPrice: totals.individualTotalPrice,
      comboPrice: totals.comboPrice,
      comboTotalCost: totals.comboTotalCost,
      dnaPerc: totals.dnaPerc,
    });
  }, [
    totals.comboPrice,
    totals.comboTotalCost,
    totals.dnaPerc,
    totals.individualTotalPrice,
  ]);

  function addSelectedLine() {
    if (!selectedOptionId) return;
    setLines((current) => {
      const existing = current.find(
        (line) => line.optionId === selectedOptionId
      );
      if (existing) {
        return current.map((line) =>
          line.optionId === selectedOptionId
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [...current, { optionId: selectedOptionId, quantity: 1 }];
    });
  }

  function updateLineQuantity(optionId: string, nextQuantity: number) {
    setLines((current) =>
      current.map((line) =>
        line.optionId === optionId
          ? { ...line, quantity: Math.max(0.01, nextQuantity || 1) }
          : line
      )
    );
  }

  function removeLine(optionId: string) {
    setLines((current) => current.filter((line) => line.optionId !== optionId));
  }

  function clearLines() {
    setLines([]);
  }

  function copySimulation() {
    const text = buildCopyText({
      selectedChannelName: payload.summary?.selectedChannelName || "-",
      targetMarginPerc: totals.targetMarginPerc,
      lines: selectedLines,
      costTotal: totals.comboTotalCost,
      individualPriceTotal: totals.individualTotalPrice,
      discountPerc: totals.equivalentDiscountPercentage,
      marginPerc: totals.profitPerc,
      equivalentDiscountAmount: totals.equivalentDiscountAmount,
      dnaAmount: totals.dnaAmount,
      profitAmount: totals.profitAmount,
      breakEvenPrice: totals.breakEvenPrice,
      recommendedPrice: totals.recommendedPrice,
      status: totals.status,
      isValidForSale: totals.isValidForSale,
      invalidReasons: totals.invalidReasons,
      salesComparison,
    });
    void navigator.clipboard?.writeText(text);
  }

  function copySimulationMessage() {
    const text = buildComboShareMessage({
      selectedChannelName: payload.summary?.selectedChannelName || "-",
      lines: selectedLines,
      individualPriceTotal: totals.individualTotalPrice,
      comboPrice: totals.comboPrice,
      equivalentDiscountAmount: totals.equivalentDiscountAmount,
      equivalentDiscountPercentage: totals.equivalentDiscountPercentage,
      recommendedPrice: totals.recommendedPrice,
      status: totals.status,
    });
    void navigator.clipboard?.writeText(text);
  }

  const outletContext: AdminVendasGeradorCombosOutletContext = {
    selectedLines,
    totals,
    salesComparison,
    pricingMode,
    discountPercentage: parseDecimal(discountPercentage),
    discountAmount: parseDecimal(discountAmount),
    fixedPriceAmount: parseDecimal(fixedPriceAmount),
    copySimulationMessage,
    copySimulation,
    clearLines,
  };

  if (hasLoaderError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loaderData?.message ||
          "Nao foi possivel carregar o simulador de combos."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Badge
          variant="outline"
          className="border-sky-200 bg-sky-50 text-sky-700"
        >
          {payload.summary?.selectedChannelName || "sem canal"}
        </Badge>
        <span>{payload.summary?.totalOptions || 0} variacao(oes)</span>
        <span>·</span>
        <span>{payload.summary?.missingCost || 0} sem ficha ativa</span>
      </div>

      <section className="grid gap-x-12 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4 ">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="w-full space-y-1 xl:w-52">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Variacao
              </label>
              <Select
                value={variationFilter}
                onValueChange={setVariationFilter}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {variationOptions.map((variation) => (
                    <SelectItem key={variation.key} value={variation.key}>
                      {variation.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Item do combo
              </label>
              <SearchableSelect
                value={selectedOptionId}
                onValueChange={setSelectedOptionId}
                options={itemSelectOptions}
                placeholder={
                  filteredOptions.length === 0
                    ? "Nenhum item disponivel"
                    : "Procure um item"
                }
                searchPlaceholder="Digite nome, tag, categoria ou variacao"
                emptyText="Nenhum item encontrado."
                triggerClassName="h-10 w-full max-w-none text-sm"
                contentClassName="w-[560px]"
                renderOption={(option, selected) => {
                  const item = optionById.get(option.value);
                  return (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div
                          className={`truncate text-sm ${
                            selected
                              ? "font-semibold text-slate-950"
                              : "font-medium text-slate-800"
                          }`}
                        >
                          {item?.itemName || option.label}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {item?.variationName || "-"} ·{" "}
                          {item?.categoryName ||
                            item?.groupName ||
                            "sem categoria"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <div className="font-semibold text-slate-900">
                          {formatMoney(item?.priceAmount)}
                        </div>
                        <div className="text-slate-500">
                          ficha {formatMoney(item?.costAmount)}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
            <Button
              type="button"
              onClick={addSelectedLine}
              className="gap-2"
              disabled={!selectedOptionId || filteredOptions.length === 0}
            >
              <Plus className="h-4 w-4" />
              adicionar
            </Button>
          </div>

          <div className="rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-28 text-right">Qtd.</TableHead>
                  <TableHead className="w-32 text-right">Preco unit.</TableHead>
                  <TableHead className="w-36 text-right">Ficha unit.</TableHead>
                  <TableHead className="w-20 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedLines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      Adicione itens para calcular o combo.
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedLines.map((line) => (
                    <TableRow key={line.optionId}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {line.itemName}
                            </span>
                            {line.isReference ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700"
                              >
                                referencia
                              </Badge>
                            ) : null}
                            {line.costSource === "missing" ? (
                              <Badge
                                variant="outline"
                                className="border-amber-200 bg-amber-50 text-amber-700"
                              >
                                sem ficha ativa
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{line.variationName}</span>
                            {line.categoryName ? (
                              <span>· {line.categoryName}</span>
                            ) : null}
                            {line.groupName ? (
                              <span>· {line.groupName}</span>
                            ) : null}
                            <Link
                              to={`/admin/items/${line.itemId}/venda`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900"
                            >
                              venda
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLineQuantity(
                              line.optionId,
                              Number(event.currentTarget.value)
                            )
                          }
                          className="ml-auto h-8 w-20 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-800">
                        {formatMoney(line.priceAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-800">
                        {formatMoney(line.costAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => removeLine(line.optionId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <aside className="space-y-3">
          <section className="space-y-3 ">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Preco do combo
              </h2>
              <p className="text-xs text-slate-500">
                Controle comum para a precificacao e o simulador de venda.
              </p>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">
                Modo de preco
              </span>
              <Select
                value={pricingMode}
                onValueChange={(value) =>
                  setPricingMode(value as ComboPricingMode)
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE_DISCOUNT">
                    Desconto percentual
                  </SelectItem>
                  <SelectItem value="FIXED_DISCOUNT">Desconto fixo</SelectItem>
                  <SelectItem value="FIXED_PRICE">Preco fixo</SelectItem>
                </SelectContent>
              </Select>
            </label>

            {pricingMode === "PERCENTAGE_DISCOUNT" ? (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Desconto (%)
                </span>
                <Input
                  value={discountPercentage}
                  onChange={(event) =>
                    setDiscountPercentage(event.currentTarget.value)
                  }
                  className="h-9"
                />
              </label>
            ) : null}

            {pricingMode === "FIXED_DISCOUNT" ? (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Desconto fixo
                </span>
                <Input
                  value={discountAmount}
                  onChange={(event) =>
                    setDiscountAmount(event.currentTarget.value)
                  }
                  className="h-9"
                />
              </label>
            ) : null}

            {pricingMode === "FIXED_PRICE" ? (
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Preco fixo
                </span>
                <Input
                  value={fixedPriceAmount}
                  onChange={(event) =>
                    setFixedPriceAmount(event.currentTarget.value)
                  }
                  className="h-9"
                />
              </label>
            ) : null}
          </section>

          <nav className="flex flex-wrap items-center gap-8 border-b border-slate-200">
            {resultTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  [
                    "inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition",
                    isActive
                      ? "border-sky-500 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700",
                  ].join(" ")
                }
              >
                <span className={`size-2 rounded-full ${tab.dotClassName}`} />
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <Outlet context={outletContext} />
        </aside>
      </section>
    </div>
  );
}
