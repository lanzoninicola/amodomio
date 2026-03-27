import { Link } from '@remix-run/react';
import { Badge } from '~/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { cn } from '~/lib/utils';

export function getAppliedChangeVariationPercent(previousCostAmount: unknown, newCostAmount: unknown) {
  const previous = Number(previousCostAmount);
  const next = Number(newCostAmount);
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  if (previous <= 0) return null;
  return ((next - previous) / previous) * 100;
}

export function formatAppliedChangeVariationPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'novo custo';
  const signal = value > 0 ? '+' : '';
  return `${signal}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function appliedChangeVariationBadgeClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (value >= 10) return 'border-red-200 bg-red-50 text-red-700';
  if (value >= 3) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value > -3) return 'border-slate-200 bg-slate-50 text-slate-700';
  if (value > -10) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-emerald-300 bg-emerald-100 text-emerald-800';
}

function formatDate(value: unknown) {
  if (!value) return '-';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function movementLifecycleBadgeClass(deletedAt: unknown) {
  return deletedAt
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export function StockMovementImportAppliedChangesTable({
  appliedChanges,
  showBatch = false,
  emptyMessage,
}: {
  appliedChanges: any[];
  showBatch?: boolean;
  emptyMessage?: string;
}) {
  return appliedChanges.length === 0 ? (
    <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      {emptyMessage || 'Nenhuma alteração aplicada encontrada.'}
    </div>
  ) : (
    <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
      <Table>
        <TableHeader className="bg-slate-50/90">
          <TableRow className="hover:bg-slate-50/90">
            {showBatch ? <TableHead className="px-3 py-2 text-xs">Lote</TableHead> : null}
            <TableHead className="px-3 py-2 text-xs">Aplicado em</TableHead>
            <TableHead className="px-3 py-2 text-xs">ID do item</TableHead>
            <TableHead className="px-3 py-2 text-xs">Nome do item</TableHead>
            <TableHead className="px-3 py-2 text-xs">Antes</TableHead>
            <TableHead className="px-3 py-2 text-xs">Depois</TableHead>
            <TableHead className="px-3 py-2 text-xs">Variação</TableHead>
            <TableHead className="px-3 py-2 text-xs">Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appliedChanges.map((change) => {
            const variationPercent = getAppliedChangeVariationPercent(change.previousCostAmount, change.newCostAmount);

            return (
              <TableRow key={change.id} className="border-slate-100">
                {showBatch ? (
                  <TableCell className="px-3 py-2 text-xs">
                    {change.Batch?.id ? (
                      <Link
                        to={`/admin/import-stock-movements/${change.Batch.id}/applied-changes`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {change.Batch?.name || change.Batch.id}
                      </Link>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="px-3 py-2 text-xs">{formatDate(change.appliedAt)}</TableCell>
                <TableCell className="px-3 py-2 text-xs font-mono text-[11px] text-slate-600">{change.itemId}</TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <div className="font-medium text-slate-800">{change.Item?.name || 'Item sem nome'}</div>
                  {change.supplierName ? <div className="mt-1 text-[11px] text-slate-500">{change.supplierName}</div> : null}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  {formatMoney(change.previousCostAmount)} / {change.previousCostUnit || '-'}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  {formatMoney(change.newCostAmount)} / {change.newCostUnit || '-'}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <Badge variant="outline" className={cn('font-semibold tabular-nums', appliedChangeVariationBadgeClass(variationPercent))}>
                    {formatAppliedChangeVariationPercent(variationPercent)}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <Badge variant="outline" className={movementLifecycleBadgeClass(change.deletedAt)}>
                    {change.deletedAt ? 'eliminada' : 'ativa'}
                  </Badge>
                  <div className="mt-1 space-x-3">
                    <Link
                      to={`/admin/stock-movements?movementId=${encodeURIComponent(change.id)}`}
                      className="text-[11px] font-medium text-sky-700 hover:underline"
                    >
                      abrir movimentação
                    </Link>
                    {showBatch && change.Batch?.id ? (
                      <Link
                        to={`/admin/import-stock-movements/${change.Batch.id}`}
                        className="text-[11px] font-medium text-slate-700 hover:underline"
                      >
                        abrir lote
                      </Link>
                    ) : null}
                  </div>
                  {change.deletedAt ? <div className="mt-1 text-[11px] text-slate-500">eliminada em {formatDate(change.deletedAt)}</div> : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
