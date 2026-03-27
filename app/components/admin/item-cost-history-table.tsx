import { Link } from '@remix-run/react';
import { Badge } from '~/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { cn } from '~/lib/utils';

export function getItemCostHistoryVariationPercent(previousCostAmount: unknown, costAmount: unknown) {
  const previous = Number(previousCostAmount);
  const next = Number(costAmount);
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  if (previous <= 0) return null;
  return ((next - previous) / previous) * 100;
}

export function formatItemCostHistoryVariationPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'novo custo';
  const signal = value > 0 ? '+' : '';
  return `${signal}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function itemCostHistoryVariationBadgeClass(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'border-sky-200 bg-sky-50 text-sky-700';
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

function sourceBadgeClass(source: string) {
  switch (source) {
    case 'import':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'manual':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    case 'purchase':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'adjustment':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'item-cost-sheet':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function sourceLabel(row: any) {
  const source = String(row?.source || '').trim().toLowerCase();
  const referenceType = String(row?.referenceType || '').trim().toLowerCase();
  if (source === 'import' && referenceType === 'stock-movement-import-rollback') return 'rollback import';
  if (source === 'import') return 'importação';
  if (source === 'manual') return 'manual';
  if (source === 'purchase') return 'compra';
  if (source === 'adjustment') return 'ajuste';
  if (source === 'item-cost-sheet') return 'ficha de custo';
  return source || '-';
}

export function ItemCostHistoryTable({
  rows,
  emptyMessage,
}: {
  rows: any[];
  emptyMessage?: string;
}) {
  return rows.length === 0 ? (
    <div className="mt-3 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      {emptyMessage || 'Nenhum evento de custo encontrado.'}
    </div>
  ) : (
    <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
      <Table>
        <TableHeader className="bg-slate-50/90">
          <TableRow className="hover:bg-slate-50/90">
            <TableHead className="px-3 py-2 text-xs">Efetivado em</TableHead>
            <TableHead className="px-3 py-2 text-xs">Item</TableHead>
            <TableHead className="px-3 py-2 text-xs">Origem</TableHead>
            <TableHead className="px-3 py-2 text-xs">Antes</TableHead>
            <TableHead className="px-3 py-2 text-xs">Depois</TableHead>
            <TableHead className="px-3 py-2 text-xs">Variação</TableHead>
            <TableHead className="px-3 py-2 text-xs">Referência</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const variationPercent = getItemCostHistoryVariationPercent(row.previousCostAmount, row.costAmount);

            return (
              <TableRow key={row.id} className="border-slate-100">
                <TableCell className="px-3 py-2 text-xs">{formatDate(row.effectiveAt || row.validFrom || row.createdAt)}</TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <div className="font-medium text-slate-800">{row.itemName || 'Item sem nome'}</div>
                  {row.supplierName ? <div className="mt-1 text-[11px] text-slate-500">{row.supplierName}</div> : null}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={sourceBadgeClass(String(row.source || ''))}>
                      {sourceLabel(row)}
                    </Badge>
                    {row.isCurrent ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        vigente
                      </Badge>
                    ) : null}
                  </div>
                  {row.invoiceNumber ? <div className="mt-1 text-[11px] text-slate-500">Doc.: {row.invoiceNumber}</div> : null}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  {formatMoney(row.previousCostAmount)} / {row.unit || '-'}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  {formatMoney(row.costAmount)} / {row.unit || '-'}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <Badge variant="outline" className={cn('font-semibold tabular-nums', itemCostHistoryVariationBadgeClass(variationPercent))}>
                    {formatItemCostHistoryVariationPercent(variationPercent)}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {row.itemId ? (
                      <Link to={`/admin/items/${row.itemId}/costs`} className="text-[11px] font-medium text-sky-700 hover:underline">
                        abrir item
                      </Link>
                    ) : null}
                    {(row.referenceType === 'stock-movement-import-line' || row.referenceType === 'stock-movement') && row.referenceId ? (
                      <Link
                        to={
                          row.referenceType === 'stock-movement'
                            ? `/admin/stock-movements?movementId=${encodeURIComponent(row.referenceId)}&status=all&openEdit=1`
                            : `/admin/stock-movements?lineId=${encodeURIComponent(row.referenceId)}&status=all&openEdit=1`
                        }
                        className="text-[11px] font-medium text-sky-700 hover:underline"
                      >
                        editar movimento
                      </Link>
                    ) : null}
                    {row.Batch?.id ? (
                      <Link to={`/admin/import-stock-movements/${row.Batch.id}`} className="text-[11px] font-medium text-sky-700 hover:underline">
                        abrir lote
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {row.referenceType || '-'}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
