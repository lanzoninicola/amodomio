import type { MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { ArrowUpDown, ExternalLink, ListFilter, Search, SlidersHorizontal, XCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import {
  buildIngredientFlavorHref,
  formatClassification,
  getIngredientBadgeClass,
  getIngredientBadgeLabel,
  RECIPE_TABS,
  type IngredientFlavorUsagePayload,
} from "~/domain/sell-price/ingredient-flavor-usage";
import { loadIngredientFlavorUsage } from "~/domain/sell-price/ingredient-flavor-usage.server";

export const meta: MetaFunction = () => [
  { title: "Vendas | Ingredientes por sabores - Lista" },
];

export const loader = loadIngredientFlavorUsage;

export default function AdminVendasIngredientesSaboresPage() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const payload = (loaderData?.payload || {}) as IngredientFlavorUsagePayload;
  const rows = payload.rows || [];
  const channels = payload.channels || [];
  const tabCounts = payload.tabCounts || { visible: 0, future: 0 };
  const filters = payload.filters || { q: "", usage: "all", channel: "cardapio", tab: "visible" };
  const summary = payload.summary || {
    flavorItems: 0,
    flavorVariations: 0,
    ingredients: 0,
    leastUsedIngredients: 0,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <Link to="/admin/vendas/itens-vendidos" className="font-medium text-slate-900 hover:text-slate-700">
          vendas
        </Link>
        <span>/</span>
        <span>ferramentas</span>
        <span>·</span>
        <span>{summary.flavorItems} sabor(es)</span>
        <span>·</span>
        <span>{summary.flavorVariations} variacao(oes)</span>
        <span>·</span>
        <span>{summary.ingredients} ingrediente(s)</span>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Ingredientes por sabores</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Ranking dos ingredientes menos usados nas receitas vinculadas aos sabores de pizza do canal selecionado.
        </p>
      </div>

      <Form method="get" className="flex flex-wrap items-center gap-6">
        <input type="hidden" name="tab" value={filters.tab} />

        <div className="relative flex min-w-[260px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Pesquise por ingrediente ou sabor"
            className="h-9 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button type="submit" className="absolute right-2 rounded p-0.5 text-slate-400 hover:text-slate-600" title="Filtrar">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <button type="submit" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>menor uso</span>
        </button>

        <Select name="channel" defaultValue={filters.channel}>
          <SelectTrigger className="h-auto w-auto gap-1 border-0 p-0 text-sm font-medium text-blue-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-blue-400">
            <SelectValue>
              {channels.find((channel) => channel.key === filters.channel)?.name || "canal"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.key}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select name="usage" defaultValue={filters.usage}>
          <SelectTrigger className="h-auto w-auto gap-1 border-0 p-0 text-sm font-medium text-slate-600 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-slate-400">
            <SelectValue>
              {filters.usage === "all" ? "todos os usos" : filters.usage === "1" ? "1 sabor" : `ate ${filters.usage} sabores`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">todos os usos</SelectItem>
            <SelectItem value="1">1 sabor</SelectItem>
            <SelectItem value="2">ate 2 sabores</SelectItem>
            <SelectItem value="3">ate 3 sabores</SelectItem>
          </SelectContent>
        </Select>

        <button type="submit" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ListFilter className="h-3.5 w-3.5" />
          <span>filtros</span>
        </button>

        <Link to="/admin/vendas/ingredientes-sabores/lista" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
          <XCircle className="h-3.5 w-3.5" />
          <span>limpar filtros</span>
        </Link>
      </Form>

      <div className="overflow-hidden bg-white">
        <div className="flex items-end justify-between border-b border-slate-200 px-4">
          <div className="flex">
            {RECIPE_TABS.map((tabOption) => {
              const isActive = filters.tab === tabOption.value;
              return (
                <Link
                  key={tabOption.value}
                  to={buildIngredientFlavorHref({
                    view: "lista",
                    q: filters.q,
                    usage: filters.usage,
                    channel: filters.channel,
                    tab: tabOption.value,
                  })}
                  className={`relative flex flex-col items-start px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? `border-b-2 ${tabOption.activeClassName}`
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${tabOption.dotClassName} ${isActive ? "" : "opacity-50"}`} />
                    <span className={isActive ? "font-semibold" : "font-medium"}>
                      {tabOption.label} ({tabCounts[tabOption.value] || 0})
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
          <button type="button" className="mb-2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Colunas">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <Table className="min-w-[980px]">
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 w-[360px] px-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1">Ingrediente <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 w-32 px-4 text-right text-xs font-medium text-slate-500">
                <span className="inline-flex items-center justify-end gap-1">Sabores <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 w-32 px-4 text-right text-xs font-medium text-slate-500">
                <span className="inline-flex items-center justify-end gap-1">Variacoes <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Receitas vinculadas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum ingrediente encontrado para os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.ingredientId} className="border-slate-100 align-top hover:bg-slate-50/50">
                  <TableCell className="min-w-[360px] px-4 py-3 align-top">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/items/${row.ingredientId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-950 hover:underline"
                        >
                          {row.ingredientName}
                        </Link>
                        <Badge variant="outline" className={getIngredientBadgeClass(row)}>
                          {getIngredientBadgeLabel(row)}
                        </Badge>
                        {!row.active ? (
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                            inativo
                          </Badge>
                        ) : null}
                      </div>
                      <div className="space-y-0.5 text-xs text-slate-500">
                        <div>ID: {row.ingredientId}</div>
                        <div>{formatClassification(row.classification)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top text-right text-lg font-semibold tabular-nums text-slate-950">
                    {row.usageCount}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top text-right tabular-nums text-slate-700">
                    {row.variationCount}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {row.flavors.map((flavor) => (
                        <Link
                          key={`${row.ingredientId}-${flavor.itemId}-${flavor.variationName || "variacao"}`}
                          to={`/admin/items/${flavor.itemId}/venda`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                        >
                          <span className="truncate">
                            {flavor.itemName}
                            {flavor.variationName ? ` · ${flavor.variationName}` : ""}
                            {flavor.quantity != null && flavor.unit ? ` · ${flavor.quantity} ${flavor.unit}` : ""}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-slate-500">
        Fonte: Recipe vinculada na variacao do Item, RecipeIngredient e RecipeVariationIngredient. Nao usa o texto publico de ingredientes.
        {filters.q || filters.usage !== "all" || filters.channel !== "cardapio" || filters.tab !== "visible" ? (
          <Link
            to={buildIngredientFlavorHref({ view: "lista", q: "", usage: "all", channel: "cardapio", tab: "visible" })}
            className="ml-2 font-medium text-slate-700 hover:text-slate-900"
          >
            ver ranking completo
          </Link>
        ) : null}
      </div>
    </div>
  );
}
