import { defer, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Await, Form, NavLink, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Suspense } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
  type OwnMenuComparison,
  type AiqfomeResult,
  buildCompetitorMenuDashboard,
  formatCompetitorMenuDateTime,
  searchCompetitorMenuSnapshot,
} from "~/domain/competitor-menu/competitor-menu-analysis";
import { buildOwnMenuComparison } from "~/domain/competitor-menu/competitor-menu-comparison.server";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [{ title: "Vendas | Concorrência | Pesquisar" }];

const emptyOwnMenuComparison: OwnMenuComparison = {
  matchedOwnItemCount: 0,
  unmatchedCompetitorProductCount: 0,
  belowMarketCount: 0,
  marketCount: 0,
  aboveMarketCount: 0,
  items: [],
  opportunities: [],
};

async function loadAnalysis(snapshotId: string, query: string, competitor: string) {
  const snapshot = snapshotId
    ? await prismaClient.competitorMenuSnapshot.findUnique({ where: { id: snapshotId } })
    : await prismaClient.competitorMenuSnapshot.findFirst({ orderBy: { collectedAt: "desc" } });

  if (!snapshot) {
    return {
      snapshot: null,
      competitors: [],
      selectedCompetitor: "",
      totalMatches: 0,
      results: [],
      dashboard: buildCompetitorMenuDashboard([]),
      ownMenuComparison: emptyOwnMenuComparison,
    };
  }

  const payload = snapshot.rawData as unknown as AiqfomeResult;
  const competitors = [...new Set(payload.restaurantes.map((restaurant) => restaurant.nome).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );
  const selectedCompetitor = competitors.includes(competitor) ? competitor : "";
  const results = searchCompetitorMenuSnapshot(payload, query, selectedCompetitor, true);
  const ownMenuComparison = await buildOwnMenuComparison(results);

  return {
    snapshot: {
      id: snapshot.id,
      city: snapshot.city,
      collectedAt: snapshot.collectedAt.toISOString(),
      restaurantCount: snapshot.restaurantCount,
    },
    competitors,
    selectedCompetitor,
    totalMatches: results.length,
    results: results.slice(0, 500),
    dashboard: buildCompetitorMenuDashboard(results),
    ownMenuComparison,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") ?? "").trim();
  const snapshotId = String(url.searchParams.get("snapshot") ?? "").trim();
  const competitor = String(url.searchParams.get("competitor") ?? "").trim();
  const snapshots = await prismaClient.competitorMenuSnapshot.findMany({
    select: { id: true, city: true, collectedAt: true, restaurantCount: true },
    orderBy: { collectedAt: "desc" },
  });

  return defer({
    query,
    snapshotId,
    competitor,
    snapshots,
    analysis: loadAnalysis(snapshotId, query, competitor),
  });
}

export type CompetitorMenuSearchOutletContext = {
  query: string;
  analysis: Awaited<ReturnType<typeof loadAnalysis>>;
};

const tabs = [
  { to: "resultados", label: "Resultados", dotClassName: "bg-sky-500" },
  { to: "dashboard", label: "Dashboard", dotClassName: "bg-emerald-400" },
];

export default function CompetitorMenuSearchLayout() {
  const data = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Analisando coleta...</p>}>
      <Await resolve={data.analysis}>
        {(analysis) => (
          <div className="flex flex-col gap-6">
            <section className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Pesquisar nos cardápios</h2>
                  <p className="text-sm text-muted-foreground">
                    Busque um ingrediente ou filtre todos os produtos de um concorrente.
                  </p>
                </div>
                <nav className="flex flex-wrap items-center gap-8 border-b border-slate-200">
                  {tabs.map((tab) => (
                    <NavLink
                      key={tab.to}
                      to={`${tab.to}${location.search}`}
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
              </div>

              <Form
                method="get"
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(240px,auto)_minmax(260px,auto)_auto]"
              >
                <Input name="q" defaultValue={data.query} placeholder="Buscar ingrediente ou produto" />
                <select
                  name="competitor"
                  defaultValue={analysis.selectedCompetitor}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todos os concorrentes</option>
                  {analysis.competitors.map((competitor) => (
                    <option key={competitor} value={competitor}>
                      {competitor}
                    </option>
                  ))}
                </select>
                <select
                  name="snapshot"
                  defaultValue={data.snapshotId}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Coleta mais recente</option>
                  {data.snapshots.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {snapshot.city} · {formatCompetitorMenuDateTime(snapshot.collectedAt)} ·{" "}
                      {snapshot.restaurantCount} restaurantes
                    </option>
                  ))}
                </select>
                <Button type="submit">Aplicar filtros</Button>
              </Form>
            </section>

            <Separator />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {analysis.snapshot ? (
                <>
                  <Badge variant="secondary">{analysis.snapshot.city}</Badge>
                  <span className="text-muted-foreground">
                    Coleta de {formatCompetitorMenuDateTime(analysis.snapshot.collectedAt)} ·{" "}
                    {analysis.snapshot.restaurantCount} restaurantes
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Nenhuma coleta importada.</span>
              )}
              {analysis.selectedCompetitor ? <Badge variant="outline">{analysis.selectedCompetitor}</Badge> : null}
            </div>

            <Outlet context={{ query: data.query, analysis } satisfies CompetitorMenuSearchOutletContext} />
          </div>
        )}
      </Await>
    </Suspense>
  );
}
