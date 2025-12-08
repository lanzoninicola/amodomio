import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import type { MenuItemSellingChannel, MenuItemSize } from "@prisma/client";
import type { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { menuItemSellingChannelPrismaEntity } from "~/domain/cardapio/menu-item-selling-channel.entity.server";
import responseCSV from "~/domain/export-csv/functions/response-csv";
import { badRequest } from "~/utils/http-response.server";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type LoaderData = {
  items: MenuItemWithSellPriceVariations[];
  sizes: MenuItemSize[];
  channels: MenuItemSellingChannel[];
};

type ExportRow = {
  id: string;
  item: string;
  categoria: string;
  canal: string;
  tamanho: string;
  preco: number;
  lucroEfetivoPerc: number;
  lucroEfetivoValor: number;
  precoAlvoLucroTarget: number;
  custoTotal: number;
  custoFichaTecnica: number;
};

type ExportJsonItem = {
  id: string;
  item: string;
  categoria: string;
  canal: string;
  sortOrderIndex: number | null;
  variacoes: Array<{
    tamanho: string;
    preco: number;
    lucroEfetivoPerc: number;
    lucroEfetivoValor: number;
    precoAlvoLucroTarget: number;
    custoTotal: number;
    custoFichaTecnica: number;
  }>;
};

const buildExportRows = (items: MenuItemWithSellPriceVariations[], channelKey: string) => {
  const rows: ExportRow[] = [];

  items.forEach((item) => {
    item.sellPriceVariations
      .filter((v) => v.channelKey === channelKey)
      .forEach((variation) => {
        const cspb = variation.computedSellingPriceBreakdown;
        const costFT = Number(cspb?.custoFichaTecnica ?? 0);
        const costDesperdicio = Number(cspb?.wasteCost ?? 0);
        const costMassa = Number(cspb?.doughCostAmount ?? 0);
        const costEmbalagem = Number(cspb?.packagingCostAmount ?? 0);
        const minBreakEven = Number(cspb?.minimumPrice?.priceAmount.breakEven ?? 0);
        const precoAlvoComLucro = Number(cspb?.minimumPrice?.priceAmount.withProfit ?? 0);
        const preco = Number(variation.priceAmount ?? 0);
        const lucroPerc = Number(variation.profitActualPerc ?? 0);
        const lucroValor = preco * (lucroPerc / 100);

        rows.push({
          id: item.menuItemId,
          item: item.name,
          categoria: item.category?.name ?? "",
          canal: variation.channelName,
          tamanho: variation.sizeName,
          preco: formatDecimalPlaces(preco),
          lucroEfetivoPerc: formatDecimalPlaces(lucroPerc),
          lucroEfetivoValor: formatDecimalPlaces(lucroValor),
          precoAlvoLucroTarget: formatDecimalPlaces(precoAlvoComLucro),
          // custo total = preço mínimo para break-even (inclui fixos/variáveis)
          custoTotal: formatDecimalPlaces(minBreakEven),
          custoFichaTecnica: formatDecimalPlaces(costFT),
        });
      });
  });

  return rows;
};

const buildExportCsvRows = (rows: ExportRow[]) =>
  rows.map((row) => ({
    Item: row.item,
    Categoria: row.categoria,
    Canal: row.canal,
    Tamanho: row.tamanho,
    Preco: row.preco,
    "Lucro efetivo (%)": row.lucroEfetivoPerc,
    "Lucro efetivo (R$)": row.lucroEfetivoValor,
    "Preço alvo (lucro target)": row.precoAlvoLucroTarget,
    "Custo FT": row.custoFichaTecnica,
  }));

const buildExportJson = (items: MenuItemWithSellPriceVariations[], channelKey: string): ExportJsonItem[] => {
  return items
    .map((item) => {
      const variacoes = item.sellPriceVariations
        .filter((v) => v.channelKey === channelKey)
        .map((variation) => {
          const cspb = variation.computedSellingPriceBreakdown;
          const costFT = Number(cspb?.custoFichaTecnica ?? 0);
          const costDesperdicio = Number(cspb?.wasteCost ?? 0);
          const costMassa = Number(cspb?.doughCostAmount ?? 0);
          const costEmbalagem = Number(cspb?.packagingCostAmount ?? 0);
          const minBreakEven = Number(cspb?.minimumPrice?.priceAmount.breakEven ?? 0);
          const precoAlvoComLucro = Number(cspb?.minimumPrice?.priceAmount.withProfit ?? 0);
          const preco = Number(variation.priceAmount ?? 0);
          const lucroPerc = Number(variation.profitActualPerc ?? 0);
          const lucroValor = preco * (lucroPerc / 100);

          return {
            tamanho: variation.sizeName,
            preco: formatDecimalPlaces(preco),
            lucroEfetivoPerc: formatDecimalPlaces(lucroPerc),
            lucroEfetivoValor: formatDecimalPlaces(lucroValor),
            precoAlvoLucroTarget: formatDecimalPlaces(precoAlvoComLucro),
            custoTotal: formatDecimalPlaces(minBreakEven),
            custoFichaTecnica: formatDecimalPlaces(costFT),
          };
        });

      const channelName =
        item.sellPriceVariations.find((v) => v.channelKey === channelKey)?.channelName ?? "";

      return {
        id: item.menuItemId,
        item: item.name,
        categoria: item.category?.name ?? "",
        canal: channelName,
        sortOrderIndex: item.sortOrderIndex ?? null,
        variacoes,
      };
    })
    .filter((item) => item.variacoes.length > 0);
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const channelFromQuery = url.searchParams.get("channelKey") ?? undefined;

  const [items, sizes, channels] = await Promise.all([
    menuItemSellingPriceHandler.loadMany({}),
    menuItemSizePrismaEntity.findAll(),
    menuItemSellingChannelPrismaEntity.findAll(),
  ]);

  if (!channels.length) {
    return badRequest("Nenhum canal de venda configurado");
  }

  const selectedChannel = channelFromQuery || channels[0].key;
  const exportRows = buildExportRows(items, selectedChannel);
  const exportCsvRows = buildExportCsvRows(exportRows);

  if (format === "csv") {
    return responseCSV(exportCsvRows as []);
  }

  if (format === "json") {
    const jsonData = buildExportJson(items, selectedChannel);
    return new Response(JSON.stringify(jsonData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="menu-items-prices.json"',
      },
    });
  }

  return json<LoaderData>({ items, sizes, channels });
};

export default function AdminGerenciamentoCardapioExportMenuItemsPriceVariations() {
  const { items, sizes, channels } = useLoaderData<typeof loader>();
  const [channelKey, setChannelKey] = useState(channels[0]?.key ?? "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "paused" | "inactive" | "all">("active");

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesName = term.length === 0 || item.name.toLowerCase().includes(term);
      const hasChannel = item.sellPriceVariations.some((v) => v.channelKey === channelKey);
      let matchesStatus = true;
      if (statusFilter === "active") matchesStatus = item.visible === true && item.active === true;
      if (statusFilter === "paused") matchesStatus = item.active === true && item.visible === false;
      if (statusFilter === "inactive") matchesStatus = item.active === false;
      return matchesName && hasChannel && matchesStatus;
    });
  }, [items, search, channelKey, statusFilter]);

  const exportRows = useMemo(() => buildExportRows(filteredItems, channelKey), [filteredItems, channelKey]);
  const exportCsvRows = useMemo(() => buildExportCsvRows(exportRows), [exportRows]);
  const exportJson = useMemo(() => buildExportJson(filteredItems, channelKey), [filteredItems, channelKey]);

  const handleDownload = (format: "csv" | "json") => {
    if (!exportRows.length) return;

    if (format === "csv") {
      const csv = Papa.unparse(exportCsvRows, { header: true, delimiter: ";" });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "menu-items-prices.csv";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const blob = new Blob([JSON.stringify(exportJson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "menu-items-prices.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Preços de venda</h1>
          <p className="text-sm text-muted-foreground">
            Visualize preços, custos e lucro por canal/tamanho e exporte em CSV (Excel) ou JSON (IA).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleDownload("json")}>
            Exportar JSON
          </Button>
          <Button onClick={() => handleDownload("csv")}>Exportar CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

        <div className="flex flex-col gap-2">
          <Label>Filtrar visibilidade</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar vendas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Venda ativa</SelectItem>
              <SelectItem value="paused">Venda pausada</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 md:col-span-1">
          <Label>Filtrar por nome</Label>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar sabor..."
          />
        </div>
      </div>

      <div className="overflow-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">
                Item
              </th>
              {sizes.map((size) => (
                <th
                  key={size.id}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                >
                  {size.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={sizes.length + 1}>
                  Nenhum item encontrado para este canal.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.menuItemId} className="border-t">
                  <td className="px-3 py-2 text-sm font-medium">{item.name}</td>
                  {sizes.map((size) => {
                    const variation = item.sellPriceVariations.find(
                      (v) => v.sizeId === size.id && v.channelKey === channelKey
                    );
                    if (!variation) {
                      return (
                        <td key={size.id} className="px-3 py-2 text-sm text-muted-foreground">
                          —
                        </td>
                      );
                    }

                    const cspb = variation.computedSellingPriceBreakdown;
                    const custoFT = Number(cspb?.custoFichaTecnica ?? 0);
                    const custoDesperdicio = Number(cspb?.wasteCost ?? 0);
                    const custoMassa = Number(cspb?.doughCostAmount ?? 0);
                    const custoEmbalagem = Number(cspb?.packagingCostAmount ?? 0);
                    // custo total = preço mínimo break-even (inclui fixos/variáveis)
                    const minBreak = Number(cspb?.minimumPrice?.priceAmount.breakEven ?? 0);
                    const precoAlvoLucro = Number(cspb?.minimumPrice?.priceAmount.withProfit ?? 0);
                    const custoTotal = minBreak;
                    const lucroPerc = Number(variation.profitActualPerc ?? 0);
                    const lucroValor = (Number(variation.priceAmount ?? 0) * lucroPerc) / 100;

                    return (
                      <td key={size.id} className="px-3 py-2 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-[2px]">
                          <div className="font-medium text-sm text-foreground">
                            R$ {formatDecimalPlaces(variation.priceAmount || 0)}
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-between cursor-help">
                                  <span>Lucro efetivo</span>
                                  <span className="font-mono">
                                    {formatDecimalPlaces(lucroPerc)}% | R$ {formatDecimalPlaces(lucroValor)}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Lucro do preço atual considerando custos e DNA.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex justify-between">
                            <span>Custo FT</span>
                            <span className="font-mono">R$ {formatDecimalPlaces(custoFT)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Custo total</span>
                            <span className="font-mono">R$ {formatDecimalPlaces(custoTotal)}</span>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-between cursor-help">
                                  <span>Preço alvo (lucro target)</span>
                                  <span className="font-mono">R$ {formatDecimalPlaces(precoAlvoLucro)}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Preço mínimo para atingir a margem alvo do canal.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
