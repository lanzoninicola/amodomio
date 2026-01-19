import { json, type LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [
  { title: "Dashboard de interesse" },
  { name: "robots", content: "noindex" },
];

type InterestCounts = {
  view_list: number;
  open_detail: number;
  like: number;
  share: number;
};

type ItemInterest = {
  id: string;
  name: string;
  counts7d: InterestCounts;
  counts30d: InterestCounts;
};

type MonthRange = {
  label: string;
  start: Date;
  end: Date;
};

type MonthOption = {
  value: string;
  label: string;
};

const emptyCounts: InterestCounts = {
  view_list: 0,
  open_detail: 0,
  like: 0,
  share: 0,
};

const calculateScore = (counts: InterestCounts) =>
  counts.view_list * 1 +
  counts.open_detail * 4 +
  counts.like * 6 +
  counts.share * 9;

const buildCountMap = (
  rows: { menuItemId: string; type: string; _count?: { _all?: number } | number }[]
) => {
  const map = new Map<string, InterestCounts>();

  rows.forEach((row) => {
    const existing = map.get(row.menuItemId) ?? { ...emptyCounts };
    if (row.type in existing) {
      existing[row.type as keyof InterestCounts] = getGroupCount(row);
    }
    map.set(row.menuItemId, existing);
  });

  return map;
};

const getGroupCount = (row: { _count?: { _all?: number } | number }) => {
  if (typeof row._count === "number") return row._count;
  return row._count?._all ?? 0;
};

const resolveMonthRange = (monthParam: string | null): MonthRange => {
  const now = new Date();
  const base = monthParam ? new Date(`${monthParam}-01T00:00:00`) : now;
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  return { label, start, end };
};

const resolvePreviousMonthRange = (current: MonthRange): MonthRange => {
  const prevStart = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1);
  const prevEnd = new Date(current.start.getFullYear(), current.start.getMonth(), 1);
  const label = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, "0")}`;

  return { label, start: prevStart, end: prevEnd };
};

const buildMonthOptions = (base: MonthRange, total = 12): MonthOption[] => {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return Array.from({ length: total }).map((_, index) => {
    const date = new Date(base.start.getFullYear(), base.start.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = formatter.format(date);
    return { value, label };
  });
};
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const currentMonth = resolveMonthRange(url.searchParams.get("month"));
  const previousMonth = resolvePreviousMonthRange(currentMonth);
  const monthOptions = buildMonthOptions(currentMonth, 12);

  const [eventsCurrent, eventsPrevious, likesCurrent, likesPrevious, sharesCurrent, sharesPrevious] =
    await Promise.all([
    prismaClient.menuItemInterestEvent.groupBy({
      by: ["menuItemId", "type"],
      _count: { _all: true },
      where: { createdAt: { gte: currentMonth.start, lt: currentMonth.end } },
    }),
    prismaClient.menuItemInterestEvent.groupBy({
      by: ["menuItemId", "type"],
      _count: { _all: true },
      where: { createdAt: { gte: previousMonth.start, lt: previousMonth.end } },
    }),
    prismaClient.menuItemLike.groupBy({
      by: ["menuItemId"],
      _sum: { amount: true },
      where: { createdAt: { gte: currentMonth.start, lt: currentMonth.end }, deletedAt: null },
    }),
    prismaClient.menuItemShare.groupBy({
      by: ["menuItemId"],
      _count: { _all: true },
      where: { createdAt: { gte: currentMonth.start, lt: currentMonth.end } },
    }),
    prismaClient.menuItemLike.groupBy({
      by: ["menuItemId"],
      _sum: { amount: true },
      where: { createdAt: { gte: previousMonth.start, lt: previousMonth.end }, deletedAt: null },
    }),
    prismaClient.menuItemShare.groupBy({
      by: ["menuItemId"],
      _count: { _all: true },
      where: { createdAt: { gte: previousMonth.start, lt: previousMonth.end } },
    }),
  ]);

  const mapCurrent = buildCountMap(eventsCurrent);
  const mapPrevious = buildCountMap(eventsPrevious);

  const menuItemIds = Array.from(
    new Set([
      ...mapCurrent.keys(),
      ...mapPrevious.keys(),
      ...likesCurrent.map((row) => row.menuItemId).filter(Boolean),
      ...sharesCurrent.map((row) => row.menuItemId).filter(Boolean),
      ...likesPrevious.map((row) => row.menuItemId).filter(Boolean),
      ...sharesPrevious.map((row) => row.menuItemId).filter(Boolean),
    ])
  ) as string[];

  const items = await prismaClient.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, name: true },
  });

  const itemsById = new Map(items.map((item) => [item.id, item.name]));

  const interestItems: ItemInterest[] = menuItemIds
    .map((id) => ({
      id,
      name: itemsById.get(id) ?? "Item desconhecido",
      counts7d: mapCurrent.get(id) ?? { ...emptyCounts },
      counts30d: mapPrevious.get(id) ?? { ...emptyCounts },
    }))
    .filter((item) => item.name !== "Item desconhecido");

  const interestRateItems = interestItems
    .map((item) => ({
      ...item,
      rate:
        item.counts7d.view_list > 0
          ? item.counts7d.open_detail / item.counts7d.view_list
          : 0,
      ratePrev:
        item.counts30d.view_list > 0
          ? item.counts30d.open_detail / item.counts30d.view_list
          : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  const openDetailItems = [...interestItems]
    .sort((a, b) => b.counts7d.open_detail - a.counts7d.open_detail)
    .slice(0, 8);

  const likesMap = new Map(
    likesCurrent.map((row) => [
      row.menuItemId,
      Number(row._sum?.amount) || 0,
    ])
  );
  const sharesMap = new Map(
    sharesCurrent.map((row) => [row.menuItemId, getGroupCount(row)])
  );
  const likesPrevMap = new Map(
    likesPrevious.map((row) => [
      row.menuItemId,
      Number(row._sum?.amount) || 0,
    ])
  );
  const sharesPrevMap = new Map(
    sharesPrevious.map((row) => [row.menuItemId, getGroupCount(row)])
  );

  const engagementItems = interestItems
    .map((item) => ({
      id: item.id,
      name: item.name,
      likes: likesMap.get(item.id) ?? 0,
      shares: sharesMap.get(item.id) ?? 0,
      likesPrev: likesPrevMap.get(item.id) ?? 0,
      sharesPrev: sharesPrevMap.get(item.id) ?? 0,
    }))
    .sort((a, b) => b.likes + b.shares - (a.likes + a.shares))
    .slice(0, 8);

  const rankingItems = [...interestItems]
    .map((item) => ({
      id: item.id,
      name: item.name,
      score7d: calculateScore(item.counts7d),
      score30d: calculateScore(item.counts30d),
    }))
    .sort((a, b) => {
      if (b.score7d !== a.score7d) return b.score7d - a.score7d;
      return b.score30d - a.score30d;
    })
    .slice(0, 8);

  return json({
    currentMonth: currentMonth.label,
    previousMonth: previousMonth.label,
    monthOptions,
    interestRateItems,
    openDetailItems,
    engagementItems,
    rankingItems,
  });
}

export default function AdminGerenciamentoCardapioTracking() {
  const {
    interestRateItems,
    openDetailItems,
    engagementItems,
    rankingItems,
    currentMonth,
    previousMonth,
    monthOptions,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const selectedMonth = searchParams.get("month") ?? currentMonth;
  const currentLabel =
    monthOptions.find((option) => option.value === currentMonth)?.label ??
    currentMonth;
  const previousLabel =
    monthOptions.find((option) => option.value === previousMonth)?.label ??
    previousMonth;

  const pctDiff = (curr?: number, ref?: number) => {
    const c = Number(curr ?? 0);
    const r = Number(ref ?? 0);
    if (!isFinite(c) || !isFinite(r) || r === 0) {
      return { text: "--", cls: "text-muted-foreground" };
    }
    const p = ((c - r) / r) * 100;
    const sign = p > 0 ? "▲" : p < 0 ? "▼" : "▲";
    const color =
      p > 0 ? "text-emerald-600" : p < 0 ? "text-red-600" : "text-slate-500";
    return { text: `${sign} ${Math.abs(p).toFixed(1)}%`, cls: color };
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Dashboard
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Interesse do cardapio
          </h2>
          <p className="text-sm text-slate-600">
            Veja como os clientes exploram a vitrine e quais sabores geram mais
            curiosidade.
          </p>
        </div>
        <form className="mt-1 flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Mes
          </label>
          <div className="flex items-center gap-2">
            <select
              name="month"
              defaultValue={selectedMonth}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm capitalize focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm transition hover:border-slate-300"
            >
              Atualizar
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            Comparando {currentLabel} x {previousLabel}
          </span>
        </form>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Exposicao e taxa de interesse
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Compara quantas vezes o item apareceu (view_list) com quantas vezes
            foi aberto (open_detail). Isso mostra quais sabores chamam mais
            atencao por exposicao.
          </p>
          {interestRateItems.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-muted px-4 py-6 text-sm text-muted-foreground">
              Sem dados de view_list/open_detail no mes selecionado.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-md border border-muted">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sabor</th>
                    <th className="px-3 py-2 text-right font-medium">Taxa mês</th>
                    <th className="px-3 py-2 text-right font-medium">Mês anterior</th>
                    <th className="px-3 py-2 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {interestRateItems.map((item) => {
                    const diff = pctDiff(item.rate, item.ratePrev);
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {(item.rate * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {(item.ratePrev * 100).toFixed(1)}%
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${diff.cls}`}>
                          {diff.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Aberturas de detalhes
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Mostra quais sabores foram mais explorados. E um indicativo direto
            de curiosidade sobre ingredientes e descricao.
          </p>
          {openDetailItems.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-muted px-4 py-6 text-sm text-muted-foreground">
              Sem aberturas registradas no mes selecionado.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-md border border-muted">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sabor</th>
                    <th className="px-3 py-2 text-right font-medium">Aberturas mês</th>
                    <th className="px-3 py-2 text-right font-medium">Mês anterior</th>
                    <th className="px-3 py-2 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {openDetailItems.map((item) => {
                    const diff = pctDiff(item.counts7d.open_detail, item.counts30d.open_detail);
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {item.counts7d.open_detail}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {item.counts30d.open_detail}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${diff.cls}`}>
                          {diff.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Engajamento leve
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Soma de curtidas e compartilhamentos. Ajuda a identificar sabores
            que geram preferencia e recomendacao.
          </p>
          {engagementItems.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-muted px-4 py-6 text-sm text-muted-foreground">
              Sem curtidas ou compartilhamentos recentes.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-md border border-muted">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sabor</th>
                    <th className="px-3 py-2 text-right font-medium">Likes mês</th>
                    <th className="px-3 py-2 text-right font-medium">Shares mês</th>
                    <th className="px-3 py-2 text-right font-medium">Mês anterior</th>
                    <th className="px-3 py-2 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {engagementItems.map((item) => {
                    const currentTotal = item.likes + item.shares;
                    const previousTotal = item.likesPrev + item.sharesPrev;
                    const diff = pctDiff(currentTotal, previousTotal);
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {item.likes}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {item.shares}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {item.likesPrev} · {item.sharesPrev}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${diff.cls}`}>
                          {diff.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-muted bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Ranking geral de interesse
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Combina todos os sinais com pesos sugeridos para mostrar a ordem de
            interesse no periodo.
          </p>
          {rankingItems.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-muted px-4 py-6 text-sm text-muted-foreground">
              Sem eventos suficientes para montar o ranking.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-md border border-muted">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sabor</th>
                    <th className="px-3 py-2 text-right font-medium">Score mês</th>
                    <th className="px-3 py-2 text-right font-medium">Mês anterior</th>
                    <th className="px-3 py-2 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingItems.map((item) => {
                    const diff = pctDiff(item.score7d, item.score30d);
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {item.name}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {item.score7d} pts
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {item.score30d} pts
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${diff.cls}`}>
                          {diff.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
