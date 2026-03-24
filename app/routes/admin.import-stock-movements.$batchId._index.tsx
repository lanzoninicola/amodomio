import { Form, useOutletContext } from '@remix-run/react';
import { useMemo, useState } from 'react';
import { PendingConversionForm } from '~/components/admin/import-stock-conversion-form';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { cn } from '~/lib/utils';
import type { AdminImportStockMovementsBatchOutletContext } from './admin.import-stock-movements.$batchId';
import {
  formatDate,
  formatDocumentLabel,
  formatMoney,
  ItemSystemMapperCell,
  LINE_STATUS_GUIDE,
  statusBadgeClass,
  supplierReconciliationLabel,
} from './admin.import-stock-movements.$batchId';

export default function AdminImportStockMovementsBatchLinesRoute() {
  const { lines, items, selectedBatch, unitOptions } = useOutletContext<AdminImportStockMovementsBatchOutletContext>();
  const [statusFilter, setStatusFilter] = useState('all');
  const [statusGuideOpen, setStatusGuideOpen] = useState(false);

  const availableStatuses = useMemo(
    () => Array.from(new Set(lines.map((line) => String(line.status || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lines],
  );

  const filteredLines = useMemo(() => {
    if (statusFilter === 'all') return lines;
    return lines.filter((line) => String(line.status || '') === statusFilter);
  }, [lines, statusFilter]);

  return (
    <div className="bg-white">
      <Dialog open={statusGuideOpen} onOpenChange={setStatusGuideOpen}>
        <DialogContent className="max-w-4xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Status de linha e impacto na importação</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50/90">
                <TableRow className="hover:bg-slate-50/90">
                  <TableHead className="px-3 py-2 text-xs">Status</TableHead>
                  <TableHead className="px-3 py-2 text-xs">O que significa</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Impacto na importação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {LINE_STATUS_GUIDE.map((row) => (
                  <TableRow key={row.status} className="border-slate-100 align-top">
                    <TableCell className="px-3 py-3 text-xs">
                      <Badge variant="outline" className={statusBadgeClass(row.status)}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs text-slate-700">{row.meaning}</TableCell>
                    <TableCell className="px-3 py-3 text-xs text-slate-700">{row.impact}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Linhas do lote</h3>
          <div className="text-xs text-slate-500">{filteredLines.length} de {lines.length} linha(s)</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setStatusGuideOpen(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label="Explicar status de linha"
            title="Explicar status de linha"
          >
            ?
          </button>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition',
              statusFilter === 'all'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            Todos
          </button>
          {availableStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition',
                statusFilter === status
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-auto rounded-lg">
        <Table>
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="px-3 py-2 text-xs">Linha</TableHead>
              <TableHead className="px-3 py-2 text-xs">Data/Doc.</TableHead>
              <TableHead className="px-3 py-2 text-xs">Fornecedor</TableHead>
              <TableHead className="px-3 py-2 text-xs">Ingrediente</TableHead>
              <TableHead className="px-3 py-2 text-xs">Mov.</TableHead>
              <TableHead className="px-3 py-2 text-xs">Custo</TableHead>
              <TableHead className="px-3 py-2 text-xs">Item do sistema</TableHead>
              <TableHead className="px-3 py-2 text-xs">Conversão</TableHead>
              <TableHead className="px-3 py-2 text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLines.length === 0 ? (
              <TableRow className="border-slate-100">
                <TableCell colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
                  Nenhuma linha encontrada para o status selecionado.
                </TableCell>
              </TableRow>
            ) : (
              filteredLines.map((line) => (
                <TableRow key={line.id} className="border-slate-100 align-top">
                  <TableCell className="px-3 py-2 text-xs text-slate-600">{line.rowNumber}</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-slate-700">
                    <div>{formatDate(line.movementAt)}</div>
                    <div className="text-slate-500">Doc. {formatDocumentLabel(line.invoiceNumber)}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-slate-700">
                    <div className="font-medium text-slate-900">{line.supplierName || '-'}</div>
                    <div className="text-slate-500">
                      {line.supplierCnpj || 'sem CNPJ'} • {supplierReconciliationLabel(line)}
                    </div>
                    {line.supplierReconciliationSource || line.supplierMatchSource ? (
                      <div className="text-slate-400">{line.supplierReconciliationSource || line.supplierMatchSource}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(String(line.ingredientName || '').trim())}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 hover:text-slate-700 hover:underline hover:underline-offset-2"
                    >
                      {line.ingredientName}
                    </a>
                    <div className="text-slate-500">{line.motivo || '-'}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-slate-700">
                    <div>
                      {line.qtyEntry ?? '-'} {line.unitEntry || ''}
                    </div>
                    <div className="text-slate-500">
                      cons: {line.qtyConsumption ?? '-'} {line.unitConsumption || ''}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-slate-700">
                    <div>
                      {formatMoney(line.costAmount)} / {line.movementUnit || '-'}
                    </div>
                    <div className="text-slate-500">total: {formatMoney(line.costTotalAmount)}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-slate-700">
                    {line.status === 'ignored' ? (
                      <span className="text-slate-400">ignorada</span>
                    ) : (
                      <ItemSystemMapperCell line={line} items={items} batchId={selectedBatch.id} unitOptions={unitOptions} />
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-slate-700">
                    {line.status === 'ignored' ? (
                      <span className="text-slate-400">ignorada</span>
                    ) : line.status === 'pending_conversion' ? (
                      <PendingConversionForm batchId={selectedBatch.id} line={line} />
                    ) : (
                      <>
                        <div>
                          {line.convertedCostAmount != null ? `${formatMoney(line.convertedCostAmount)} / ${line.targetUnit || '-'}` : '-'}
                        </div>
                        <div className="text-slate-500">
                          {line.conversionSource || '-'}
                          {line.conversionFactorUsed ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}` : ''}
                        </div>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <Badge variant="outline" className={statusBadgeClass(String(line.status))}>
                      {line.status}
                    </Badge>
                    <Form method="post" className="mt-2">
                      <input type="hidden" name="_action" value={line.status === 'ignored' ? 'batch-unignore-line' : 'batch-ignore-line'} />
                      <input type="hidden" name="batchId" value={selectedBatch.id} />
                      <input type="hidden" name="lineId" value={line.id} />
                      <Button type="submit" variant="outline" className="h-7 px-2 text-[11px]">
                        {line.status === 'ignored' ? 'Reativar' : 'Ignorar'}
                      </Button>
                    </Form>
                    {line.status === 'error' ? (
                      <Form method="post" className="mt-2">
                        <input type="hidden" name="_action" value="batch-retry-line-error" />
                        <input type="hidden" name="batchId" value={selectedBatch.id} />
                        <input type="hidden" name="lineId" value={line.id} />
                        <Button type="submit" variant="outline" className="h-7 px-2 text-[11px]">
                          Retentar
                        </Button>
                      </Form>
                    ) : null}
                    {line.errorMessage ? <div className="mt-1 max-w-[220px] text-[11px] text-red-700">{line.errorMessage}</div> : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
