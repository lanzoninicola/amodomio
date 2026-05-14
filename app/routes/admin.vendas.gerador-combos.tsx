import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import {
  Calculator,
  ChevronLeft,
  Copy,
  ExternalLink,
  ListFilter,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "~/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { pickLatestActiveSheet } from "~/domain/item/item-selling-price-calculation.server";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ChannelOption = {
  id: string;
  key: string;
  name: string;
  targetMarginPerc: number;
  taxPerc: number;
  isMarketplace: boolean;
};

type TagOption = {
  id: string;
  name: string;
};

type ComboItemOption = {
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
  costSource: "sheet" | "variation" | "missing";
  activeSheetId: string | null;
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

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return BRL_FORMATTER.format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

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
  suggestedPrice: number;
  discountPerc: number | null;
  marginPerc: number | null;
}) {
  const lineText = params.lines
    .map((line) => {
      return `- ${line.quantity}x ${line.itemName} (${line.variationName}) - preco unit. ${formatMoney(line.priceAmount)} - custo unit. ${formatMoney(line.costAmount)}`;
    })
    .join("\n");

  return [
    "Simulacao de combo",
    `Canal: ${params.selectedChannelName}`,
    `Margem alvo: ${formatPercent(params.targetMarginPerc)}`,
    "",
    lineText || "- Nenhum item selecionado",
    "",
    `Custo total: ${formatMoney(params.costTotal)}`,
    `Soma individual: ${formatMoney(params.individualPriceTotal)}`,
    `Preco sugerido: ${formatMoney(params.suggestedPrice)}`,
    `Desconto equivalente: ${formatPercent(params.discountPerc)}`,
    `Margem simulada: ${formatPercent(params.marginPerc)}`,
  ].join("\n");
}

export const meta: MetaFunction = () => [
  { title: "Vendas | Gerador de combos" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const tagId = String(url.searchParams.get("tagId") || "").trim();
    const selectedChannelKeyParam = String(url.searchParams.get("channel") || "").trim().toLowerCase();

    const [channels, tags] = await Promise.all([
      db.itemSellingChannel.findMany({
        select: {
          id: true,
          key: true,
          name: true,
          targetMarginPerc: true,
          taxPerc: true,
          isMarketplace: true,
          sortOrderIndex: true,
        },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
      db.tag.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
      }),
    ]);

    const channelOptions: ChannelOption[] = (channels || []).map((channel: any) => ({
      id: String(channel.id),
      key: String(channel.key || "").toLowerCase(),
      name: channel.name || String(channel.key || "").toUpperCase(),
      targetMarginPerc: Number(channel.targetMarginPerc || 0),
      taxPerc: Number(channel.taxPerc || 0),
      isMarketplace: Boolean(channel.isMarketplace),
    }));

    const selectedChannel =
      channelOptions.find((channel) => channel.key === selectedChannelKeyParam) ||
      channelOptions.find((channel) => channel.key === "cardapio") ||
      channelOptions[0] ||
      null;

    const selectedTag = (tags || []).find((tag: any) => String(tag.id) === tagId) || null;

    if (!selectedChannel) {
      return ok({
        filters: { tagId: "", channel: "" },
        channels: [],
        tags: [],
        options: [],
        summary: { totalOptions: 0, missingCost: 0, selectedChannelName: null, targetMarginPerc: 0 },
      });
    }

    const itemWhere: any = {
      canSell: true,
      active: true,
      ItemSellingInfo: {
        is: {
          upcoming: false,
        },
      },
      ItemSellingChannelItem: {
        some: {
          itemSellingChannelId: selectedChannel.id,
          visible: true,
        },
      },
    };

    const and: any[] = [];
    if (selectedTag) {
      and.push({
        ItemTag: {
          some: {
            tagId: String(selectedTag.id),
            deletedAt: null,
          },
        },
      });
    }
    if (and.length > 0) itemWhere.AND = and;

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
            ItemCostVariation: {
              select: {
                costAmount: true,
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

    const itemIds = Array.from(new Set((priceRows || []).map((row: any) => String(row.itemId)).filter(Boolean)));
    const itemVariationIds = Array.from(
      new Set((priceRows || []).map((row: any) => String(row.itemVariationId)).filter(Boolean))
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
      const activeSheet = pickLatestActiveSheet(activeSheetsByVariation.get(`${itemId}:${itemVariationId}`) || []);
      const fallbackCost = row.ItemVariation?.ItemCostVariation?.costAmount;
      const costAmount = activeSheet
        ? Number(activeSheet.costAmount || 0)
        : fallbackCost == null
          ? null
          : Number(fallbackCost || 0);

      return {
        optionId: String(row.id),
        itemId,
        itemName: row.Item?.name || "Item sem nome",
        itemSlug: row.Item?.ItemSellingInfo?.slug || null,
        itemVariationId,
        variationName: row.ItemVariation?.Variation?.name || "Sem variacao",
        variationCode: row.ItemVariation?.Variation?.code || null,
        isReference: Boolean(row.ItemVariation?.isReference),
        categoryName: row.Item?.ItemSellingInfo?.Category?.name || row.Item?.Category?.name || null,
        groupName: row.Item?.ItemSellingInfo?.ItemGroup?.name || null,
        priceAmount: Number(row.priceAmount || 0),
        costAmount,
        costSource: activeSheet ? "sheet" : costAmount == null ? "missing" : "variation",
        activeSheetId: activeSheet?.id || null,
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
      filters: {
        tagId: selectedTag ? String(selectedTag.id) : "",
        channel: selectedChannel.key,
      },
      channels: channelOptions,
      tags: (tags || []).map((tag: any) => ({ id: String(tag.id), name: tag.name || "Tag sem nome" })),
      options,
      summary: {
        totalOptions: options.length,
        missingCost: options.filter((option) => option.costAmount == null).length,
        selectedChannelName: selectedChannel.name,
        targetMarginPerc: selectedChannel.targetMarginPerc,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasGeradorCombosPage() {
  const loaderData = useLoaderData<typeof loader>();
  const hasLoaderError = Boolean(loaderData?.status && loaderData.status >= 400);
  const payload = (loaderData?.payload || {}) as {
    filters: { tagId: string; channel: string };
    channels: ChannelOption[];
    tags: TagOption[];
    options: ComboItemOption[];
    summary: {
      totalOptions: number;
      missingCost: number;
      selectedChannelName: string | null;
      targetMarginPerc: number;
    };
  };

  const [selectedOptionId, setSelectedOptionId] = useState(payload.options?.[0]?.optionId || "");
  const [variationFilter, setVariationFilter] = useState("__all__");
  const [lines, setLines] = useState<ComboLine[]>([]);
  const [targetMargin, setTargetMargin] = useState(String(payload.summary?.targetMarginPerc || 30));
  const [manualPrice, setManualPrice] = useState("");

  useEffect(() => {
    setVariationFilter("__all__");
    setTargetMargin(String(payload.summary?.targetMarginPerc || 30));
    setManualPrice("");
    setLines([]);
  }, [payload.filters?.channel, payload.summary?.targetMarginPerc]);

  const variationOptions = useMemo<VariationFilterOption[]>(() => {
    const byKey = new Map<string, VariationFilterOption>();
    for (const option of payload.options || []) {
      const key = option.variationCode || option.variationName || option.itemVariationId;
      if (!key || byKey.has(key)) continue;
      byKey.set(key, {
        key,
        label: option.variationName || option.variationCode || "Sem variacao",
      });
    }
    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [payload.options]);

  const filteredOptions = useMemo(() => {
    if (variationFilter === "__all__") return payload.options || [];
    return (payload.options || []).filter((option) => {
      const key = option.variationCode || option.variationName || option.itemVariationId;
      return key === variationFilter;
    });
  }, [payload.options, variationFilter]);

  const itemSelectOptions = useMemo<SearchableSelectOption[]>(() => {
    return filteredOptions.map((option) => ({
      value: option.optionId,
      label: `${option.itemName} - ${option.variationName} - ${formatMoney(option.priceAmount)}`,
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
    const stillAvailable = (filteredOptions || []).some((option) => option.optionId === selectedOptionId);
    if (!stillAvailable) setSelectedOptionId(nextOption);
  }, [filteredOptions, selectedOptionId]);

  const optionById = useMemo(() => {
    return new Map((payload.options || []).map((option) => [option.optionId, option]));
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

  const totals = useMemo(() => {
    const costTotal = selectedLines.reduce((sum, line) => sum + Number(line.costAmount || 0) * line.quantity, 0);
    const individualPriceTotal = selectedLines.reduce((sum, line) => sum + Number(line.priceAmount || 0) * line.quantity, 0);
    const targetMarginPerc = parseDecimal(targetMargin);
    const marginRate = Math.min(Math.max(targetMarginPerc, 0), 95) / 100;
    const suggestedPrice = marginRate >= 1 ? 0 : costTotal / (1 - marginRate);
    const manualPriceValue = parseDecimal(manualPrice);
    const comboPrice = manualPriceValue > 0 ? manualPriceValue : suggestedPrice;
    const discountPerc = individualPriceTotal > 0 ? (1 - comboPrice / individualPriceTotal) * 100 : null;
    const marginPerc = comboPrice > 0 ? ((comboPrice - costTotal) / comboPrice) * 100 : null;

    return {
      costTotal,
      individualPriceTotal,
      suggestedPrice,
      comboPrice,
      discountPerc,
      marginPerc,
      targetMarginPerc,
    };
  }, [manualPrice, selectedLines, targetMargin]);

  function addSelectedLine() {
    if (!selectedOptionId) return;
    setLines((current) => {
      const existing = current.find((line) => line.optionId === selectedOptionId);
      if (existing) {
        return current.map((line) =>
          line.optionId === selectedOptionId ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { optionId: selectedOptionId, quantity: 1 }];
    });
  }

  function updateLineQuantity(optionId: string, nextQuantity: number) {
    setLines((current) =>
      current.map((line) =>
        line.optionId === optionId ? { ...line, quantity: Math.max(0.01, nextQuantity || 1) } : line
      )
    );
  }

  function removeLine(optionId: string) {
    setLines((current) => current.filter((line) => line.optionId !== optionId));
  }

  function copySimulation() {
    const text = buildCopyText({
      selectedChannelName: payload.summary?.selectedChannelName || "-",
      targetMarginPerc: totals.targetMarginPerc,
      lines: selectedLines,
      costTotal: totals.costTotal,
      individualPriceTotal: totals.individualPriceTotal,
      suggestedPrice: totals.suggestedPrice,
      discountPerc: totals.discountPerc,
      marginPerc: totals.marginPerc,
    });
    void navigator.clipboard?.writeText(text);
  }

  if (hasLoaderError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {loaderData?.message || "Nao foi possivel carregar o gerador de combos."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="space-y-5 border-b border-slate-200/80 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin/vendas/itens-vendidos"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">vendas</span>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">Gerador de combos</h1>
              <p className="text-sm text-slate-500">
                Simule composicoes com itens vendaveis, custo atual, preco do canal e margem alvo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              {payload.summary?.selectedChannelName || "sem canal"}
            </Badge>
            <span>{payload.summary?.totalOptions || 0} variacao(oes)</span>
            <span>·</span>
            <span>{payload.summary?.missingCost || 0} sem custo</span>
          </div>
        </div>
      </section>

      <Form method="get" className="flex flex-wrap items-center gap-5">
        <Select name="channel" defaultValue={payload.filters?.channel || ""}>
          <SelectTrigger className="h-auto w-auto min-w-[150px] gap-1 border-0 p-0 text-sm font-medium text-blue-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-blue-400">
            <SelectValue placeholder="canal" />
          </SelectTrigger>
          <SelectContent>
            {(payload.channels || []).map((channel) => (
              <SelectItem key={channel.key} value={channel.key}>{channel.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select name="tagId" defaultValue={payload.filters?.tagId || "__all__"}>
          <SelectTrigger className="h-auto w-auto min-w-[150px] gap-1 border-0 p-0 text-sm font-medium text-slate-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-slate-400">
            <SelectValue placeholder="todas as tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">todas as tags</SelectItem>
            {(payload.tags || []).map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" variant="ghost" size="sm" className="gap-1 text-slate-600">
          <ListFilter className="h-3.5 w-3.5" />
          filtros
        </Button>

        <Link to="/admin/vendas/gerador-combos" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
          <XCircle className="h-3.5 w-3.5" />
          limpar filtros
        </Link>
      </Form>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4 ">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="w-full space-y-1 xl:w-52">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Variacao
              </label>
              <Select value={variationFilter} onValueChange={setVariationFilter}>
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
                placeholder={filteredOptions.length === 0 ? "Nenhum item disponivel" : "Procure um item"}
                searchPlaceholder="Digite nome, tag, categoria ou variacao"
                emptyText="Nenhum item encontrado."
                triggerClassName="h-10 w-full max-w-none text-sm"
                contentClassName="w-[560px]"
                renderOption={(option, selected) => {
                  const item = optionById.get(option.value);
                  return (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className={`truncate text-sm ${selected ? "font-semibold text-slate-950" : "font-medium text-slate-800"}`}>
                          {item?.itemName || option.label}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {item?.variationName || "-"} · {item?.categoryName || item?.groupName || "sem categoria"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <div className="font-semibold text-slate-900">{formatMoney(item?.priceAmount)}</div>
                        <div className="text-slate-500">custo {formatMoney(item?.costAmount)}</div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
            <Button type="button" onClick={addSelectedLine} className="gap-2" disabled={!selectedOptionId || filteredOptions.length === 0}>
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
                  <TableHead className="w-32 text-right">Custo unit.</TableHead>
                  <TableHead className="w-20 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      Adicione itens para calcular o combo.
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedLines.map((line) => (
                    <TableRow key={line.optionId}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{line.itemName}</span>
                            {line.isReference ? (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">referencia</Badge>
                            ) : null}
                            {line.costSource === "missing" ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">sem custo</Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{line.variationName}</span>
                            {line.categoryName ? <span>· {line.categoryName}</span> : null}
                            {line.groupName ? <span>· {line.groupName}</span> : null}
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
                          onChange={(event) => updateLineQuantity(line.optionId, Number(event.currentTarget.value))}
                          className="ml-auto h-8 w-20 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-800">{formatMoney(line.priceAmount)}</TableCell>
                      <TableCell className="text-right font-medium text-slate-800">{formatMoney(line.costAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => removeLine(line.optionId)}>
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

        <aside className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Calculator className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Resultado</h2>
              <p className="text-xs text-slate-500">Simulacao local, sem gravar combo.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Margem alvo (%)</span>
              <Input value={targetMargin} onChange={(event) => setTargetMargin(event.currentTarget.value)} className="h-9" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Preco manual</span>
              <Input value={manualPrice} onChange={(event) => setManualPrice(event.currentTarget.value)} placeholder="opcional" className="h-9" />
            </label>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
            <MetricRow label="Custo total" value={formatMoney(totals.costTotal)} strong />
            <MetricRow label="Soma individual" value={formatMoney(totals.individualPriceTotal)} />
            <MetricRow label="Preco sugerido" value={formatMoney(totals.suggestedPrice)} strong />
            <MetricRow label="Preco simulado" value={formatMoney(totals.comboPrice)} />
            <MetricRow label="Desconto equivalente" value={formatPercent(totals.discountPerc)} />
            <MetricRow
              label="Margem simulada"
              value={formatPercent(totals.marginPerc)}
              valueClassName={(totals.marginPerc || 0) >= totals.targetMarginPerc ? "text-emerald-700" : "text-amber-700"}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copySimulation} disabled={selectedLines.length === 0}>
              <Copy className="h-3.5 w-3.5" />
              copiar resumo
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-slate-500" onClick={() => setLines([])} disabled={selectedLines.length === 0}>
              limpar combo
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricRow({
  label,
  value,
  strong,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`${strong ? "text-base font-semibold" : "font-medium"} ${valueClassName}`}>{value}</span>
    </div>
  );
}
