import type { MetaFunction } from "@remix-run/node";
import { Link, useOutletContext } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import type { CompetitorMenuSearchOutletContext } from "./admin.vendas.analise-cardapio-concorrencia.pesquisar";

export const meta: MetaFunction = () => [{ title: "Vendas | Concorrência | Dashboard" }];

const formatMoney = (value: number | null) =>
  value === null ? "Sem dados" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function CompetitorMenuSearchDashboardPage() {
  const { query, analysis } = useOutletContext<CompetitorMenuSearchOutletContext>();
  const dashboard = analysis.dashboard;
  const comparison = analysis.ownMenuComparison;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {query || analysis.selectedCompetitor
            ? "Indicadores calculados sobre o filtro aplicado."
            : "Visão geral de todos os produtos da coleta selecionada."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Metric label="Produtos" value={dashboard.totalProducts.toLocaleString("pt-BR")} />
        <Metric label="Concorrentes" value={dashboard.competitorCount.toLocaleString("pt-BR")} />
        <Metric label="Ofertas de preço" value={dashboard.priceOfferCount.toLocaleString("pt-BR")} />
        <Metric label="Preços promocionais" value={dashboard.promotionCount.toLocaleString("pt-BR")} />
        <Metric label="Preço médio" value={formatMoney(dashboard.averagePrice)} />
        <Metric label="Menor preço" value={formatMoney(dashboard.minimumPrice)} />
        <Metric label="Maior preço" value={formatMoney(dashboard.maximumPrice)} />
      </div>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Comparação com nosso cardápio</h2>
          <p className="text-sm text-muted-foreground">
            Correspondência conservadora por nome do produto. Posição de preço considera tolerância de 5% sobre a média
            concorrente do mesmo tamanho reconhecido.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-5">
          <Metric label="Itens próprios encontrados" value={comparison.matchedOwnItemCount.toLocaleString("pt-BR")} />
          <Metric
            label="Oportunidades sem equivalente"
            value={comparison.unmatchedCompetitorProductCount.toLocaleString("pt-BR")}
          />
          <Metric label="Abaixo do mercado" value={comparison.belowMarketCount.toLocaleString("pt-BR")} />
          <Metric label="Na faixa do mercado" value={comparison.marketCount.toLocaleString("pt-BR")} />
          <Metric label="Acima do mercado" value={comparison.aboveMarketCount.toLocaleString("pt-BR")} />
        </div>
      </section>

      <Separator />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Posição dos nossos preços</h3>
          <div className="flex flex-col">
            {comparison.items.slice(0, 12).map((item, index) => (
              <div key={item.ownItemId}>
                <div className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/admin/items/${item.ownItemId}/venda/precos`} className="font-medium underline">
                      {item.ownItemName}
                    </Link>
                    <span className="text-xs text-muted-foreground">{item.competitorCount} concorrente(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.variations.map((variation) => (
                      <Badge key={variation.sizeKey} variant="outline" className={positionClass[variation.position]}>
                        {variation.sizeName}: {formatMoney(variation.ownPrice)} · {positionLabel[variation.position]}
                        {variation.marketAverage !== null ? ` · média ${formatMoney(variation.marketAverage)}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
                {index < Math.min(comparison.items.length, 12) - 1 ? <Separator /> : null}
              </div>
            ))}
            {comparison.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item próprio correspondente.</p>
            ) : null}
          </div>
        </section>

        <Ranking
          title="Oportunidades sem equivalente no nosso cardápio"
          rows={comparison.opportunities.map((item) => ({ name: item.productName, count: item.competitorCount }))}
        />
      </div>

      <Separator />

      <div className="grid gap-8 lg:grid-cols-3">
        <Ranking title="Concorrentes com mais produtos" rows={dashboard.topCompetitors} />
        <Ranking title="Tamanhos mais ofertados" rows={dashboard.topSizes} />
        <Ranking title="Seções com mais produtos" rows={dashboard.topSections} />
      </div>
    </div>
  );
}

const positionLabel = {
  "below-market": "abaixo",
  market: "na faixa",
  "above-market": "acima",
  "no-market-data": "sem comparação",
} as const;

const positionClass = {
  "below-market": "border-emerald-200 bg-emerald-50 text-emerald-800",
  market: "border-sky-200 bg-sky-50 text-sky-800",
  "above-market": "border-amber-200 bg-amber-50 text-amber-900",
  "no-market-data": "text-muted-foreground",
} as const;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Ranking({ title, rows }: { title: string; rows: Array<{ name: string; count: number }> }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex flex-col">
        {rows.map((row, index) => (
          <div key={row.name}>
            <div className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="font-semibold tabular-nums">{row.count}</span>
            </div>
            {index < rows.length - 1 ? <Separator /> : null}
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados para este filtro.</p> : null}
      </div>
    </section>
  );
}
