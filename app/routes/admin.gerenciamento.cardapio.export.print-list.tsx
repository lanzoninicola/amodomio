import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import type { MenuItemSellingChannel, MenuItemSize } from "@prisma/client";
import type { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { menuItemSellingChannelPrismaEntity } from "~/domain/cardapio/menu-item-selling-channel.entity.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import formatDecimalPlaces from "~/utils/format-decimal-places";

type LoaderData = {
  items: MenuItemWithSellPriceVariations[];
  sizes: MenuItemSize[];
  channels: MenuItemSellingChannel[];
};
type ItemWithVariation = {
  item: MenuItemWithSellPriceVariations;
  variation: MenuItemWithSellPriceVariations["sellPriceVariations"][number];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [items, sizes, channels] = await Promise.all([
    menuItemSellingPriceHandler.loadMany({}),
    menuItemSizePrismaEntity.findAll(),
    menuItemSellingChannelPrismaEntity.findAll(),
  ]);

  return json<LoaderData>({ items, sizes, channels });
};

export default function AdminGerenciamentoCardapioExportPrintList() {
  const { items, sizes, channels } = useLoaderData<typeof loader>();
  const defaultSizeId =
    sizes.find((size) => size.key === "pizza-medium")?.id ?? sizes[0]?.id ?? "";
  const [sizeId, setSizeId] = useState(defaultSizeId);
  const [channelKey, setChannelKey] = useState(channels[0]?.key ?? "");
  const [groupMode, setGroupMode] = useState<"none" | "profit">("none");
  const [profitOrder, setProfitOrder] = useState<"asc" | "desc">("asc");
  const [onlyBelowTarget, setOnlyBelowTarget] = useState(false);

  const filteredItems = useMemo(() => {
    const results = items
      .filter((item) => item.active && item.visible)
      .map((item) => {
        const variation = item.sellPriceVariations.find(
          (v) => v.sizeId === sizeId && v.channelKey === channelKey
        );

        return variation ? { item, variation } : null;
      })
      .filter((entry): entry is ItemWithVariation => Boolean(entry))
      .sort((a, b) => (a.item.sortOrderIndex ?? 0) - (b.item.sortOrderIndex ?? 0));
    if (!onlyBelowTarget) return results;
    const filtered = results.filter((entry) => {
      const lucroPerc = Number(entry.variation.profitActualPerc ?? 0);
      const lucroAlvo = Number(entry.variation.profitExpectedPerc ?? 0);
      return lucroPerc < lucroAlvo;
    });
    return filtered;
  }, [items, sizeId, channelKey, onlyBelowTarget]);

  const orderedItems = useMemo(() => {
    if (groupMode !== "none") return filteredItems;
    const sorted = [...filteredItems].sort((a, b) => {
      const lucroA = Number(a.variation.profitActualPerc ?? 0);
      const lucroB = Number(b.variation.profitActualPerc ?? 0);
      return profitOrder === "asc" ? lucroA - lucroB : lucroB - lucroA;
    });
    return sorted;
  }, [filteredItems, groupMode, profitOrder]);

  const groupedByProfit = useMemo(() => {
    const groups: Record<string, ItemWithVariation[]> = {
      "<0%": [],
      "<=5%": [],
      "<=10%": [],
      "<=15%": [],
      ">15%": [],
    };

    filteredItems.forEach((entry) => {
      const lucroPerc = Number(entry.variation.profitActualPerc ?? 0);
      if (lucroPerc < 0) groups["<0%"].push(entry);
      else if (lucroPerc <= 5) groups["<=5%"].push(entry);
      else if (lucroPerc <= 10) groups["<=10%"].push(entry);
      else if (lucroPerc <= 15) groups["<=15%"].push(entry);
      else groups[">15%"].push(entry);
    });

    return groups;
  }, [filteredItems]);

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @page {
          size: A4;
          margin: 12mm 10mm;
        }
        @media print {
          .print-hide { display: none !important; }
          .print-columns {
            display: block;
            column-count: 2;
            column-gap: 16px;
          }
          .print-item {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-group {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-sheet {
            padding: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="print-hide">
        <Card>
          <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Cardápio para impressão</CardTitle>
              <CardDescription>
                Selecione o tamanho e imprima em A4, duas colunas.
              </CardDescription>
            </div>
            <Button onClick={() => window.print()}>Imprimir</Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Tamanho</Label>
                <Select value={sizeId} onValueChange={(value) => setSizeId(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        {size.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Canal de venda</Label>
                <Select value={channelKey} onValueChange={(value) => setChannelKey(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.key}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex flex-col gap-2">
                <Label>Organizar lista</Label>
                <Select value={groupMode} onValueChange={(value) => setGroupMode(value as typeof groupMode)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem agrupamento</SelectItem>
                    <SelectItem value="profit">Agrupar por lucro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {groupMode === "none" && (
                <div className="flex flex-col gap-2">
                  <Label>Ordenar por lucro</Label>
                  <Select
                    value={profitOrder}
                    onValueChange={(value) => setProfitOrder(value as typeof profitOrder)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Crescente</SelectItem>
                      <SelectItem value="desc">Decrescente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="only-below-target"
                  checked={onlyBelowTarget}
                  onCheckedChange={(value) => setOnlyBelowTarget(Boolean(value))}
                />
                <Label htmlFor="only-below-target">
                  Imprimir apenas abaixo do lucro desejado
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="print-sheet rounded-md border p-4 print:border-0 print:p-0">
        <div className="mb-3 hidden text-center text-xs font-semibold uppercase tracking-wide print:block">
          {`Cardápio - ${sizes.find((size) => size.id === sizeId)?.name || "Tamanho"}`}
          {onlyBelowTarget ? " • abaixo do lucro desejado" : ""}
        </div>
        <div className="print-columns columns-1 gap-3 md:columns-2 md:[column-gap:48px]">
          {orderedItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum item disponível para este tamanho.</div>
          ) : groupMode === "profit" ? (
            Object.entries(groupedByProfit).map(([label, group]) => (
              <div key={label} className="print-group mb-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                  Lucro {label}
                </div>
                <div className="flex flex-col gap-3">
                  {group.map(({ item, variation }) => {
                    const cspb = variation.computedSellingPriceBreakdown;
                    const custoFT = Number(cspb?.custoFichaTecnica ?? 0);
                    const custoDesperdicio = Number(cspb?.wasteCost ?? 0);
                    const custoMassa = Number(cspb?.doughCostAmount ?? 0);
                    const custoEmbalagem = Number(cspb?.packagingCostAmount ?? 0);
                    const custoTotal = custoFT + custoDesperdicio + custoMassa + custoEmbalagem;
                    const breakEven = Number(cspb?.minimumPrice?.priceAmount.breakEven ?? 0);
                    const lucroPerc = Number(variation.profitActualPerc ?? 0);
                    const lucroValor = (Number(variation.priceAmount ?? 0) * lucroPerc) / 100;

                    return (
                      <div key={`${item.menuItemId}-${variation.sizeId}`} className="print-item">
                        <div className="flex items-baseline justify-between gap-3 text-foreground">
                          <div className="text-sm font-semibold uppercase">{item.name}</div>
                          <div className="text-[11px]">
                            <span>
                              BE: R$ {formatDecimalPlaces(breakEven)}
                            </span>{" "}
                            ·{" "}
                            <span>
                              PDV: R$ {formatDecimalPlaces(variation.priceAmount || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold text-foreground">
                          {`Lucro: ${formatDecimalPlaces(lucroPerc)}% (R$ ${formatDecimalPlaces(lucroValor)})`}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          FT: R$ {formatDecimalPlaces(custoFT)} · CT: R$ {formatDecimalPlaces(custoTotal)}
                        </div>
                        <div className="text-[11px] text-foreground">
                          {item.ingredients?.trim() ? item.ingredients : "Ingredientes não cadastrados."}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            orderedItems.map(({ item, variation }) => {
              const cspb = variation.computedSellingPriceBreakdown;
              const custoFT = Number(cspb?.custoFichaTecnica ?? 0);
              const custoDesperdicio = Number(cspb?.wasteCost ?? 0);
              const custoMassa = Number(cspb?.doughCostAmount ?? 0);
              const custoEmbalagem = Number(cspb?.packagingCostAmount ?? 0);
              const custoTotal = custoFT + custoDesperdicio + custoMassa + custoEmbalagem;
              const breakEven = Number(cspb?.minimumPrice?.priceAmount.breakEven ?? 0);
              const lucroPerc = Number(variation.profitActualPerc ?? 0);
              const lucroValor = (Number(variation.priceAmount ?? 0) * lucroPerc) / 100;

              return (
                <div key={`${item.menuItemId}-${variation.sizeId}`} className="print-item">
                  <div className="flex items-baseline justify-between gap-3 text-foreground">
                    <div className="text-sm font-semibold uppercase">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="text-foreground">
                        BE: R$ {formatDecimalPlaces(breakEven)}
                      </span>{" "}
                      ·{" "}
                      <span className="text-foreground">
                        PDV: R$ {formatDecimalPlaces(variation.priceAmount || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-foreground">
                    {`Lucro: ${formatDecimalPlaces(lucroPerc)}% (R$ ${formatDecimalPlaces(lucroValor)})`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    FT: R$ {formatDecimalPlaces(custoFT)} · CT: R$ {formatDecimalPlaces(custoTotal)}
                  </div>
                  <div className="text-[11px] text-foreground">
                    {item.ingredients?.trim() ? item.ingredients : "Ingredientes não cadastrados."}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
