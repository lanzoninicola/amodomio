import type { MetaFunction } from "@remix-run/node";
import { Link, useOutletContext } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { normalizeCompetitorMenuText } from "~/domain/competitor-menu/competitor-menu-analysis";
import type { CompetitorMenuSearchOutletContext } from "./admin.vendas.analise-cardapio-concorrencia.pesquisar";

export const meta: MetaFunction = () => [{ title: "Vendas | Concorrência | Resultados" }];

export default function CompetitorMenuSearchResultsPage() {
  const { query, analysis } = useOutletContext<CompetitorMenuSearchOutletContext>();
  const hasFilters = Boolean(query || analysis.selectedCompetitor);
  const ownMatches = new Map(
    analysis.ownMenuComparison.items.map((item) => [normalizeCompetitorMenuText(item.ownItemName), item])
  );

  if (!hasFilters) {
    return (
      <p className="text-sm text-muted-foreground">Informe um termo ou selecione um concorrente para pesquisar.</p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {analysis.totalMatches} resultado{analysis.totalMatches === 1 ? "" : "s"}
          {query ? ` para “${query}”` : ""}
        </h2>
        {analysis.totalMatches > 500 ? (
          <p className="text-sm text-muted-foreground">Mostrando os primeiros 500 resultados.</p>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Concorrente</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Preços</TableHead>
            <TableHead>Nosso cardápio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analysis.results.map((result, index) => (
            <TableRow key={`${result.restaurant}-${result.section}-${result.item}-${index}`}>
              <TableCell className="min-w-44 align-top">
                <a href={result.restaurantUrl} target="_blank" rel="noreferrer" className="font-medium underline">
                  {result.restaurant}
                </a>
                <div className="mt-1 text-xs text-muted-foreground">
                  {result.sectionType} · {result.section}
                </div>
              </TableCell>
              <TableCell className="min-w-44 align-top font-medium">{result.item}</TableCell>
              <TableCell className="min-w-64 align-top text-muted-foreground">
                {result.description || "Sem descrição"}
              </TableCell>
              <TableCell className="min-w-52 align-top">
                <div className="flex flex-col gap-1">
                  {result.prices.length ? (
                    result.prices.map((price) => (
                      <div key={price.size} className="text-xs">
                        <span className="font-medium">{price.size}:</span> {price.price}
                        {price.originalPrice ? (
                          <span className="ml-1 text-muted-foreground line-through">{price.originalPrice}</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem preço informado</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="min-w-64 align-top">
                {(() => {
                  const match = ownMatches.get(normalizeCompetitorMenuText(result.item));
                  if (!match) return <span className="text-xs text-muted-foreground">Sem equivalente exato</span>;

                  return (
                    <div className="flex flex-col gap-2">
                      <Link to={`/admin/items/${match.ownItemId}/venda/precos`} className="font-medium underline">
                        {match.ownItemName}
                      </Link>
                      <div className="flex flex-wrap gap-1">
                        {match.variations.map((variation) => (
                          <Badge key={variation.sizeKey} variant="outline" className="text-[10px]">
                            {variation.sizeName}: {formatMoney(variation.ownPrice)} ·{" "}
                            {positionLabel[variation.position]}
                            {variation.marketAverage !== null ? ` · média ${formatMoney(variation.marketAverage)}` : ""}
                            {variation.differenceFromAveragePerc !== null
                              ? ` (${formatDifference(variation.differenceFromAveragePerc)})`
                              : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
          {analysis.results.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Nenhum produto encontrado.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </section>
  );
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDifference = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;

const positionLabel = {
  "below-market": "abaixo",
  market: "na faixa",
  "above-market": "acima",
  "no-market-data": "sem comparação",
} as const;
