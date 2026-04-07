import { defer } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData, useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import { Suspense, useState, useMemo, useEffect } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { loadItemsGroupData, loadCostVarGroupData } from "~/domain/dashboard/kpi-loader.server";
import type { TopItem, ImpactItem, CostVarItem, CostVarImpactItem, MissingUmItem } from "~/domain/dashboard/kpi-loader.server";
import type { IngredientImpactData } from "~/routes/admin.api.ingredient-impact.$itemId";
import {
  fmtCost,
  fmtMoney,
  fmtPct,
  fmtDateShort,
  varBadgeClass,
  AiPromptModal,
  AiPromptButton,
  TableCardSkeleton,
  SectionError,
  ShowMore,
  VISIBLE,
  type TrendModal,
  LineAreaChart,
} from "~/domain/dashboard/dashboard-ui";

// ─── loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const momMonth = url.searchParams.get("momMonth"); // format: "YYYY-MM"
  let momRef: { year: number; month: number } | undefined;
  if (momMonth) {
    const [y, m] = momMonth.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) momRef = { year: y, month: m };
  }
  return defer({
    itemsData: loadItemsGroupData(),
    costVarData: loadCostVarGroupData(momRef),
  });
}

// ─── ImpactIcon ───────────────────────────────────────────────────────────────

function ImpactIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

// ─── IngredientImpactModal ────────────────────────────────────────────────────

function IngredientImpactModal({
  item,
  data,
  loading,
  onClose,
}: {
  item: CostVarItem;
  data: IngredientImpactData | undefined;
  loading: boolean;
  onClose: () => void;
}) {
  const allVariations = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; kind: string | null }> = [];
    for (const recipe of data.recipes) {
      for (const v of recipe.variations) {
        if (!seen.has(v.variationId)) {
          seen.add(v.variationId);
          result.push({ id: v.variationId, name: v.variationName, kind: v.variationKind });
        }
      }
    }
    return result.sort((a, b) => {
      if (a.kind === "tamanho" && b.kind !== "tamanho") return -1;
      if (b.kind === "tamanho" && a.kind !== "tamanho") return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [data]);

  const defaultId = useMemo(() => {
    const medio = allVariations.find(v =>
      /médi/i.test(v.name) || /media/i.test(v.name) || /médio/i.test(v.name)
    );
    return medio?.id ?? allVariations[0]?.id ?? null;
  }, [allVariations]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { setSelectedId(null); }, [item.itemId]);

  const effectiveId = selectedId ?? defaultId;

  const filteredRecipes = useMemo(
    () =>
      (data?.recipes ?? [])
        .map(recipe => ({
          ...recipe,
          variation: recipe.variations.find(v => v.variationId === effectiveId),
        }))
        .filter(r => r.variation != null),
    [data, effectiveId]
  );

  const totalBefore = filteredRecipes.reduce((s, r) => s + (r.variation?.costBefore ?? 0), 0);
  const totalAfter = filteredRecipes.reduce((s, r) => s + (r.variation?.costAfter ?? 0), 0);
  const totalDelta = totalAfter - totalBefore;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Impacto nas Receitas — {item.name}
          </DialogTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {fmtMoney(item.previous)} → {fmtMoney(item.current)}
            <span className={`ml-2 font-medium ${item.absDelta > 0 ? "text-red-600" : "text-emerald-600"}`}>
              ({item.absDelta > 0 ? "+" : ""}{fmtMoney(item.absDelta)})
            </span>
          </p>
        </DialogHeader>

        {allVariations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 pb-2 border-b border-slate-100">
            {allVariations.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  effectiveId === v.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          )}

          {!loading && filteredRecipes.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">
              {allVariations.length === 0
                ? "Nenhuma receita usa este insumo com dados de variação."
                : "Nenhuma receita encontrada para o tamanho selecionado."}
            </p>
          )}

          {!loading && filteredRecipes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-6">#</TableHead>
                  <TableHead className="text-xs">Receita</TableHead>
                  <TableHead className="text-xs text-right">Qtd.</TableHead>
                  <TableHead className="text-xs text-right">Antes</TableHead>
                  <TableHead className="text-xs text-right">Depois</TableHead>
                  <TableHead className="text-xs text-right">Δ R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipes.map((r, i) => {
                  const v = r.variation!;
                  return (
                    <TableRow key={r.recipeId} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{r.recipeName}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-slate-500">
                        {v.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                        {v.unit ? ` ${v.unit}` : ""}
                        {v.lossPct > 0 && (
                          <span className="ml-1 text-[10px] text-slate-400">({v.lossPct}%↓)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-slate-500">
                        {fmtMoney(v.costBefore)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {fmtMoney(v.costAfter)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant="outline" className={varBadgeClass(v.delta / Math.max(Math.abs(v.costBefore), 0.001) * 100)}>
                          {v.delta > 0 ? "+" : ""}{fmtMoney(v.delta)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {!loading && filteredRecipes.length > 0 && (
          <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
            <span className="text-[11px] text-slate-500">{filteredRecipes.length} receita{filteredRecipes.length !== 1 ? "s" : ""}</span>
            <div className="flex gap-4 items-center">
              <span className="text-[11px] text-slate-400">Total antes: <span className="font-mono text-slate-600">{fmtMoney(totalBefore)}</span></span>
              <span className="text-[11px] text-slate-400">Total depois: <span className="font-mono text-slate-600">{fmtMoney(totalAfter)}</span></span>
              <Badge variant="outline" className={varBadgeClass(totalDelta / Math.max(Math.abs(totalBefore), 0.001) * 100)}>
                {totalDelta > 0 ? "+" : ""}{fmtMoney(totalDelta)}
              </Badge>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── MissingConsumptionUmAlert ────────────────────────────────────────────────

function MissingConsumptionUmAlert({ items }: { items: MissingUmItem[] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 3);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-600">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800">
            {items.length} {items.length === 1 ? "insumo sem" : "insumos sem"} unidade de consumo (consumptionUm)
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            Esses itens têm entradas de custo em unidades diferentes mas sem conversão definida — a variação não pode ser calculada corretamente. Acesse cada item e configure a unidade de consumo.
          </p>
          <ul className="mt-2 space-y-1">
            {visible.map(item => (
              <li key={item.itemId} className="flex items-center gap-2 text-[11px]">
                <a
                  href={`/admin/items/${item.itemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-amber-900 hover:underline"
                >
                  {item.name}
                </a>
                <span className="text-amber-600">
                  ({item.previousUnit ?? "—"} → {item.latestUnit ?? "—"})
                </span>
              </li>
            ))}
          </ul>
          {items.length > 3 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-2 text-[11px] font-medium text-amber-700 hover:underline"
            >
              {expanded ? "Ver menos ↑" : `Ver mais ${items.length - 3} ↓`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NetAvgCard ───────────────────────────────────────────────────────────────

function NetAvgCard({ netAvg, total, increased, decreased, avgIncrease, avgDecrease, latestCurrentDate }: {
  netAvg: number;
  total: number;
  increased: number;
  decreased: number;
  avgIncrease: number | null;
  avgDecrease: number | null;
  latestCurrentDate: string | null;
}) {
  const [open, setOpen] = useState(false);

  const fmt1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtSigned = (v: number) => `${v > 0 ? "+" : ""}${fmt1(v)}%`;

  const monthLabel = latestCurrentDate
    ? new Date(latestCurrentDate).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "este mês";

  const explanation = (() => {
    const parts: string[] = [];
    if (avgIncrease !== null) parts.push(`${increased} × ${fmtSigned(avgIncrease)}`);
    if (avgDecrease !== null) parts.push(`${decreased} × ${fmtSigned(avgDecrease)}`);
    const formula = `(${parts.join(" + ")}) ÷ ${total}`;

    const headline = netAvg > 0
      ? `Seu custo de insumos subiu ${fmt1(Math.abs(netAvg))}% em ${monthLabel} — sua margem encolheu na mesma proporção, a menos que os preços de venda tenham acompanhado.`
      : netAvg < 0
      ? `Seu custo de insumos caiu ${fmt1(Math.abs(netAvg))}% em ${monthLabel} — sua margem melhorou na mesma proporção se os preços de venda ficaram estáveis.`
      : `As variações se equilibraram em ${monthLabel} — o custo médio dos insumos ficou praticamente estável.`;

    const actions: string[] = netAvg > 0 ? [
      `Verifique os ${increased} insumos que subiram e priorize os que têm mais receitas dependentes (veja a tabela "Por Impacto").`,
      `Avalie reajuste de preço nos itens do cardápio que usam os insumos mais afetados.`,
      `Pesquise fornecedores alternativos para os insumos com maior variação positiva.`,
      `Se o aumento for pontual (sazonalidade), considere substituição temporária de ingredientes.`,
    ] : netAvg < 0 ? [
      `Aproveite a queda para revisar os preços de venda — a margem extra pode ser reinvestida ou retida.`,
      `Verifique se a queda é estrutural (mudança de fornecedor) ou pontual (promoção/sazonalidade) antes de tomar decisões de médio prazo.`,
      `Monitore os ${increased} insumos que ainda subiram — eles podem pressionar a margem nos próximos meses.`,
    ] : [
      `Equilíbrio saudável — monitore os ${increased} insumos que subiram para garantir que não se agravem no próximo mês.`,
    ];

    return { formula, headline, actions };
  })();

  return (
    <>
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-start justify-between">
            <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Saldo geral</p>
            <button
              onClick={() => setOpen(true)}
              className="text-slate-300 hover:text-slate-500 transition-colors -mt-0.5"
              title="Como é calculado?"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                <path d="M6.5 6C6.5 5.17 7.17 4.5 8 4.5C8.83 4.5 9.5 5.17 9.5 6C9.5 6.83 8.83 7.5 8 7.5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
            {total} insumos
          </p>
          <p className={`text-2xl font-bold ${netAvg > 0 ? "text-red-600" : netAvg < 0 ? "text-emerald-600" : "text-slate-700"}`}>
            {fmtSigned(netAvg)}
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              O que esse número significa?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 space-y-4">
            <p className={`font-medium ${netAvg > 0 ? "text-red-700" : netAvg < 0 ? "text-emerald-700" : "text-slate-700"}`}>
              {explanation.headline}
            </p>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">O que fazer agora</p>
              <ul className="space-y-1.5">
                {explanation.actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600">
                    <span className="text-slate-300 mt-0.5">→</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">Como é calculado</p>
              <p className="text-xs text-slate-400 mb-1">Média da variação % de todos os {total} insumos (alta e queda):</p>
              <p className="font-mono text-xs bg-slate-50 rounded px-3 py-2 text-slate-500">
                {explanation.formula} ≈ {fmtSigned(netAvg)}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── CostVarTables ────────────────────────────────────────────────────────────

function CostVarTables({ byAbs, byPct, byImpact, missingConsumptionUm, all, momRef }: {
  byAbs: CostVarItem[];
  byPct: CostVarItem[];
  byImpact: CostVarImpactItem[];
  missingConsumptionUm: MissingUmItem[];
  all: CostVarItem[];
  momRef: { year: number; month: number };
}) {
  const [showAllAbs, setShowAllAbs] = useState(false);
  const [showAllPct, setShowAllPct] = useState(false);
  const [showAllImpact, setShowAllImpact] = useState(false);

  const [impactModal, setImpactModal] = useState<CostVarItem | null>(null);
  const impactFetcher = useFetcher<IngredientImpactData>();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Build list of last 12 months as selectable options
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const value = `${year}-${String(month).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { value, label, year, month };
    });
  }, []);

  const selectedValue = `${momRef.year}-${String(momRef.month).padStart(2, "0")}`;

  function onMomMonthChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("momMonth", value);
    navigate(`?${params.toString()}`, { replace: true });
  }

  // Previous month label for display
  const prevMomDate = new Date(momRef.year, momRef.month - 2, 1);
  const prevMonthLabel = prevMomDate.toLocaleDateString("pt-BR", { month: "short" });
  const currMonthLabel = new Date(momRef.year, momRef.month - 1, 1).toLocaleDateString("pt-BR", { month: "short" });

  function openImpact(item: CostVarItem) {
    setImpactModal(item);
    impactFetcher.load(
      `/admin/api/ingredient-impact/${item.itemId}?previous=${item.previous}&current=${item.current}`
    );
  }

  function impactBtn(item: CostVarItem) {
    return (
      <TableCell className="w-7 px-1">
        <button
          title="Ver impacto nas receitas"
          onClick={e => { e.stopPropagation(); openImpact(item); }}
          className="text-slate-300 hover:text-slate-600 transition-colors"
        >
          <ImpactIcon />
        </button>
      </TableCell>
    );
  }

  function prevCell(item: CostVarItem) {
    return (
      <TableCell className="text-xs text-right font-mono text-slate-500">
        <div>{fmtMoney(item.previous)}</div>
        {fmtDateShort(item.previousDate) && <div className="text-[10px] text-slate-400">{fmtDateShort(item.previousDate)}</div>}
      </TableCell>
    );
  }

  function currCell(item: CostVarItem) {
    return (
      <TableCell className="text-xs text-right font-mono">
        <div>{fmtMoney(item.current)}</div>
        {fmtDateShort(item.currentDate) && <div className="text-[10px] text-slate-400">{fmtDateShort(item.currentDate)}</div>}
      </TableCell>
    );
  }

  function momCells(item: CostVarItem) {
    if (item.momPctDelta === null || item.momPctDelta === undefined || item.momPrev === null || item.momCurr === null) {
      return (
        <>
          <TableCell className="text-xs text-right text-slate-300">—</TableCell>
          <TableCell className="text-xs text-right text-slate-300">—</TableCell>
          <TableCell className="text-xs text-right text-slate-300">—</TableCell>
        </>
      );
    }
    return (
      <>
        <TableCell className="text-xs text-right font-mono text-slate-500">
          {fmtMoney(item.momPrev)}
        </TableCell>
        <TableCell className="text-xs text-right font-mono text-slate-500">
          {fmtMoney(item.momCurr)}
        </TableCell>
        <TableCell className="text-xs text-right">
          <Badge variant="outline" className={varBadgeClass(item.momPctDelta)}>
            {fmtPct(item.momPctDelta)}
          </Badge>
        </TableCell>
      </>
    );
  }

  const varTable = (
    items: CostVarItem[],
    showAll: boolean,
    toggle: () => void,
    mode: "abs" | "pct",
  ) => (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
          Variação de Custo — {mode === "abs" ? "Por Valor Absoluto" : "Por Percentual"}
        </p>
        <p className="text-[11px] text-slate-400 mb-3">
          Top {items.length} maiores variações {mode === "abs" ? "em R$" : "em %"}
        </p>
        {items.length === 0
          ? <p className="text-sm text-slate-400 py-4 text-center">Sem variações registradas.</p>
          : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs w-6">#</TableHead>
                    <TableHead className="text-xs">Insumo</TableHead>
                    <TableHead className="text-xs text-right">Antes</TableHead>
                    <TableHead className="text-xs text-right">Depois</TableHead>
                    <TableHead className="text-xs text-right">{mode === "abs" ? "Δ R$" : "Δ %"}</TableHead>
                    <TableHead className="text-xs text-right text-slate-400">Antes ({prevMonthLabel})</TableHead>
                    <TableHead className="text-xs text-right text-slate-400">Depois ({currMonthLabel})</TableHead>
                    <TableHead className="text-xs text-right text-slate-400">MoM Δ%</TableHead>
                    <TableHead className="w-7" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.slice(0, showAll ? items.length : VISIBLE).map((item, i) => (
                    <TableRow key={`${item.itemId}-${i}`} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">
                        <a
                          href={`/admin/items/${item.itemId}/stock-movements`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-blue-600 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {item.name}
                        </a>
                      </TableCell>
                      {prevCell(item)}
                      {currCell(item)}
                      <TableCell className="text-xs text-right">
                        <Badge variant="outline" className={varBadgeClass(item.pctDelta)}>
                          {mode === "abs"
                            ? `${item.absDelta > 0 ? "+" : ""}${fmtMoney(item.absDelta)}`
                            : fmtPct(item.pctDelta)}
                        </Badge>
                      </TableCell>
                      {momCells(item)}
                      {impactBtn(item)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ShowMore expanded={showAll} total={items.length} visible={VISIBLE} onClick={toggle} />
            </>
          )}
      </CardContent>
    </Card>
  );

  const [showCostAiPrompt, setShowCostAiPrompt] = useState(false);

  const increased = all.filter(i => i.pctDelta > 0);
  const decreased = all.filter(i => i.pctDelta < 0);
  const avgIncrease = increased.length > 0
    ? increased.reduce((s, i) => s + i.pctDelta, 0) / increased.length
    : null;
  const avgDecrease = decreased.length > 0
    ? decreased.reduce((s, i) => s + i.pctDelta, 0) / decreased.length
    : null;
  const netAvg = all.length > 0
    ? all.reduce((s, i) => s + i.pctDelta, 0) / all.length
    : null;
  const latestCurrentDate = all
    .map(i => i.currentDate)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const momItems = all.filter(i => i.momPctDelta !== null);
  const momIncreased = momItems.filter(i => (i.momPctDelta ?? 0) > 0);
  const momDecreased = momItems.filter(i => (i.momPctDelta ?? 0) < 0);
  const momNetAvg = momItems.length > 0
    ? momItems.reduce((s, i) => s + (i.momPctDelta ?? 0), 0) / momItems.length
    : null;
  const momAvgIncrease = momIncreased.length > 0
    ? momIncreased.reduce((s, i) => s + (i.momPctDelta ?? 0), 0) / momIncreased.length
    : null;
  const momAvgDecrease = momDecreased.length > 0
    ? momDecreased.reduce((s, i) => s + (i.momPctDelta ?? 0), 0) / momDecreased.length
    : null;

  const fmtMom = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  function buildCostPrompt() {
    const fmtPct1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    const fmtBRLm = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const monthRef = latestCurrentDate
      ? new Date(latestCurrentDate).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : "mês corrente";

    const sortedUp = [...increased].sort((a, b) => b.pctDelta - a.pctDelta);
    const sortedDown = [...decreased].sort((a, b) => a.pctDelta - b.pctDelta);

    const upLines = sortedUp.map(i => {
      const mom = i.momPctDelta != null ? `, MoM ${fmtPct1(i.momPctDelta)}` : "";
      return `  - ${i.name}: ${fmtBRLm(i.previous)} → ${fmtBRLm(i.current)} (Δ ${fmtPct1(i.pctDelta)}${mom})`;
    }).join("\n");

    const downLines = sortedDown.map(i => {
      const mom = i.momPctDelta != null ? `, MoM ${fmtPct1(i.momPctDelta)}` : "";
      return `  - ${i.name}: ${fmtBRLm(i.previous)} → ${fmtBRLm(i.current)} (Δ ${fmtPct1(i.pctDelta)}${mom})`;
    }).join("\n");

    const impactLines = byImpact.slice(0, 5).map(i => {
      const mom = i.momPctDelta != null ? `, MoM ${fmtPct1(i.momPctDelta)}` : "";
      return `  - ${i.name}: ${i.recipeUsageCount} receita${i.recipeUsageCount !== 1 ? "s" : ""} afetada${i.recipeUsageCount !== 1 ? "s" : ""}, Δ ${fmtPct1(i.pctDelta)}${mom}`;
    }).join("\n");

    const netLine = netAvg != null ? `Variação líquida média — Δ recente: ${fmtPct1(netAvg)}` : "";
    const momNetLine = momNetAvg != null
      ? `Variação líquida média — MoM (${prevMonthLabel}→${currMonthLabel}): ${fmtPct1(momNetAvg)}`
      : "";

    // Items where MoM diverges significantly from the recent delta (potential trend signal)
    const divergent = all
      .filter(i => i.momPctDelta != null && Math.abs((i.momPctDelta ?? 0) - i.pctDelta) > 5)
      .sort((a, b) => Math.abs((b.momPctDelta ?? 0) - b.pctDelta) - Math.abs((a.momPctDelta ?? 0) - a.pctDelta))
      .slice(0, 5);
    const divergentLines = divergent.map(i =>
      `  - ${i.name}: Δ recente ${fmtPct1(i.pctDelta)} vs MoM ${fmtPct1(i.momPctDelta!)}`
    ).join("\n");

    return `Você é um consultor de negócios especializado em restaurantes e pizzarias. Analise os dados abaixo e forneça recomendações práticas considerando tanto a variação recente quanto a tendência mês a mês.

## CONTEXTO

- **Δ recente**: comparação entre os dois últimos preços registrados de cada insumo (pode abranger qualquer intervalo de tempo)
- **MoM (${prevMonthLabel}→${currMonthLabel})**: preço vigente no fim de ${prevMonthLabel} vs preço vigente no fim de ${currMonthLabel} — comparação calendário fixa, ideal para tendência estratégica

## RESUMO — ${monthRef.toUpperCase()}

${netLine}
${momNetLine}

## INSUMOS QUE SUBIRAM (${increased.length} no total)
${upLines || "  (nenhum)"}

## INSUMOS QUE CAÍRAM (${decreased.length} no total)
${downLines || "  (nenhum)"}

## TOP INSUMOS POR IMPACTO NAS RECEITAS
${impactLines || "  (sem dados)"}
${divergent.length > 0 ? `
## DIVERGÊNCIA Δ RECENTE vs MoM (possível reversão ou aceleração de tendência)
${divergentLines}` : ""}

## O QUE PRECISO

1. **Prioridade imediata**: quais insumos merecem atenção urgente considerando Δ recente E MoM?
2. **Tendências preocupantes**: algum insumo que caiu no recente mas subiu no MoM (ou vice-versa)? O que isso sinaliza?
3. **Impacto na margem**: com base nos insumos mais usados em receitas, como isso afeta meu lucro?
4. **Ações de curto prazo** (próximas 2 semanas):
   - Negociação com fornecedores: quais e como abordar?
   - Substituição de ingredientes: onde é viável sem impactar qualidade?
   - Ajuste de cardápio: algum item merece revisão de preço ou descontinuação?
5. **1 oportunidade** que você enxerga nos insumos que caíram de preço.

Seja direto e objetivo. Prefiro sugestões específicas ao meu contexto a conselhos genéricos.`;
  }

  return (
    <>
      <MissingConsumptionUmAlert items={missingConsumptionUm} />

      <AiPromptButton onClick={() => setShowCostAiPrompt(true)} />

      {showCostAiPrompt && (
        <AiPromptModal
          title="Prompt — Análise de Custos de Insumos"
          prompt={buildCostPrompt()}
          onClose={() => setShowCostAiPrompt(false)}
        />
      )}

      {(avgIncrease !== null || avgDecrease !== null) && (
        <div className="grid grid-cols-2 gap-6">
          {/* ── Coluna esquerda: Δ recente (último preço vs penúltimo) ── */}
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Δ Recente — último preço vs anterior registrado
            </p>
            <div className="grid grid-cols-3 gap-3">
              {avgIncrease !== null && (
                <Card className="p-4">
                  <CardContent className="p-0">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Com alta</p>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                      {increased.length} insumo{increased.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      +{avgIncrease.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </p>
                  </CardContent>
                </Card>
              )}
              {avgDecrease !== null && (
                <Card className="p-4">
                  <CardContent className="p-0">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Com queda</p>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                      {decreased.length} insumo{decreased.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {avgDecrease.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </p>
                  </CardContent>
                </Card>
              )}
              {netAvg !== null && (
                <NetAvgCard
                  netAvg={netAvg}
                  total={all.length}
                  increased={increased.length}
                  decreased={decreased.length}
                  avgIncrease={avgIncrease}
                  avgDecrease={avgDecrease}
                  latestCurrentDate={latestCurrentDate}
                />
              )}
            </div>
          </div>

          {/* ── Coluna direita: MoM com seletor de mês ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                MoM — {prevMonthLabel} → {currMonthLabel}
              </p>
              <select
                value={selectedValue}
                onChange={e => onMomMonthChange(e.target.value)}
                className="text-[10px] border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
              >
                {monthOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4">
                <CardContent className="p-0">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Com alta</p>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                    {momIncreased.length} insumo{momIncreased.length !== 1 ? "s" : ""}
                  </p>
                  {momAvgIncrease !== null
                    ? <p className="text-2xl font-bold text-red-500">{fmtMom(momAvgIncrease)}</p>
                    : <p className="text-2xl font-bold text-slate-300">—</p>
                  }
                </CardContent>
              </Card>
              <Card className="p-4">
                <CardContent className="p-0">
                  <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Com queda</p>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                    {momDecreased.length} insumo{momDecreased.length !== 1 ? "s" : ""}
                  </p>
                  {momAvgDecrease !== null
                    ? <p className="text-2xl font-bold text-emerald-600">{fmtMom(momAvgDecrease)}</p>
                    : <p className="text-2xl font-bold text-slate-300">—</p>
                  }
                </CardContent>
              </Card>
              {momNetAvg !== null && (
                <Card className="p-4">
                  <CardContent className="p-0">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">Saldo MoM</p>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                      {momItems.length} insumo{momItems.length !== 1 ? "s" : ""}
                    </p>
                    <p className={`text-2xl font-bold ${momNetAvg > 0 ? "text-red-500" : momNetAvg < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {fmtMom(momNetAvg)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {byImpact.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
              Variação de Custo — Por Impacto nas Receitas
            </p>
            <p className="text-[11px] text-slate-400 mb-3">
              Top {byImpact.length} — variação ponderada pelo número de receitas que usam o insumo
            </p>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-6">#</TableHead>
                  <TableHead className="text-xs">Insumo</TableHead>
                  <TableHead className="text-xs text-right">Usos</TableHead>
                  <TableHead className="text-xs text-right">Antes</TableHead>
                  <TableHead className="text-xs text-right">Depois</TableHead>
                  <TableHead className="text-xs text-right">Δ R$</TableHead>
                  <TableHead className="text-xs text-right text-slate-400">Antes ({prevMonthLabel})</TableHead>
                  <TableHead className="text-xs text-right text-slate-400">Depois ({currMonthLabel})</TableHead>
                  <TableHead className="text-xs text-right text-slate-400">MoM Δ%</TableHead>
                  <TableHead className="w-7" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {byImpact.slice(0, showAllImpact ? byImpact.length : VISIBLE).map((item, i) => (
                  <TableRow key={`${item.itemId}-${i}`} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">
                      <a
                        href={`/admin/items/${item.itemId}/stock-movements`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-blue-600 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {item.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-xs text-right text-slate-500">{item.recipeUsageCount}x</TableCell>
                    {prevCell(item)}
                    {currCell(item)}
                    <TableCell className="text-xs text-right">
                      <Badge variant="outline" className={varBadgeClass(item.pctDelta)}>
                        {item.absDelta > 0 ? "+" : ""}{fmtMoney(item.absDelta)}
                      </Badge>
                    </TableCell>
                    {momCells(item)}
                    {impactBtn(item)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ShowMore expanded={showAllImpact} total={byImpact.length} visible={VISIBLE} onClick={() => setShowAllImpact(v => !v)} />
          </CardContent>
        </Card>
      )}

      {varTable(byAbs, showAllAbs, () => setShowAllAbs(v => !v), "abs")}
      {varTable(byPct, showAllPct, () => setShowAllPct(v => !v), "pct")}

      {impactModal && (
        <IngredientImpactModal
          item={impactModal}
          data={impactFetcher.data}
          loading={impactFetcher.state === "loading"}
          onClose={() => setImpactModal(null)}
        />
      )}
    </>
  );
}

// ─── ItemsTables ──────────────────────────────────────────────────────────────

function ItemsTables({
  topExpensive,
  topImpact,
  onItemTrend,
  onImpactTrend,
}: {
  topExpensive: TopItem[];
  topImpact: ImpactItem[];
  onItemTrend: (m: TrendModal) => void;
  onImpactTrend: (m: TrendModal) => void;
}) {
  const [showAllExpensive, setShowAllExpensive] = useState(false);
  const [showAllImpact, setShowAllImpact] = useState(false);

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Top {topImpact.length} Insumos Mais Impactantes
          </p>
          <p className="text-[11px] text-slate-400 mb-3">Custo acumulado nas receitas — clique para ver andamento</p>
          {topImpact.length === 0
            ? <p className="text-sm text-slate-400 py-4 text-center">Sem dados de receitas.</p>
            : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-6">#</TableHead>
                      <TableHead className="text-xs">Insumo</TableHead>
                      <TableHead className="text-xs text-right">Usos</TableHead>
                      <TableHead className="text-xs text-right">Impacto total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topImpact.slice(0, showAllImpact ? topImpact.length : VISIBLE).map((item, i) => (
                      <TableRow
                        key={item.itemId}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => onImpactTrend({
                          title: item.name,
                          consumptionUm: item.consumptionUm,
                          trend: item.trend,
                          latestCost: item.latestCostPerConsumptionUnit,
                          avgCost: null,
                        })}
                      >
                        <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{item.name}</TableCell>
                        <TableCell className="text-xs text-right text-slate-500">{item.recipeUsageCount}x</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtMoney(item.totalCostImpact)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ShowMore expanded={showAllImpact} total={topImpact.length} visible={VISIBLE} onClick={() => setShowAllImpact(v => !v)} />
              </>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Top {topExpensive.length} Insumos Mais Caros
          </p>
          <p className="text-[11px] text-slate-400 mb-3">Clique para ver o andamento de custo</p>
          {topExpensive.length === 0
            ? <p className="text-sm text-slate-400 py-4 text-center">Sem dados de custo.</p>
            : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-6">#</TableHead>
                      <TableHead className="text-xs">Insumo</TableHead>
                      <TableHead className="text-xs text-right">Custo médio</TableHead>
                      <TableHead className="text-xs text-right">Custo atual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topExpensive.slice(0, showAllExpensive ? topExpensive.length : VISIBLE).map((item, i) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => onItemTrend({
                          title: item.name,
                          consumptionUm: item.consumptionUm,
                          trend: item.trend,
                          latestCost: item.latestCostPerConsumptionUnit,
                          avgCost: item.averageCostPerConsumptionUnit,
                          avgSamples: item.averageSamplesCount,
                        })}
                      >
                        <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{item.name}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtCost(item.averageCostPerConsumptionUnit, item.consumptionUm)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtCost(item.latestCostPerConsumptionUnit, item.consumptionUm)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ShowMore expanded={showAllExpensive} total={topExpensive.length} visible={VISIBLE} onClick={() => setShowAllExpensive(v => !v)} />
              </>
            )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DashboardCustos() {
  const { itemsData, costVarData } = useLoaderData<typeof loader>();
  const [trendModal, setTrendModal] = useState<TrendModal | null>(null);

  return (
    <>
      <div className="flex flex-col gap-6">

        <Suspense fallback={<><TableCardSkeleton /><TableCardSkeleton /><TableCardSkeleton /></>}>
          <Await resolve={costVarData} errorElement={<SectionError label="tabelas de variação" />}>
            {(data) => (
              <CostVarTables
                byAbs={data.byAbs}
                byPct={data.byPct}
                byImpact={data.byImpact}
                missingConsumptionUm={data.missingConsumptionUm}
                all={data.all}
                momRef={data.momRef}
              />
            )}
          </Await>
        </Suspense>

        <Suspense fallback={<><TableCardSkeleton /><TableCardSkeleton /></>}>
          <Await resolve={itemsData} errorElement={<SectionError label="tabelas de insumos" />}>
            {(data) => (
              <ItemsTables
                {...data}
                onItemTrend={setTrendModal}
                onImpactTrend={setTrendModal}
              />
            )}
          </Await>
        </Suspense>

      </div>

      {/* ── Trend modal ── */}
      <Dialog open={trendModal !== null} onOpenChange={open => { if (!open) setTrendModal(null); }}>
        <DialogContent className="max-w-2xl">
          {trendModal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  {trendModal.title}
                </DialogTitle>
                <p className="text-[11px] text-slate-400">Andamento do custo — últimos 60 dias</p>
              </DialogHeader>
              <div className="mt-2">
                {trendModal.trend.length === 0
                  ? <div className="flex h-32 items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">Sem histórico suficiente.</div>
                  : (
                    <LineAreaChart
                      data={trendModal.trend.map(p => p.value)}
                      labels={trendModal.trend.map(p => p.label)}
                      title={`trend-${trendModal.title}`}
                      h={200}
                    />
                  )}
                <div className="mt-4 flex gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Custo atual</p>
                    <p className="text-base font-semibold text-slate-900">{fmtCost(trendModal.latestCost, trendModal.consumptionUm)}</p>
                  </div>
                  {trendModal.avgCost != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Custo médio{trendModal.avgSamples ? ` (${trendModal.avgSamples} amostras)` : ""}
                      </p>
                      <p className="text-base font-semibold text-slate-700">{fmtCost(trendModal.avgCost, trendModal.consumptionUm)}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
