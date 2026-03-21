import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { BookOpenText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { menuItemSellingChannelPrismaEntity } from "~/domain/cardapio/menu-item-selling-channel.entity.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";

const ALL_OPTION = "__all__";

function hasMeaningfulCostChange(currentCostAmount: number, previousCostAmount: number) {
  return (
    Number(currentCostAmount || 0).toFixed(4) !==
    Number(previousCostAmount || 0).toFixed(4)
  );
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function fmtPct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function buildRowContextText(row: any) {
  const sourceName = row.Run?.sourceItem?.name || "um insumo sem origem identificada";
  const productName = row.MenuItem?.name || "um produto sem nome";
  const sizeName = row.MenuItemSize?.name || "variação não informada";
  const channelName = row.Channel?.name || "canal não informado";
  const priority = row.priority || "sem prioridade";
  const currentCost = fmtMoney(row.currentCostAmount);
  const previousCost = fmtMoney(row.previousCostAmount);
  const currentPrice = fmtMoney(row.sellingPriceAmount);
  const suggestedPrice = fmtMoney(row.recommendedPriceAmount);
  const priceGap = fmtMoney(row.priceGapAmount);
  const currentMargin = fmtPct(row.profitActualPerc);
  const targetMargin = fmtPct(row.profitExpectedPerc);
  const marginGap = fmtPct(row.marginGapPerc);
  const costChanged =
    Number(row.currentCostAmount || 0).toFixed(4) !==
    Number(row.previousCostAmount || 0).toFixed(4);
  const costSentence = costChanged
    ? `O custo mudou de ${previousCost} para ${currentCost}.`
    : `O custo considerado para esta análise é ${currentCost}.`;

  return [
    `O insumo ${sourceName} gerou impacto no produto ${productName}.`,
    `Esta linha corresponde à variação ${sizeName} no canal ${channelName}.`,
    costSentence,
    `O preço atual é ${currentPrice}, e o preço sugerido para recuperar a meta é ${suggestedPrice}.`,
    `O gap de preço é ${priceGap} e a margem está em ${currentMargin} contra meta de ${targetMargin}.`,
    `A prioridade desta revisão é ${priority} com gap de margem de ${marginGap}.`,
  ].join(" ");
}

function buildRowContextParts(row: any) {
  return {
    sourceName: row.Run?.sourceItem?.name || "Sem item origem",
    sourceType: row.Run?.sourceType || "-",
    productName: row.MenuItem?.name || "-",
    sizeName: row.MenuItemSize?.name || "Variação não informada",
    channelName: row.Channel?.name || "Canal não informado",
    currentCost: fmtMoney(row.currentCostAmount),
    previousCost: fmtMoney(row.previousCostAmount),
    currentPrice: fmtMoney(row.sellingPriceAmount),
    suggestedPrice: fmtMoney(row.recommendedPriceAmount),
    priceGap: fmtMoney(row.priceGapAmount),
    currentMargin: fmtPct(row.profitActualPerc),
    targetMargin: fmtPct(row.profitExpectedPerc),
    marginGap: fmtPct(row.marginGapPerc),
    priority: row.priority || "sem prioridade",
    createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString("pt-BR") : "-",
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const url = new URL(request.url);
  const priority = String(url.searchParams.get("priority") || "").trim();
  const channelIdParam = String(url.searchParams.get("channelId") || "").trim();
  const sizeIdParam = String(url.searchParams.get("sizeId") || "").trim();
  const q = String(url.searchParams.get("q") || "").trim();
  const dateFrom = String(url.searchParams.get("dateFrom") || "").trim();
  const dateTo = String(url.searchParams.get("dateTo") || "").trim();
  const belowTargetOnly =
    String(url.searchParams.get("belowTargetOnly") || "").trim() === "true";

  const [channels, sizes] = await Promise.all([
    menuItemSellingChannelPrismaEntity.findAll(),
    menuItemSizePrismaEntity.findAll(),
  ]);
  const defaultChannelId = channels.find((channel: any) => channel.key === "cardapio")?.id || "";
  const defaultSizeId = sizes.find((size: any) => size.key === "pizza-medium")?.id || "";
  const hasChannelParam = url.searchParams.has("channelId");
  const hasSizeParam = url.searchParams.has("sizeId");
  const selectedChannelId =
    channelIdParam === ALL_OPTION
      ? ""
      : hasChannelParam
        ? channelIdParam
        : defaultChannelId;
  const selectedSizeId =
    sizeIdParam === ALL_OPTION
      ? ""
      : hasSizeParam
        ? sizeIdParam
        : defaultSizeId;

  if (typeof db.costImpactMenuItem?.findMany !== "function") {
    return ok({
      rows: [],
      summary: null,
      filters: {
        priority,
        channelId: selectedChannelId || (hasChannelParam ? ALL_OPTION : defaultChannelId),
        sizeId: selectedSizeId || (hasSizeParam ? ALL_OPTION : defaultSizeId),
        q,
        dateFrom,
        dateTo,
        belowTargetOnly,
      },
      channels,
      sizes,
      setupRequired: true,
    });
  }

  const where: any = {};
  if (priority) where.priority = priority;
  if (selectedChannelId) where.menuItemChannelId = selectedChannelId;
  if (selectedSizeId) where.menuItemSizeId = selectedSizeId;
  if (belowTargetOnly) {
    where.marginGapPerc = { gt: 0 };
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000`);
    }
    if (dateTo) {
      where.createdAt.lte = new Date(`${dateTo}T23:59:59.999`);
    }
  }
  if (q) {
    where.OR = [
      { MenuItem: { is: { name: { contains: q, mode: "insensitive" } } } },
      { Run: { is: { sourceItem: { is: { name: { contains: q, mode: "insensitive" } } } } } },
    ];
  }

  const rawRows = await db.costImpactMenuItem.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      currentCostAmount: true,
      previousCostAmount: true,
      sellingPriceAmount: true,
      profitActualPerc: true,
      profitExpectedPerc: true,
      recommendedPriceAmount: true,
      priceGapAmount: true,
      marginGapPerc: true,
      priority: true,
      createdAt: true,
      metadata: true,
      MenuItem: {
        select: { id: true, name: true },
      },
      MenuItemSize: {
        select: { id: true, name: true, key: true },
      },
      Channel: {
        select: { id: true, name: true, key: true },
      },
      Run: {
        select: {
          id: true,
          sourceType: true,
          createdAt: true,
          sourceItem: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });
  const rows = rawRows.filter((row: any) =>
    hasMeaningfulCostChange(row.currentCostAmount, row.previousCostAmount)
  );

  const summary = {
    totalRows: rows.length,
    critical: rows.filter((row: any) => row.priority === "critical").length,
    high: rows.filter((row: any) => row.priority === "high").length,
    totalPriceGapAmount: rows.reduce(
      (acc: number, row: any) => acc + Number(row.priceGapAmount || 0),
      0
    ),
  };

  return ok({
    rows,
    summary,
    filters: {
      priority,
      channelId: selectedChannelId || (hasChannelParam ? ALL_OPTION : defaultChannelId),
      sizeId: selectedSizeId || (hasSizeParam ? ALL_OPTION : defaultSizeId),
      q,
      dateFrom,
      dateTo,
      belowTargetOnly,
    },
    channels,
    sizes,
    setupRequired: false,
  });
}

export default function AdminCostImpactRoute() {
  const data = useLoaderData<typeof loader>();
  const payload = data.payload as any;
  const navigation = useNavigation();
  const rows = payload.rows || [];
  const summary = payload.summary || null;
  const channels = payload.channels || [];
  const sizes = payload.sizes || [];
  const filters = payload.filters || {
    priority: "",
    channelId: "",
    sizeId: "",
    q: "",
    dateFrom: "",
    dateTo: "",
    belowTargetOnly: false,
  };
  const setupRequired = Boolean(payload.setupRequired);
  const isLoading = navigation.state !== "idle";
  const [priorityValue, setPriorityValue] = useState(filters.priority || ALL_OPTION);
  const [channelValue, setChannelValue] = useState(filters.channelId || ALL_OPTION);
  const [sizeValue, setSizeValue] = useState(filters.sizeId || ALL_OPTION);
  const selectedChannelName =
    channelValue === ALL_OPTION
      ? "Todos os canais"
      : channels.find((channel: any) => channel.id === channelValue)?.name || "Cardapio";
  const selectedSizeName =
    sizeValue === ALL_OPTION
      ? "Todas as variações"
      : sizes.find((size: any) => size.id === sizeValue)?.name || "Tamanho Medio";
  const isUsingDefaults =
    channelValue !== ALL_OPTION &&
    sizeValue !== ALL_OPTION &&
    channels.find((channel: any) => channel.id === channelValue)?.key === "cardapio" &&
    sizes.find((size: any) => size.id === sizeValue)?.key === "pizza-medium";

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_760px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Impacto de custos
          </h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Quando uma importação de NF altera o custo de um insumo, o pipeline
            recalcula receitas, fichas, custo do item vendido e grava o impacto
            visualizado nesta página. Se o insumo não estiver ligado, direta ou
            indiretamente, a uma receita, ficha ou item final vendido no cardápio,
            a mudança pode ser processada sem gerar registros visíveis aqui.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50/80 px-4 py-4 text-xs text-slate-600 xl:self-start">
          <div className="font-semibold text-slate-500">Links</div>
          <div className="mt-3 grid gap-3 xl:grid-cols-5">
            <Link
              to="/admin/cost-monitoring"
              className="font-semibold leading-5 whitespace-nowrap transition hover:text-slate-950"
            >
              Consulta de custo
            </Link>
            <Link
              to="/admin/stock-movements"
              className="font-semibold leading-5 whitespace-nowrap transition hover:text-slate-950"
            >
              Movimentações
            </Link>
            <Link
              to="/admin/import-stock-nf"
              className="font-semibold leading-5 whitespace-nowrap transition hover:text-slate-950"
            >
              Importação NF
            </Link>
            <Link
              to="/admin/gerenciamento/cardapio/cost-management"
              className="font-semibold leading-5 whitespace-nowrap transition hover:text-slate-950"
            >
              Custos do cardápio
            </Link>
            <Link
              to="/admin/gerenciamento/cardapio/sell-price-management"
              className="font-semibold leading-5 whitespace-nowrap transition hover:text-slate-950"
            >
              Preços de venda
            </Link>
          </div>
        </div>
      </div>

      <Separator />

      <div className="text-xs text-slate-500">
        {isUsingDefaults
          ? "Visualização padrão: Cardápio + Tamanho Medio."
          : `Visualização atual: ${selectedChannelName} + ${selectedSizeName}.`}
      </div>

      <Form method="get" className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-4">
          <span className="text-slate-600">Buscar insumo ou produto</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-slate-300"
            placeholder="Ex.: muçarela, margherita"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Prioridade</span>
          <input type="hidden" name="priority" value={priorityValue === ALL_OPTION ? "" : priorityValue} />
          <Select value={priorityValue} onValueChange={setPriorityValue}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION}>Todas</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Canal de venda</span>
          <input type="hidden" name="channelId" value={channelValue} />
          <Select value={channelValue} onValueChange={setChannelValue}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Selecione um canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION}>Todos os canais</SelectItem>
              {channels.map((channel: any) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-2">
          <span className="text-slate-600">Variação</span>
          <input type="hidden" name="sizeId" value={sizeValue} />
          <Select value={sizeValue} onValueChange={setSizeValue}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Selecione uma variação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION}>Todas as variações</SelectItem>
              {sizes.map((size: any) => (
                <SelectItem key={size.id} value={size.id}>
                  {size.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-1">
          <span className="text-slate-600">De</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-slate-300"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm xl:col-span-1">
          <span className="text-slate-600">Até</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-slate-300"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-12">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="belowTargetOnly"
              value="true"
              defaultChecked={Boolean(filters.belowTargetOnly)}
            />
            Abaixo da meta
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white"
          >
            {isLoading ? "Atualizando..." : "Filtrar"}
          </button>
        </div>
      </Form>

      {setupRequired ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          As tabelas de impacto ainda não estão disponíveis neste ambiente.
          Rode a migration do Prisma antes de usar o painel.
        </div>
      ) : null}

      {summary ? (
        <>
        <Separator />
        <div className="grid gap-6 md:grid-cols-4">
          <MetricCard title="Linhas" value={String(summary.totalRows)} />
          <MetricCard title="Críticas" value={String(summary.critical)} />
          <MetricCard title="Altas" value={String(summary.high)} />
          <MetricCard title="Gap total preço" value={fmtMoney(summary.totalPriceGapAmount)} />
        </div>
        </>
      ) : null}

      <Separator />

      <div className="overflow-hidden rounded-2xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">Origem</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">Produto</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Custo</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Preço atual</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Preço sugerido</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Margem atual</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide">Margem alvo</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">Prioridade</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide">Contexto</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  Nenhum impacto encontrado para os filtros informados.
                </td>
              </tr>
            ) : (
              rows.map((row: any) => {
                const contextText = buildRowContextText(row);
                const context = buildRowContextParts(row);

                return (
                  <tr key={row.id} className="border-t border-slate-100/80">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">
                        {row.Run?.sourceItem?.name || "Sem item origem"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.Run?.sourceType || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900">
                        <Link
                          to={`/admin/gerenciamento/cardapio/cost-management/${row.MenuItem?.id}`}
                          className="hover:underline"
                        >
                          {row.MenuItem?.name || "-"}
                        </Link>
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.MenuItemSize?.name || "-"} · {row.Channel?.name || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>{fmtMoney(row.currentCostAmount)}</div>
                      <div className="text-xs text-slate-500">
                        ant. {fmtMoney(row.previousCostAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{fmtMoney(row.sellingPriceAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div>{fmtMoney(row.recommendedPriceAmount)}</div>
                      <div className="text-xs text-slate-500">
                        gap {fmtMoney(row.priceGapAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{fmtPct(row.profitActualPerc)}</td>
                    <td className="px-4 py-3 text-right">{fmtPct(row.profitExpectedPerc)}</td>
                    <td className="px-4 py-3">
                      <span className={priorityClassName(row.priority)}>
                        {row.priority}
                      </span>
                      <div className="mt-1 text-xs text-slate-500">
                        gap {fmtPct(row.marginGapPerc)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(row.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            aria-label={`Abrir contexto da linha de ${context.productName}`}
                            title="Ver contexto"
                          >
                            <BookOpenText className="h-4 w-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader className="space-y-2">
                            <DialogTitle>Contexto do impacto</DialogTitle>
                            <DialogDescription className="leading-relaxed text-slate-600">
                              {contextText}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 text-sm text-slate-700 md:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Origem</div>
                              <div className="mt-2 font-medium text-slate-900">{context.sourceName}</div>
                              <div className="text-xs text-slate-500">{context.sourceType}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Produto afetado</div>
                              <div className="mt-2 font-medium text-slate-900">{context.productName}</div>
                              <div className="text-xs text-slate-500">{context.sizeName} · {context.channelName}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Custo</div>
                              <div className="mt-2 font-medium text-slate-900">{context.currentCost}</div>
                              <div className="text-xs text-slate-500">antes {context.previousCost}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Preço</div>
                              <div className="mt-2 font-medium text-slate-900">{context.currentPrice}</div>
                              <div className="text-xs text-slate-500">sugerido {context.suggestedPrice} · gap {context.priceGap}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Margem</div>
                              <div className="mt-2 font-medium text-slate-900">{context.currentMargin}</div>
                              <div className="text-xs text-slate-500">meta {context.targetMargin} · gap {context.marginGap}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Revisão</div>
                              <div className="mt-2 font-medium text-slate-900 capitalize">{context.priority}</div>
                              <div className="text-xs text-slate-500">{context.createdAt}</div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="px-1 py-1">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function priorityClassName(priority: string) {
  if (priority === "critical") {
    return "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-700";
  }
  if (priority === "high") {
    return "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700";
  }
  if (priority === "medium") {
    return "inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700";
  }
  return "inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700";
}
