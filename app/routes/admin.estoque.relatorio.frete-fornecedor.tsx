import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData, useSearchParams } from '@remix-run/react';
import { Truck } from 'lucide-react';
import { ok } from '~/utils/http-response.server';
import prisma from '~/lib/prisma/client.server';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

export const meta: MetaFunction = () => [{ title: 'Admin | Frete por Fornecedor' }];

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
function fmtMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? BRL.format(n) : '-';
}
function fmtDate(v: unknown) {
  if (!v) return '-';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

// Gera lista de "YYYY-MM" dos últimos 12 meses
function last12Months() {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mes = url.searchParams.get('mes') || defaultMonth;

  const [year, month] = mes.split('-').map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const db = prisma as any;

  const batches = await db.stockMovementImportBatch.findMany({
    where: {
      freightAmount: { gt: 0 },
      createdAt: { gte: from, lt: to },
    },
    select: {
      id: true,
      name: true,
      freightAmount: true,
      createdAt: true,
      Lines: {
        take: 1,
        select: { supplierName: true, invoiceNumber: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Histórico: uma linha por lote
  const historico = batches.map((b: any) => ({
    id: b.id,
    name: b.name,
    freightAmount: Number(b.freightAmount),
    createdAt: b.createdAt,
    supplierName: b.Lines[0]?.supplierName ?? null,
    invoiceNumber: b.Lines[0]?.invoiceNumber ?? null,
  }));

  // Resumo por fornecedor
  const supplierMap = new Map<string, { totalFrete: number; qtdNfs: number }>();
  for (const row of historico) {
    const key = row.supplierName ?? '(sem fornecedor)';
    const existing = supplierMap.get(key) ?? { totalFrete: 0, qtdNfs: 0 };
    supplierMap.set(key, {
      totalFrete: existing.totalFrete + row.freightAmount,
      qtdNfs: existing.qtdNfs + 1,
    });
  }
  const resumo = Array.from(supplierMap.entries())
    .map(([supplierName, { totalFrete, qtdNfs }]) => ({
      supplierName,
      totalFrete,
      qtdNfs,
      mediaPorNf: totalFrete / qtdNfs,
    }))
    .sort((a, b) => b.totalFrete - a.totalFrete);

  const totalGeralFrete = historico.reduce((acc: number, r: any) => acc + r.freightAmount, 0);

  return ok({ historico, resumo, mes, totalGeralFrete, meses: last12Months() });
}

export default function RelatórioFreteFornecedor() {
  const { payload } = useLoaderData<typeof loader>();
  const { historico, resumo, mes, totalGeralFrete, meses } = payload as any;
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'resumo';

  function setTab(t: string) {
    setParams((prev) => { prev.set('tab', t); return prev; });
  }
  function setMes(m: string) {
    setParams((prev) => { prev.set('mes', m); return prev; });
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 max-w-4xl">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Truck size={20} className="text-slate-500" />
          Relatório de frete por fornecedor
        </h1>
        <p className="text-sm text-slate-500">
          Fretes registrados nas NF-es importadas.
        </p>
      </div>

      {/* Filtro de mês */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Mês</span>
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {(meses as string[]).map((m: string) => {
            const [y, mo] = m.split('-').map(Number);
            const label = new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            return <option key={m} value={m}>{label}</option>;
          })}
        </select>
      </div>

      {/* Total geral */}
      {(historico as any[]).length > 0 && (
        <div className="flex items-center gap-6 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">Total frete no período</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{fmtMoney(totalGeralFrete)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">NF-es com frete</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{(historico as any[]).length}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">Fornecedores</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{(resumo as any[]).length}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'resumo', label: 'Por fornecedor' },
          { key: 'historico', label: 'Histórico de NF-es' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {(historico as any[]).length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-slate-400">
          <Truck size={36} strokeWidth={1.2} />
          <span className="text-sm">Nenhuma NF-e com frete registrada neste período.</span>
        </div>
      )}

      {/* Tab: Resumo por fornecedor */}
      {tab === 'resumo' && (resumo as any[]).length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-600">Fornecedor</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Total frete</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Nº NF-es</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Frete médio / NF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(resumo as any[]).map((row: any) => (
                <TableRow key={row.supplierName}>
                  <TableCell className="font-medium text-sm text-slate-900">{row.supplierName}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-slate-900">
                    {fmtMoney(row.totalFrete)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-600">
                    {row.qtdNfs}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-slate-600">
                    {fmtMoney(row.mediaPorNf)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab: Histórico de NF-es */}
      {tab === 'historico' && (historico as any[]).length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-600">Data</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">NF-e</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Fornecedor</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Frete</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(historico as any[]).map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">{fmtDate(row.createdAt)}</TableCell>
                  <TableCell className="text-sm text-slate-700 font-mono">{row.invoiceNumber ?? '-'}</TableCell>
                  <TableCell className="text-sm text-slate-900 font-medium">{row.supplierName ?? '-'}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-slate-900">
                    {fmtMoney(row.freightAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/admin/import-stock-movements/${row.id}`}
                      className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800"
                    >
                      ver lote
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
