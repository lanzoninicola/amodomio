import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { menuItemSellingChannelPrismaEntity } from "~/domain/cardapio/menu-item-selling-channel.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import formatMoneyString from "~/utils/format-money-string";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export const meta: MetaFunction = () => [
  { title: "Menu Engineering Matrix" },
  { name: "robots", content: "noindex" },
];

type MatrixQuadrant = "stars" | "plowhorses" | "puzzles" | "dogs";

type MatrixItem = {
  id: string;
  name: string;
  groupName: string | null;
  categoryName: string | null;
  salesQty: number;
  priceAmount: number;
  profitActualPerc: number;
  marginAmount: number;
  quadrant: MatrixQuadrant;
};

type LoaderData = {
  filters: {
    sizeKey: string;
    channelKey: string;
    salesImportIds: string[];
  };
  thresholds: {
    popularityAvg: number;
    marginAvgAmount: number;
  };
  summary: {
    totalItems: number;
    itemsWithPricing: number;
    totalSalesQty: number;
    matchedSalesQty: number;
    unmatchedSalesQty: number;
    unmatchedCount: number;
  };
  sizes: { id: string; key: string; name: string }[];
  channels: { id: string; key: string; name: string }[];
  imports: { id: string; month: number; year: number; source: string | null }[];
  activeImports: { id: string; month: number; year: number; source: string | null }[];
  quadrants: Record<MatrixQuadrant, MatrixItem[]>;
  unpricedItems: { id: string; name: string }[];
  unmatched: { name: string; quantity: number }[];
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pad2 = (value: number) => String(value).padStart(2, "0");

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const sizes = await menuItemSizePrismaEntity.findAll();
  const channels = await menuItemSellingChannelPrismaEntity.findAll();
  const imports = await prismaClient.menuEngineeringImport.findMany({
    select: { id: true, month: true, year: true, source: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const requestedSizeKey = url.searchParams.get("size") ?? "pizza-medium";
  const requestedChannelKey = url.searchParams.get("channel") ?? "cardapio";
  const requestedImportIds = url.searchParams
    .getAll("salesImport")
    .filter((value) => value.trim().length > 0);

  const resolvedSizeKey =
    sizes.find((size) => size.key === requestedSizeKey)?.key ?? sizes[0]?.key ?? "";
  const resolvedChannelKey =
    channels.find((channel) => channel.key === requestedChannelKey)?.key ??
    channels[0]?.key ??
    "";

  const validRequestedImportIds = requestedImportIds.filter((id) =>
    imports.some((importItem) => importItem.id === id)
  );

  const resolvedImportIds =
    validRequestedImportIds.length > 0
      ? validRequestedImportIds
      : imports[0]?.id
      ? [imports[0].id]
      : [];

  const activeImports =
    resolvedImportIds.length > 0
      ? await prismaClient.menuEngineeringImport.findMany({
          where: {
            id: {
              in: resolvedImportIds,
            },
          },
          select: { id: true, month: true, year: true, source: true, items: true },
          orderBy: [{ year: "desc" }, { month: "desc" }],
        })
      : [];

  const items = await menuItemSellingPriceHandler.loadMany({
    channelKey: resolvedChannelKey,
    sizeKey: resolvedSizeKey,
  });

  const importedToppings = activeImports.flatMap((importItem) => importItem.items ?? []);

  const sizeTokens = sizes
    .flatMap((size) => [size.name, size.key])
    .map(normalize)
    .filter((token) => token.length >= 3);

  const normalizedMenuItems = items.map((item) => ({
    id: item.menuItemId,
    name: item.name,
    normalizedName: normalize(item.name),
  }));

  const nameIndex = new Map(
    normalizedMenuItems.map((item) => [item.normalizedName, item.id])
  );

  const salesByItem = new Map<string, number>();
  const unmatchedMap = new Map<string, number>();

  importedToppings.forEach((toppingRow) => {
    const rawName = toppingRow.topping ?? "";
    const normalized = normalize(rawName);
    let cleaned = normalized;

    sizeTokens.forEach((token) => {
      const regex = new RegExp(`\\b${escapeRegExp(token)}\\b`, "g");
      cleaned = cleaned.replace(regex, " ").replace(/\s+/g, " ").trim();
    });

    if (!cleaned) cleaned = normalized;

    let matchedId = nameIndex.get(cleaned);

    if (!matchedId && cleaned.length >= 3) {
      const candidates = normalizedMenuItems.filter(
        (item) =>
          cleaned.includes(item.normalizedName) ||
          item.normalizedName.includes(cleaned)
      );
      if (candidates.length > 0) {
        matchedId = candidates.sort(
          (a, b) => b.normalizedName.length - a.normalizedName.length
        )[0]?.id;
      }
    }

    if (matchedId) {
      salesByItem.set(
        matchedId,
        (salesByItem.get(matchedId) ?? 0) + (toppingRow.quantity ?? 0)
      );
    } else {
      const key = rawName.trim() || "(sem nome)";
      unmatchedMap.set(key, (unmatchedMap.get(key) ?? 0) + (toppingRow.quantity ?? 0));
    }
  });

  const itemsWithPricing = items
    .filter((item) => item.active && item.visible)
    .map((item) => {
      const variation = item.sellPriceVariations.find(
        (v) => v.sizeKey === resolvedSizeKey && v.channelKey === resolvedChannelKey
      );

      return {
        item,
        variation,
        salesQty: salesByItem.get(item.menuItemId) ?? 0,
      };
    });

  const pricedItems = itemsWithPricing.filter((entry) => Boolean(entry.variation));
  const unpricedItems = itemsWithPricing
    .filter((entry) => !entry.variation)
    .map((entry) => ({ id: entry.item.menuItemId, name: entry.item.name }));

  const matchedSalesQty = itemsWithPricing.reduce((sum, entry) => sum + entry.salesQty, 0);
  const unmatchedSalesQty = Array.from(unmatchedMap.values()).reduce((sum, qty) => sum + qty, 0);
  const totalSalesQty = matchedSalesQty + unmatchedSalesQty;

  const popularityAvg = pricedItems.length
    ? pricedItems.reduce((sum, entry) => sum + entry.salesQty, 0) / pricedItems.length
    : 0;

  const marginAvgAmount = pricedItems.length
    ? pricedItems.reduce((sum, entry) => {
        const profitActualPerc = Number(entry.variation?.profitActualPerc ?? 0);
        const priceAmount = Number(entry.variation?.priceAmount ?? 0);
        return sum + priceAmount * (profitActualPerc / 100);
      }, 0) / pricedItems.length
    : 0;

  const quadrants: Record<MatrixQuadrant, MatrixItem[]> = {
    stars: [],
    plowhorses: [],
    puzzles: [],
    dogs: [],
  };

  pricedItems.forEach((entry) => {
    const profitActualPerc = Number(entry.variation?.profitActualPerc ?? 0);
    const priceAmount = Number(entry.variation?.priceAmount ?? 0);
    const marginAmount = priceAmount * (profitActualPerc / 100);
    const highPopularity = entry.salesQty >= popularityAvg;
    const highMargin = marginAmount >= marginAvgAmount;

    const quadrant: MatrixQuadrant = highPopularity
      ? highMargin
        ? "stars"
        : "plowhorses"
      : highMargin
      ? "puzzles"
      : "dogs";

    quadrants[quadrant].push({
      id: entry.item.menuItemId,
      name: entry.item.name,
      groupName: entry.item.group?.name ?? null,
      categoryName: entry.item.category?.name ?? null,
      salesQty: entry.salesQty,
      priceAmount,
      profitActualPerc,
      marginAmount,
      quadrant,
    });
  });

  (Object.keys(quadrants) as MatrixQuadrant[]).forEach((key) => {
    quadrants[key] = quadrants[key].sort((a, b) => b.salesQty - a.salesQty);
  });

  const unmatched = Array.from(unmatchedMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 20);

  return json<LoaderData>({
    filters: {
      sizeKey: resolvedSizeKey,
      channelKey: resolvedChannelKey,
      salesImportIds: resolvedImportIds,
    },
    thresholds: {
      popularityAvg,
      marginAvgAmount,
    },
    summary: {
      totalItems: itemsWithPricing.length,
      itemsWithPricing: pricedItems.length,
      totalSalesQty,
      matchedSalesQty,
      unmatchedSalesQty,
      unmatchedCount: unmatchedMap.size,
    },
    sizes: sizes.map((size) => ({ id: size.id, key: size.key, name: size.name })),
    channels: channels.map((channel) => ({ id: channel.id, key: channel.key, name: channel.name })),
    imports,
    activeImports: activeImports.map((importItem) => ({
      id: importItem.id,
      month: importItem.month,
      year: importItem.year,
      source: importItem.source ?? null,
    })),
    quadrants,
    unpricedItems,
    unmatched,
  });
}

const quadrantMeta: Record<MatrixQuadrant, { title: string; note: string; badge: string }> = {
  stars: {
    title: "Stars (Estrelas)",
    note: "Alta venda + Alta margem — manter, destacar e promover",
    badge: "text-emerald-700 bg-emerald-100",
  },
  plowhorses: {
    title: "Plowhorses (Cavalos de carga)",
    note: "Alta venda + Baixa margem — rever preço, porção ou custo",
    badge: "text-amber-700 bg-amber-100",
  },
  puzzles: {
    title: "Puzzles (Quebra-cabeças)",
    note: "Baixa venda + Alta margem — trabalhar marketing e posicionamento",
    badge: "text-blue-700 bg-blue-100",
  },
  dogs: {
    title: "Dogs (Abacaxis)",
    note: "Baixa venda + Baixa margem — remover ou reformular",
    badge: "text-rose-700 bg-rose-100",
  },
};

const quadrantOrder: MatrixQuadrant[] = ["stars", "puzzles", "plowhorses", "dogs"];

const quadrantColors: Record<MatrixQuadrant, { fill: string; stroke: string }> = {
  stars: { fill: "#5AC48B", stroke: "#2B8C5F" },
  puzzles: { fill: "#F6C453", stroke: "#C2892E" },
  plowhorses: { fill: "#F39A4B", stroke: "#C66C1F" },
  dogs: { fill: "#EF5A5A", stroke: "#C53535" },
};

const formatCurrency = (value: number) => {
  const abs = Math.abs(value);
  const formatted = formatMoneyString(abs);
  return `${value < 0 ? "-R$ " : "R$ "}${formatted}`;
};

const buildTicks = (min: number, max: number, count: number) => {
  if (count <= 1) return [min];
  const range = max - min || 1;
  const step = range / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
};

const toPointLabel = (name: string) => {
  const compact = normalize(name).replace(/\s+/g, "");
  return (compact.slice(0, 4) || name.slice(0, 4)).toUpperCase();
};

export default function AdminGerenciamentoCardapioMenuEngineering() {
  const data = useLoaderData<typeof loader>();
  const [guideOpen, setGuideOpen] = useState(false);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const promptText = `Você é um pipeline de ETL determinístico para pizzarias.

Objetivo:
Converter o relatório Saipos em um JSON consolidado por sabor
para o sistema de Engenharia de Cardápio da A Modo Mio,
com resultado 100% reproduzível entre execuções.

ENTRADAS OBRIGATÓRIAS:
- Relatório Saipos de itens vendidos (competência fechada)
- JSON de preços de venda (snapshot único do período)

REGRAS FECHADAS (NÃO INFERIR, NÃO SUPOR):

1) Parsing de sabores
- Separadores válidos: "/", "+", " e ", " meio a meio "
- Remover duplicatas
- Normalizar nomes (trim, espaços simples)
- Ordenar sabores alfabeticamente (ASC) antes de qualquer cálculo

2) Inclusão
- Considerar vendas diretas, meio a meio, combinações e Diversos
- Sempre que um sabor aparecer, ele entra no cálculo

3) Quantidade (rateio fixo)
- 1 sabor  → 1.000
- 2 sabores → 0.500
- 3 sabores → 0.333333
- 4 sabores → 0.250
- Somar quantidades brutas
- Arredondar quantidade FINAL para 2 casas

4) Preços (regra crítica)
- Usar EXCLUSIVAMENTE o JSON de preços fornecido
- O preço considerado é o preço de tabela do sabor no tamanho vendido
- Se PrecoSabor == 0 → ABORTAR execução com erro explícito
- Não usar fallback
- Não estimar
- Não interpolar

5) Regra comercial
- Em pizzas com mix, o preço cobrado é o do sabor mais caro
- O preço cobrado NÃO interfere no rateio
- Rateio sempre proporcional aos preços de tabela

6) Valor (critério oficial)
PesoSabor = PrecoSabor / SomaPrecos
ValorAtribuido = ValorVendaReal × PesoSabor
- Não arredondar por pedido
- Somar valores brutos
- Arredondar valor FINAL para 2 casas

7) Consolidação
- Consolidar TODOS os sabores
- Não gerar ranking
- Não separar venda direta e mix
- Ordem final dos sabores: alfabética ASC

8) Saída (obrigatória)
- Gerar APENAS JSON válido e parseável (strict)
- Não gerar explicações
- Não gerar texto fora do JSON

Formato obrigatório de saída:

{
  "month": "MM",
  "year": "YYYY",
  "toppings": [
    {
      "topping": "string",
      "quantity": number,
      "value": number
    }
  ]
}

Garantia:
- Mesmo input → mesmo output
- Execução determinística`;

  useEffect(() => {
    if (!guideOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (guideRef.current && !guideRef.current.contains(event.target as Node)) {
        setGuideOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuideOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [guideOpen]);
  const [hovered, setHovered] = useState<MatrixItem | null>(null);

  const allItems = useMemo(
    () => quadrantOrder.flatMap((key) => data.quadrants[key]),
    [data.quadrants]
  );
  const defaultHighlight = useMemo(() => {
    if (allItems.length === 0) return null;
    return [...allItems].sort((a, b) => b.salesQty - a.salesQty)[0] ?? null;
  }, [allItems]);

  const chart = useMemo(() => {
    const width = 1000;
    const height = 560;
    const padding = { top: 30, right: 30, bottom: 70, left: 70 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const xValues = allItems.map((item) => item.marginAmount);
    const yValues = allItems.map((item) => item.salesQty);
    const minX = Math.min(0, ...xValues);
    const maxX = Math.max(0, ...xValues);
    const minY = 0;
    const maxY = Math.max(1, ...yValues);

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    const xPadding = xRange * 0.1;
    const yPadding = yRange * 0.1;

    const xMin = minX - xPadding;
    const xMax = maxX + xPadding;
    const yMax = maxY + yPadding;

    const scaleX = (value: number) =>
      padding.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
    const scaleY = (value: number) =>
      padding.top + plotHeight - ((value - minY) / (yMax - minY || 1)) * plotHeight;

    return {
      width,
      height,
      padding,
      plotWidth,
      plotHeight,
      xMin,
      xMax,
      yMax,
      scaleX,
      scaleY,
    };
  }, [allItems]);

  const xTicks = useMemo(() => buildTicks(chart.xMin, chart.xMax, 5), [chart]);
  const yTicks = useMemo(() => buildTicks(0, chart.yMax, 5), [chart]);
  const activePeriodLabel = useMemo(() => {
    if (data.activeImports.length === 0) return "Sem importação";
    const labels = data.activeImports.map((item) => `${pad2(item.month)}/${item.year}`);
    if (labels.length === 1) return labels[0];
    return `${labels.length} meses (${labels[labels.length - 1]} até ${labels[0]})`;
  }, [data.activeImports]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Menu Engineering Matrix</h1>
          <p className="text-sm text-muted-foreground">
            Popularidade (vendas) × Margem de contribuição (lucro). Baseado nas vendas importadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href="https://chatgpt.com/g/g-6980b87c6d088191b652865a42fecd60-etl-saipos-engenharia-de-cardapio-a-modo-mio"
              target="_blank"
              rel="noreferrer"
            >
              Abrir GPTs (ETL Saipos)
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/gerenciamento/cardapio/dashboard/menu-engineering/import">
              Importar vendas
            </Link>
          </Button>
          <div className="relative" ref={guideRef}>
            <Button
              type="button"
              className="bg-yellow-300 text-black hover:bg-yellow-400"
              onClick={() => setGuideOpen((prev) => !prev)}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Guia de atualização
            </Button>
            {guideOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-[380px] rounded-xl border border-border bg-white p-4 shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">Atualizar Gráfico de Engenharia de Cardápio</h3>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setGuideOpen(false)}>
                    Fechar
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Este processo consolida automaticamente os dados de vendas do Saipos para atualizar o
                  gráfico de Engenharia de Cardápio.
                </p>
                <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                  <li>Exporte o relatório mensal do Saipos: Saipos → Relatórios → Itens vendidos</li>
                  <li>
                    Exporte a tabela de preços por sabor e tamanho: Sistema A Modo Mio → Precificação →
                    Preços de Venda → Cardápio → Tabela de Preço → Exportar dados
                  </li>
                  <li>Envie ambos os arquivos no ChatGPT</li>
                  <li>Execute o prompt padrão de consolidação</li>
                </ol>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Prompt padrão</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(promptText);
                      setGuideOpen(false);
                    }}
                  >
                    Copiar prompt
                  </Button>
                </div>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] text-slate-100">
{promptText}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Ajuste o canal, tamanho e um ou mais períodos para recalcular a matriz acumulada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="get" className="grid gap-4 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              Canal
              <select
                name="channel"
                defaultValue={data.filters.channelKey}
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                {data.channels.map((channel) => (
                  <option key={channel.id} value={channel.key}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Tamanho
              <select
                name="size"
                defaultValue={data.filters.sizeKey}
                className="h-10 rounded-md border border-input bg-background px-3"
              >
                {data.sizes.map((size) => (
                  <option key={size.id} value={size.key}>
                    {size.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Vendas (Mês/Ano) - selecione um ou mais meses
              <select
                name="salesImport"
                multiple
                defaultValue={data.filters.salesImportIds}
                className="min-h-[132px] rounded-md border border-input bg-background px-3 py-2"
              >
                {data.imports.length === 0 ? (
                  <option value="" disabled>
                    Sem importações
                  </option>
                ) : (
                  data.imports.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {pad2(imp.month)}/{imp.year}
                      {imp.source ? ` · ${imp.source}` : ""}
                    </option>
                  ))
                )}
              </select>
              <span className="text-xs text-muted-foreground">
                Use Ctrl (Windows) ou Command (Mac) para selecionar vários períodos.
              </span>
            </label>

            <div className="md:col-span-4">
              <Button type="submit">Aplicar filtros</Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl">Menu Engineering</CardTitle>
              <CardDescription>Avg Gross Profit × Total Transactions</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Canal: {data.filters.channelKey}</span>
              <span>Tamanho: {data.filters.sizeKey}</span>
              <span>Vendas: {activePeriodLabel}</span>
              {data.activeImports.length > 0 ? (
                <span>
                  Fontes:{" "}
                  {Array.from(
                    new Set(
                      data.activeImports
                        .map((importItem) => importItem.source)
                        .filter((source): source is string => Boolean(source))
                    )
                  ).join(", ") || "Sem fonte"}
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-white/90 p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Legenda
            </p>
            <div className="grid gap-3">
              {quadrantOrder.map((key, index) => (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: quadrantColors[key].fill }}
                  />
                  <div className="text-sm">
                    <p className="font-medium">
                      {index + 1}. {quadrantMeta[key].title.split(" ")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">{quadrantMeta[key].note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className="h-[620px] w-full"
              role="img"
              aria-label="Scatter plot da matriz de engenharia de cardápio"
            >
              <rect
                x={chart.padding.left}
                y={chart.padding.top}
                width={chart.plotWidth}
                height={chart.plotHeight}
                rx="16"
                fill="#F8F9FB"
              />

              {xTicks.map((value) => {
                const x = chart.scaleX(value);
                return (
                  <g key={`x-${value}`}>
                    <line
                      x1={x}
                      y1={chart.padding.top}
                      x2={x}
                      y2={chart.padding.top + chart.plotHeight}
                      stroke="#E5E7EB"
                      strokeDasharray="4 6"
                    />
                    <text
                      x={x}
                      y={chart.padding.top + chart.plotHeight + 32}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#6B7280"
                    >
                      {formatCurrency(value)}
                    </text>
                  </g>
                );
              })}

              {yTicks.map((value) => {
                const y = chart.scaleY(value);
                return (
                  <g key={`y-${value}`}>
                    <line
                      x1={chart.padding.left}
                      y1={y}
                      x2={chart.padding.left + chart.plotWidth}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeDasharray="4 6"
                    />
                    <text
                      x={chart.padding.left - 12}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="12"
                      fill="#6B7280"
                    >
                      {Math.round(value)}
                    </text>
                  </g>
                );
              })}

              <line
                x1={chart.scaleX(data.thresholds.marginAvgAmount)}
                y1={chart.padding.top}
                x2={chart.scaleX(data.thresholds.marginAvgAmount)}
                y2={chart.padding.top + chart.plotHeight}
                stroke="#111827"
                strokeDasharray="6 8"
                opacity="0.35"
              />
              <line
                x1={chart.padding.left}
                y1={chart.scaleY(data.thresholds.popularityAvg)}
                x2={chart.padding.left + chart.plotWidth}
                y2={chart.scaleY(data.thresholds.popularityAvg)}
                stroke="#111827"
                strokeDasharray="6 8"
                opacity="0.35"
              />

              {allItems.map((item) => {
                const cx = chart.scaleX(item.marginAmount);
                const cy = chart.scaleY(item.salesQty);
                const color = quadrantColors[item.quadrant];
                return (
                  <g
                    key={item.id}
                    onMouseEnter={() => setHovered(item)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(item)}
                    onBlur={() => setHovered(null)}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7.5}
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth={1}
                      opacity={hovered && hovered.id === item.id ? 1 : 0.85}
                    />
                    <text
                      x={cx + 10}
                      y={cy + 4}
                      fontSize="11"
                      fill="#111827"
                      opacity={hovered && hovered.id === item.id ? 1 : 0.85}
                    >
                      {toPointLabel(item.name)}
                    </text>
                  </g>
                );
              })}

              <text
                x={chart.padding.left + chart.plotWidth / 2}
                y={chart.height - 18}
                textAnchor="middle"
                fontSize="14"
                fill="#374151"
              >
                Avg Gross Profit
              </text>
              <text
                x={16}
                y={chart.padding.top + chart.plotHeight / 2}
                textAnchor="middle"
                fontSize="14"
                fill="#374151"
                transform={`rotate(-90 16 ${chart.padding.top + chart.plotHeight / 2})`}
              >
                Total Transactions
              </text>
            </svg>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border bg-white/90 p-4 shadow-sm md:grid-cols-4 xl:col-span-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Detalhes</p>
              {hovered ? (
                <span className="text-xs text-muted-foreground">Hover ativo</span>
              ) : (
                <span className="text-xs text-muted-foreground">Passe o mouse no gráfico</span>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground">Avg de margem</p>
              <p className="font-semibold">{formatCurrency(data.thresholds.marginAvgAmount)}</p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground">Total transações</p>
              <p className="font-semibold">{data.summary.totalSalesQty}</p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground">Produto em destaque</p>
              <p className="font-semibold text-slate-900">
                {(hovered ?? defaultHighlight)?.name ?? "Nenhum item"}
              </p>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      quadrantColors[(hovered ?? defaultHighlight)?.quadrant ?? "stars"].fill,
                  }}
                />
                {(hovered ?? defaultHighlight)
                  ? quadrantMeta[(hovered ?? defaultHighlight)!.quadrant].title
                  : "—"}
              </span>
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total de itens</CardTitle>
            <CardDescription>Itens ativos e visíveis</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {data.summary.totalItems}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Com precificação</CardTitle>
            <CardDescription>Itens usados na matriz</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {data.summary.itemsWithPricing}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Média de vendas</CardTitle>
            <CardDescription>Limite de popularidade</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {formatDecimalPlaces(data.thresholds.popularityAvg, 1)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Média de margem</CardTitle>
            <CardDescription>Limite de lucro (R$)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xl font-semibold">
            {formatCurrency(data.thresholds.marginAvgAmount)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {quadrantOrder.map((key) => {
          const quadrant = quadrantMeta[key];
          const items = data.quadrants[key];
          return (
            <Card key={key} className="flex flex-col">
              <CardHeader className="gap-1">
                <div className="flex items-center justify-between">
                  <CardTitle>{quadrant.title}</CardTitle>
                  <Badge className={quadrant.badge}>{items.length} itens</Badge>
                </div>
                <CardDescription>{quadrant.note}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item neste quadrante.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.groupName || item.categoryName || "Sem grupo"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Vendas: {item.salesQty}</span>
                        <span>Preço: R$ {formatMoneyString(item.priceAmount)}</span>
                        <span>
                          Margem: {formatDecimalPlaces(item.profitActualPerc, 1)}% (R${" "}
                          {formatMoneyString(item.marginAmount)})
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Itens sem precificação</CardTitle>
            <CardDescription>
              Não possuem variação de preço para o canal/tamanho selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {data.unpricedItems.length === 0 ? (
              <p className="text-muted-foreground">Nenhum item sem precificação.</p>
            ) : (
              data.unpricedItems.map((item) => (
                <div key={item.id} className="rounded-md border border-border px-3 py-2">
                  {item.name}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens não encontrados nas vendas</CardTitle>
            <CardDescription>
              {data.summary.unmatchedCount} nomes diferentes sem match automático. Top 20 por
              volume.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {data.unmatched.length === 0 ? (
              <p className="text-muted-foreground">Sem itens não mapeados.</p>
            ) : (
              data.unmatched.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="max-w-[70%] truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.quantity}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo de vendas</CardTitle>
          <CardDescription>Visão geral do volume consolidado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Total de vendas (itens)</p>
            <p className="text-base font-semibold">{data.summary.totalSalesQty}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Vendas mapeadas</p>
            <p className="text-base font-semibold">{data.summary.matchedSalesQty}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Vendas sem match</p>
            <p className="text-base font-semibold">{data.summary.unmatchedSalesQty}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
