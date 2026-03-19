import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";

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

export async function loader({ request }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const url = new URL(request.url);
  const priority = String(url.searchParams.get("priority") || "").trim();
  const q = String(url.searchParams.get("q") || "").trim();
  const dateFrom = String(url.searchParams.get("dateFrom") || "").trim();
  const dateTo = String(url.searchParams.get("dateTo") || "").trim();
  const belowTargetOnly =
    String(url.searchParams.get("belowTargetOnly") || "").trim() === "true";

  if (typeof db.costImpactMenuItem?.findMany !== "function") {
    return ok({
      rows: [],
      summary: null,
      filters: { priority, q, dateFrom, dateTo, belowTargetOnly },
      setupRequired: true,
    });
  }

  const where: any = {};
  if (priority) where.priority = priority;
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

  const rows = await db.costImpactMenuItem.findMany({
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
    filters: { priority, q, dateFrom, dateTo, belowTargetOnly },
    setupRequired: false,
  });
}

export default function AdminCostImpactRoute() {
  const data = useLoaderData<typeof loader>();
  const payload = data.payload as any;
  const navigation = useNavigation();
  const rows = payload.rows || [];
  const summary = payload.summary || null;
  const filters = payload.filters || {
    priority: "",
    q: "",
    dateFrom: "",
    dateTo: "",
    belowTargetOnly: false,
  };
  const setupRequired = Boolean(payload.setupRequired);
  const isLoading = navigation.state !== "idle";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Impacto de custos
        </h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Monitoramento das alterações de custo propagadas para receitas, fichas
          e produtos do cardápio, com foco na diferença entre margem atual e
          margem alvo.
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          <Link
            to="/admin/stock-movements"
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Movimentações
          </Link>
          <Link
            to="/admin/import-stock-nf"
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Importação NF
          </Link>
          <Link
            to="/admin/gerenciamento/cardapio/cost-management"
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Custos do cardápio
          </Link>
          <Link
            to="/admin/gerenciamento/cardapio/sell-price-management"
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Preços de venda
          </Link>
        </div>
      </div>

      <Form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-600">Buscar insumo ou produto</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            className="h-10 rounded-lg border border-slate-300 px-3"
            placeholder="Ex.: muçarela, margherita"
          />
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
          <span className="text-slate-600">Prioridade</span>
          <select
            name="priority"
            defaultValue={filters.priority}
            className="h-10 rounded-lg border border-slate-300 px-3"
          >
            <option value="">Todas</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </label>
        <label className="flex min-w-[170px] flex-col gap-1 text-sm">
          <span className="text-slate-600">De</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom}
            className="h-10 rounded-lg border border-slate-300 px-3"
          />
        </label>
        <label className="flex min-w-[170px] flex-col gap-1 text-sm">
          <span className="text-slate-600">Até</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo}
            className="h-10 rounded-lg border border-slate-300 px-3"
          />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
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
          className="inline-flex h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white"
        >
          {isLoading ? "Atualizando..." : "Filtrar"}
        </button>
      </Form>

      {setupRequired ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          As tabelas de impacto ainda não estão disponíveis neste ambiente.
          Rode a migration do Prisma antes de usar o painel.
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard title="Linhas" value={String(summary.totalRows)} />
          <MetricCard title="Críticas" value={String(summary.critical)} />
          <MetricCard title="Altas" value={String(summary.high)} />
          <MetricCard title="Gap total preço" value={fmtMoney(summary.totalPriceGapAmount)} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Origem</th>
              <th className="px-4 py-3 text-left font-medium">Produto</th>
              <th className="px-4 py-3 text-right font-medium">Custo</th>
              <th className="px-4 py-3 text-right font-medium">Preço atual</th>
              <th className="px-4 py-3 text-right font-medium">Preço sugerido</th>
              <th className="px-4 py-3 text-right font-medium">Margem atual</th>
              <th className="px-4 py-3 text-right font-medium">Margem alvo</th>
              <th className="px-4 py-3 text-left font-medium">Prioridade</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  Nenhum impacto encontrado para os filtros informados.
                </td>
              </tr>
            ) : (
              rows.map((row: any) => (
                <tr key={row.id} className="border-t border-slate-100">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
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
