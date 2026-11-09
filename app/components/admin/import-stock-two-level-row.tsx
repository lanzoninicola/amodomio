import { Fragment } from 'react';
import { TableCell, TableRow } from '~/components/ui/table';
import { cn } from '~/lib/utils';

interface TwoLevelLineRowProps {
  rowNumber: number | string;
  isActive?: boolean;
  canMovementRowClick?: boolean;
  onMovementRowClick?: () => void;
  /** Cells for the "Arquivo" level (without Linha and Tipo cells) */
  archiveCells: React.ReactNode;
  /** Cells for the "Movimento" level (without Tipo cell) */
  movementCells: React.ReactNode;
  /** Adds a thicker bottom border to visually separate groups */
  spacingAfter?: boolean;
}

/**
 * Renders a pair of TableRows for the two-level layout pattern:
 * - Row 1 "Arquivo": raw file data
 * - Row 2 "Movimento": mapped/converted movement data
 *
 * The "Linha" (rowNumber) cell spans both rows automatically.
 * Used by both the batch index table and the line detail table.
 */
export function TwoLevelLineRow({
  rowNumber,
  isActive = false,
  canMovementRowClick = false,
  onMovementRowClick,
  archiveCells,
  movementCells,
  spacingAfter = false,
}: TwoLevelLineRowProps) {
  return (
    <Fragment>
      <TableRow
        className={cn(
          'border-slate-200 align-top bg-white hover:bg-white',
          isActive && 'border-l-2 border-l-amber-300',
        )}
      >
        <TableCell
          rowSpan={2}
          className={cn(
            'px-3 py-3 text-xs font-semibold align-top text-slate-700',
            isActive && 'bg-slate-50',
          )}
        >
          {rowNumber}
        </TableCell>
        <TableCell className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Arquivo
        </TableCell>
        {archiveCells}
      </TableRow>
      <TableRow
        className={cn(
          'align-top bg-sky-50/70',
          spacingAfter ? 'border-b-[3px] border-b-slate-200' : 'border-sky-200',
          isActive && 'border-l-2 border-l-sky-400 bg-sky-100/70',
          canMovementRowClick && 'cursor-pointer hover:bg-sky-100/80',
        )}
        onClick={canMovementRowClick ? onMovementRowClick : undefined}
      >
        <TableCell className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800">
          Movimento
        </TableCell>
        {movementCells}
      </TableRow>
    </Fragment>
  );
}
