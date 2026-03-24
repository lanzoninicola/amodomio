import { useOutletContext } from '@remix-run/react';
import { StockMovementImportAppliedChangesTable } from '~/components/admin/stock-movement-import-applied-changes-table';
import type { AdminImportStockMovementsBatchOutletContext } from './admin.import-stock-movements.$batchId';

export default function AdminImportStockMovementsBatchAppliedChangesRoute() {
  const { appliedChanges } = useOutletContext<AdminImportStockMovementsBatchOutletContext>();

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Movimentos gerados pela importação</h3>
          <p className="max-w-3xl text-sm text-slate-500">
            Esta tabela mostra os movimentos de estoque criados por este lote. Se a importação for removida, os movimentos vinculados são eliminados e as linhas voltam a poder gerar novos movimentos.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">até -10%: queda forte</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">-10% a -3%: queda moderada</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">-3% a +3%: estável</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">+3% a +10%: alta moderada</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">acima de +10%: alta forte</span>
          </div>
        </div>
        <div className="text-xs text-slate-500">{appliedChanges.length} registro(s)</div>
      </div>

      <StockMovementImportAppliedChangesTable
        appliedChanges={appliedChanges}
        emptyMessage="Nenhum movimento foi gerado por este lote ainda."
      />
    </div>
  );
}
