import { Form, Link, useFetcher, useLocation, useOutletContext, useRevalidator } from '@remix-run/react';
import { EyeOff, Eye, Loader2, Pencil, RotateCcw, AlignJustify, Layers, X, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TwoLevelLineRow } from '~/components/admin/import-stock-two-level-row';
import { DecimalInput } from '~/components/inputs/inputs';
import { PendingConversionForm } from '~/components/admin/import-stock-conversion-form';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import { ITEM_UNIT_OPTIONS } from '~/domain/item/item-units';
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

const COST_DISCREPANCY_THRESHOLD = 0.3;

function formatDateTimeLocalValue(value: unknown) {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function normalizeUnit(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
}

function parseDecimal(value: string) {
  const normalized = String(value || '').trim().replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function formatDecimal(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function findMeasurementConversion(
  measurementConversions: Array<{ fromUnit: string; toUnit: string; factor: number }>,
  fromUnit: string | null,
  toUnit: string | null,
) {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return null;

  for (const row of measurementConversions) {
    const rowFrom = normalizeUnit(row?.fromUnit);
    const rowTo = normalizeUnit(row?.toUnit);
    const factor = Number(row?.factor ?? NaN);
    if (!rowFrom || !rowTo || !(factor > 0)) continue;
    if (rowFrom === fromUnit && rowTo === toUnit) return { factor, mode: 'direct' as const };
    if (rowFrom === toUnit && rowTo === fromUnit) return { factor, mode: 'reverse' as const };
  }

  return null;
}

function hasCostDiscrepancy(
  line: any,
  itemCostHints: Record<string, { lastCostPerUnit: number | null; avgCostPerUnit: number | null }>,
) {
  if (!line.mappedItemId) return false;
  if (line.status === 'ignored' || line.status === 'invalid') return false;
  const hint = itemCostHints[line.mappedItemId];
  if (!hint?.lastCostPerUnit || hint.lastCostPerUnit <= 0) return false;
  const converted = Number(line.convertedCostAmount);
  if (!Number.isFinite(converted) || converted <= 0) return false;
  const discrepancy = Math.abs(converted - hint.lastCostPerUnit) / hint.lastCostPerUnit;
  return discrepancy > COST_DISCREPANCY_THRESHOLD;
}

function EditableTwoLevelRow({
  line,
  items,
  itemCostHints,
  selectedBatchId,
  unitOptions,
  itemUnitOptionsByItemId,
  measurementConversions,
  location,
  isEditing,
  onStartEditing,
  onStopEditing,
}: {
  line: any;
  items: any[];
  itemCostHints: Record<string, { lastCostPerUnit: number | null; avgCostPerUnit: number | null }>;
  selectedBatchId: string;
  unitOptions: string[];
  itemUnitOptionsByItemId: Record<string, string[]>;
  measurementConversions: Array<{ fromUnit: string; toUnit: string; factor: number }>;
  location: { pathname: string; search: string };
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
}) {
  const fetcher = useFetcher<any>();
  const revalidator = useRevalidator();
  const [movementUnitDraft, setMovementUnitDraft] = useState(
    String(line.movementUnit || line.unitEntry || '').toUpperCase(),
  );
  const [qtyEntryDraft, setQtyEntryDraft] = useState(Number(line.qtyEntry ?? 0));
  const [costTotalAmountDraft, setCostTotalAmountDraft] = useState(Number(line.costTotalAmount ?? 0));
  const [manualConversionFactorDraft, setManualConversionFactorDraft] = useState(
    String(line.manualConversionFactor ?? ''),
  );

  useEffect(() => {
    if (fetcher.state !== 'idle') return;
    if (fetcher.data?.status !== 200) return;
    if (fetcher.data?.payload?.updatedLineId !== line.id) return;
    onStopEditing();
    revalidator.revalidate();
  }, [fetcher.state, fetcher.data, line.id, revalidator, onStopEditing]);

  // Reset drafts when another row takes focus (isEditing flips to false externally)
  useEffect(() => {
    if (!isEditing) {
      setMovementUnitDraft(String(line.movementUnit || line.unitEntry || '').toUpperCase());
      setQtyEntryDraft(Number(line.qtyEntry ?? 0));
      setCostTotalAmountDraft(Number(line.costTotalAmount ?? 0));
      setManualConversionFactorDraft(String(line.manualConversionFactor ?? ''));
    }
  }, [isEditing, line]);

  const isSaving = fetcher.state !== 'idle';

  const derivedCostAmount =
    Number.isFinite(qtyEntryDraft) && qtyEntryDraft > 0
      ? costTotalAmountDraft / qtyEntryDraft
      : null;

  const selectedItem = useMemo(
    () => items.find((item: any) => item.id === line.mappedItemId) || null,
    [items, line.mappedItemId],
  );

  const availableMovementUnits = useMemo(() => {
    const merged = new Set<string>(ITEM_UNIT_OPTIONS);
    const linkedUnits = itemUnitOptionsByItemId[line.mappedItemId || ''] || [];
    for (const unit of linkedUnits) merged.add(unit);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [itemUnitOptionsByItemId, line.mappedItemId]);

  // live conversion preview while editing
  const conversionPreview = useMemo(() => {
    const movUnit = normalizeUnit(movementUnitDraft);
    const targetUnit = normalizeUnit(selectedItem?.consumptionUm || selectedItem?.purchaseUm);
    const costAmt = derivedCostAmount;
    const manualFactor = parseDecimal(manualConversionFactorDraft);

    if (!costAmt || costAmt <= 0 || !movUnit || !targetUnit) return null;
    if (movUnit === targetUnit) return { convertedCostAmount: costAmt, conversionSource: 'same-unit', conversionFactorUsed: 1 };
    if (manualFactor > 0) return { convertedCostAmount: costAmt / manualFactor, conversionSource: 'manual', conversionFactorUsed: manualFactor };

    const itemFactor = Number(selectedItem?.purchaseToConsumptionFactor ?? NaN);
    const itemPurchaseUm = normalizeUnit(selectedItem?.purchaseUm);
    const itemConsumptionUm = normalizeUnit(selectedItem?.consumptionUm);
    if (itemFactor > 0 && itemPurchaseUm && itemConsumptionUm) {
      if (movUnit === itemPurchaseUm && targetUnit === itemConsumptionUm)
        return { convertedCostAmount: costAmt / itemFactor, conversionSource: 'item_purchase_factor', conversionFactorUsed: itemFactor };
      if (movUnit === itemConsumptionUm && targetUnit === itemPurchaseUm)
        return { convertedCostAmount: costAmt * itemFactor, conversionSource: 'item_purchase_factor_reverse', conversionFactorUsed: itemFactor };
    }

    const measured = findMeasurementConversion(measurementConversions, movUnit, targetUnit);
    if (measured)
      return {
        convertedCostAmount: measured.mode === 'direct' ? costAmt / measured.factor : costAmt * measured.factor,
        conversionSource: measured.mode === 'direct' ? 'measurement_conversion_direct' : 'measurement_conversion_reverse',
        conversionFactorUsed: measured.factor,
      };

    return null;
  }, [derivedCostAmount, manualConversionFactorDraft, measurementConversions, movementUnitDraft, selectedItem]);

  function handleSave() {
    const fd = new FormData();
    fd.set('_action', 'batch-edit-line');
    fd.set('batchId', selectedBatchId);
    fd.set('lineId', line.id);
    fd.set('movementUnit', movementUnitDraft);
    fd.set('qtyEntry', String(qtyEntryDraft));
    fd.set('costAmount', derivedCostAmount != null ? String(derivedCostAmount) : '');
    fd.set('costTotalAmount', String(costTotalAmountDraft));
    fd.set('manualConversionFactor', manualConversionFactorDraft);
    fd.set('mappedItemId', line.mappedItemId || '');
    fd.set('supplierId', line.supplierId || '');
    fd.set('supplierName', line.supplierName || '');
    fd.set('supplierCnpj', line.supplierCnpj || '');
    fd.set('movementAt', formatDateTimeLocalValue(line.movementAt));
    fd.set('ingredientName', line.ingredientName || '');
    fd.set('motivo', line.motivo || '');
    fd.set('invoiceNumber', line.invoiceNumber || '');
    fd.set('observation', line.observation || '');
    fd.set('autoApproveCostReview', 'off');
    fd.set('importAfterSave', 'off');
    fetcher.submit(fd, { method: 'post', action: `/admin/import-stock-movements/${selectedBatchId}` });
  }

  function handleCancel() {
    setMovementUnitDraft(String(line.movementUnit || line.unitEntry || '').toUpperCase());
    setQtyEntryDraft(Number(line.qtyEntry ?? 0));
    setCostTotalAmountDraft(Number(line.costTotalAmount ?? 0));
    setManualConversionFactorDraft(String(line.manualConversionFactor ?? ''));
    onStopEditing();
  }

  const hint = itemCostHints[line.mappedItemId] ?? null;
  const discrepancy = hasCostDiscrepancy(line, itemCostHints);
  const displayConvertedCost = isEditing ? (conversionPreview?.convertedCostAmount ?? null) : line.convertedCostAmount;
  const displayTargetUnit = isEditing
    ? normalizeUnit(selectedItem?.consumptionUm || selectedItem?.purchaseUm)
    : line.targetUnit;

  return (
    <TwoLevelLineRow
      rowNumber={line.rowNumber}
      isActive={isEditing}
      canMovementRowClick={!isEditing}
      onMovementRowClick={() => onStartEditing()}
      spacingAfter
      archiveCells={
        <>
          <TableCell className="min-w-[260px] px-3 py-3 text-xs">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(String(line.ingredientName || '').trim())}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-900 hover:text-slate-700 hover:underline hover:underline-offset-2"
            >
              {line.ingredientName || '-'}
            </a>
            <div className="text-slate-500">
              {formatDate(line.movementAt)} • Doc. {formatDocumentLabel(line.invoiceNumber)}
            </div>
            {line.motivo ? <div className="text-slate-400">{line.motivo}</div> : null}
          </TableCell>
          <TableCell className="px-3 py-3 text-xs text-slate-700">
            {line.movementUnit || line.unitEntry || '-'}
          </TableCell>
          <TableCell className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
            {formatDecimal(line.qtyEntry)}
          </TableCell>
          <TableCell className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
            {formatMoney(line.costAmount)}
          </TableCell>
          <TableCell className="px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
            {formatMoney(line.costTotalAmount)}
          </TableCell>
          <TableCell className="px-3 py-3 text-xs text-slate-400">-</TableCell>
          <TableCell className="px-3 py-3 text-xs text-slate-400">-</TableCell>
          <TableCell className="px-3 py-3" />
        </>
      }
      movementCells={
        <>
          {/* Produto (sistema) */}
          <TableCell className="min-w-[280px] px-3 py-3 pl-8 text-xs">
            <div className="text-slate-500">
              {line.supplierName || '-'} • {supplierReconciliationLabel(line)}
            </div>
            {line.status === 'ignored' ? (
              <span className="text-slate-400">ignorada</span>
            ) : (
              <ItemSystemMapperCell
                line={line}
                items={items}
                batchId={selectedBatchId}
                unitOptions={unitOptions}
                costHint={hint}
              />
            )}
          </TableCell>
          {/* UM */}
          <TableCell className="min-w-[120px] px-3 py-3 text-xs text-slate-700">
            {isEditing ? (
              <>
                <input type="hidden" name="movementUnit" value={movementUnitDraft} />
                <Select
                  value={movementUnitDraft || '__EMPTY__'}
                  onValueChange={(v) => setMovementUnitDraft(v === '__EMPTY__' ? '' : v)}
                >
                  <SelectTrigger className="h-8 bg-white text-xs">
                    <SelectValue placeholder="UM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__EMPTY__">Selecionar...</SelectItem>
                    {availableMovementUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              displayTargetUnit || '-'
            )}
          </TableCell>
          {/* Quantidade */}
          <TableCell className="min-w-[120px] px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
            {isEditing ? (
              <DecimalInput
                name="qtyEntry"
                defaultValue={qtyEntryDraft}
                onValueChange={setQtyEntryDraft}
                fractionDigits={3}
                className="w-full bg-white"
              />
            ) : (
              formatDecimal(line.qtyConsumption)
            )}
          </TableCell>
          {/* Custo unit. convertido */}
          <TableCell className="min-w-[130px] px-3 py-3 text-right font-mono text-xs tabular-nums">
            {isEditing ? (
              <div className="space-y-0.5 text-right">
                <div className={cn(conversionPreview ? 'text-slate-700' : 'text-slate-400')}>
                  {conversionPreview ? formatMoney(conversionPreview.convertedCostAmount) : '-'}
                </div>
                {conversionPreview && (
                  <div className="text-[10px] text-slate-400">{conversionPreview.conversionSource}</div>
                )}
              </div>
            ) : (
              <span className={cn(discrepancy ? 'text-red-600' : 'text-slate-700')}>
                {displayConvertedCost != null ? formatMoney(displayConvertedCost) : '-'}
                {discrepancy && hint?.lastCostPerUnit != null ? (
                  <div className="text-[11px] text-slate-500">último: {formatMoney(hint.lastCostPerUnit)}</div>
                ) : null}
              </span>
            )}
          </TableCell>
          {/* Custo total */}
          <TableCell className="min-w-[130px] px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
            {isEditing ? (
              <DecimalInput
                name="costTotalAmount"
                defaultValue={costTotalAmountDraft}
                onValueChange={setCostTotalAmountDraft}
                fractionDigits={2}
                className="w-full bg-white"
              />
            ) : (
              formatMoney(line.costTotalAmount)
            )}
          </TableCell>
          {/* Fator / Conversão */}
          <TableCell className="px-3 py-3 text-xs text-slate-700">
            {line.status === 'ignored' ? (
              <span className="text-slate-400">-</span>
            ) : line.status === 'pending_conversion' && !isEditing ? (
              <PendingConversionForm batchId={selectedBatchId} line={line} />
            ) : isEditing ? (
              <div className="space-y-1">
                <Input
                  name="manualConversionFactor"
                  value={manualConversionFactorDraft}
                  onChange={(e) => setManualConversionFactorDraft(e.currentTarget.value)}
                  placeholder="fator manual"
                  className="h-8 w-24 bg-white text-xs"
                />
                {derivedCostAmount != null && (
                  <div className="text-[11px] text-slate-500">
                    unit: {formatMoney(derivedCostAmount)}
                  </div>
                )}
              </div>
            ) : (
              <>
                {line.conversionFactorUsed ? (
                  <div className="font-mono">{Number(line.conversionFactorUsed).toFixed(4)}</div>
                ) : null}
                <div className="text-slate-500">{line.conversionSource || '-'}</div>
              </>
            )}
          </TableCell>
          {/* Status */}
          <TableCell className="px-3 py-3 text-xs">
            <LineStatusBadge line={line} batchId={selectedBatchId} />
            {line.errorMessage ? (
              <div className="mt-1 max-w-[180px] text-[11px] text-red-700">{line.errorMessage}</div>
            ) : null}
          </TableCell>
          {/* Ações */}
          <TableCell className="w-20 px-2 py-3">
            <div className="flex flex-col items-center gap-1">
              {isEditing ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-emerald-300 hover:bg-emerald-50"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Salvar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cancelar</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onStartEditing()}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Editar linha</TooltipContent>
                  </Tooltip>
                  <Form
                    method="post"
                    action={`/admin/import-stock-movements/${selectedBatchId}`}
                    preventScrollReset
                  >
                    <input
                      type="hidden"
                      name="_action"
                      value={line.status === 'ignored' ? 'batch-unignore-line' : 'batch-ignore-line'}
                    />
                    <input type="hidden" name="batchId" value={selectedBatchId} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="submit" variant="outline" size="icon" className="h-7 w-7">
                          {line.status === 'ignored' ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {line.status === 'ignored' ? 'Reativar' : 'Ignorar'}
                      </TooltipContent>
                    </Tooltip>
                  </Form>
                  {line.status === 'error' ? (
                    <Form
                      method="post"
                      action={`/admin/import-stock-movements/${selectedBatchId}`}
                      preventScrollReset
                    >
                      <input type="hidden" name="_action" value="batch-retry-line-error" />
                      <input type="hidden" name="batchId" value={selectedBatchId} />
                      <input type="hidden" name="lineId" value={line.id} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="submit" variant="outline" size="icon" className="h-7 w-7">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Retentar</TooltipContent>
                      </Tooltip>
                    </Form>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link
                          to={`/admin/import-stock-movements/${selectedBatchId}/line/${line.id}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Layers className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver detalhe completo</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </TableCell>
        </>
      }
    />
  );
}

function LineStatusBadge({ line, batchId }: { line: any; batchId: string }) {
  const fetcher = useFetcher<any>();
  const isApproving =
    fetcher.state !== 'idle' &&
    String(fetcher.formData?.get('_action') || '') === 'batch-approve-cost-review' &&
    String(fetcher.formData?.get('lineId') || '') === String(line.id);

  if (line.status !== 'pending_cost_review') {
    return (
      <Badge variant="outline" className={statusBadgeClass(String(line.status))}>
        {line.status}
      </Badge>
    );
  }

  return (
    <fetcher.Form method="post" action={`/admin/import-stock-movements/${batchId}`} preventScrollReset>
      <input type="hidden" name="_action" value="batch-approve-cost-review" />
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="lineId" value={line.id} />
      <button
        type="submit"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:bg-amber-100',
          statusBadgeClass(String(line.status)),
        )}
        disabled={isApproving}
        title="Aprovar revisão de custo e marcar como ready"
      >
        {isApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {isApproving ? 'Aprovando...' : line.status}
      </button>
    </fetcher.Form>
  );
}

type AdminImportStockMovementsBatchLinesRouteProps = {
  forcedStatus?: string | null;
};

export function AdminImportStockMovementsBatchLinesRoute({
  forcedStatus = null,
}: AdminImportStockMovementsBatchLinesRouteProps) {
  const { lines, items, suppliers, selectedBatch, unitOptions, itemUnitOptionsByItemId, measurementConversions, itemCostHints } =
    useOutletContext<AdminImportStockMovementsBatchOutletContext>();
  const location = useLocation();
  const [activeEditingLineId, setActiveEditingLineId] = useState<string | null>(null);
  const [statusGuideOpen, setStatusGuideOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'two-level'>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('import-lines-view-mode') : null;
      return stored === 'two-level' ? 'two-level' : 'flat';
    } catch {
      return 'flat';
    }
  });

  function handleSetViewMode(mode: 'flat' | 'two-level') {
    setViewMode(mode);
    try { window.localStorage.setItem('import-lines-view-mode', mode); } catch { /* ignore */ }
  }
  const normalizedForcedStatus = String(forcedStatus || '').trim();

  const availableSuppliers = useMemo(
    () =>
      Array.from(
        new Map(
          lines
            .filter((l) => l.supplierName)
            .map((l) => [String(l.supplierName), String(l.supplierName)]),
        ).entries(),
      )
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lines],
  );

  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (normalizedForcedStatus && String(line.status || '') !== normalizedForcedStatus) return false;
      if (supplierFilter !== 'all' && String(line.supplierName || '') !== supplierFilter) return false;
      if (ingredientFilter.trim()) {
        const needle = ingredientFilter.trim().toLowerCase();
        if (!String(line.ingredientName || '').toLowerCase().includes(needle)) return false;
      }
      if (discrepancyOnly && !hasCostDiscrepancy(line, itemCostHints)) return false;
      return true;
    });
  }, [lines, normalizedForcedStatus, supplierFilter, ingredientFilter, discrepancyOnly, itemCostHints]);

  return (
    <TooltipProvider>
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

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {normalizedForcedStatus ? `Linhas com status ${normalizedForcedStatus}` : 'Linhas do lote'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  title={showFilters ? 'Esconder filtros' : 'Mostrar filtros'}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  {showFilters ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showFilters ? 'Filtros' : 'Filtros'}
                </button>
              </div>
              {normalizedForcedStatus ? (
                <div className="text-xs text-slate-500">
                  Filtro por status aplicado via navegação da página.
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500">
                {filteredLines.length} de {lines.length} linha(s)
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  title="Visualização simples"
                  onClick={() => handleSetViewMode('flat')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                    viewMode === 'flat'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  <AlignJustify className="h-3.5 w-3.5" />
                  Simples
                </button>
                <button
                  type="button"
                  title="Visualização comparativa (arquivo vs movimento)"
                  onClick={() => handleSetViewMode('two-level')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                    viewMode === 'two-level'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Comparativo
                </button>
              </div>
            </div>
          </div>



          {showFilters && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-slate-200 pt-3">
            {/* Ingrediente */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ingrediente</span>
              <Input
                placeholder="Buscar..."
                value={ingredientFilter}
                onChange={(e) => setIngredientFilter(e.target.value)}
                className="h-8 w-44 text-xs"
              />
            </div>

            {/* Fornecedor */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Fornecedor</span>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableSuppliers.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Status</span>
                <button
                  type="button"
                  onClick={() => setStatusGuideOpen(true)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-300"
                  aria-label="Explicar status de linha"
                  title="Explicar status de linha"
                >
                  ?
                </button>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'w-fit rounded-full px-2.5 py-1 text-xs font-medium',
                  normalizedForcedStatus ? statusBadgeClass(normalizedForcedStatus) : 'border-slate-200 bg-white text-slate-700',
                )}
              >
                {normalizedForcedStatus || 'Todos'}
              </Badge>
            </div>

            {/* Discrepância */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Custo</span>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 has-[:checked]:border-red-400 has-[:checked]:bg-red-50 has-[:checked]:text-red-700">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={discrepancyOnly}
                  onChange={(e) => setDiscrepancyOnly(e.target.checked)}
                />
                Só discrepâncias
              </label>
            </div>
          </div>
          )}
        </div>

        <div className="mt-3 overflow-auto rounded-lg">
          <Table>
            <TableHeader className="bg-slate-50/90">
              <TableRow className="hover:bg-slate-50/90">
                <TableHead className="px-3 py-2 text-xs">Linha</TableHead>
                {viewMode === 'two-level' && (
                  <TableHead className="px-3 py-2 text-xs">Tipo</TableHead>
                )}
                {viewMode === 'flat' ? (
                  <>
                    <TableHead className="px-3 py-2 text-xs">Data/Doc.</TableHead>
                    <TableHead className="px-3 py-2 text-xs">Fornecedor</TableHead>
                    <TableHead className="px-3 py-2 text-xs">Ingrediente</TableHead>
                    <TableHead className="px-3 py-2 text-xs">Mov.</TableHead>
                    <TableHead className="px-3 py-2 text-xs">Custo</TableHead>
                    <TableHead className="w-64 px-3 py-2 text-xs">Item do sistema</TableHead>
                    <TableHead className="px-3 py-2 text-xs">Conversão</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="min-w-[260px] px-3 py-2 text-xs">Produto</TableHead>
                    <TableHead className="px-3 py-2 text-xs">UM</TableHead>
                    <TableHead className="px-3 py-2 text-right text-xs">Quantidade</TableHead>
                    <TableHead className="px-3 py-2 text-right text-xs">Custo unit.</TableHead>
                    <TableHead className="px-3 py-2 text-right text-xs">Custo total</TableHead>
                    <TableHead className="px-3 py-2 text-xs">Fator / Conversão</TableHead>
                  </>
                )}
                <TableHead className="px-3 py-2 text-xs">Status</TableHead>
                <TableHead className="w-20 px-3 py-2 text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.length === 0 ? (
                <TableRow className="border-slate-100">
                  <TableCell colSpan={viewMode === 'flat' ? 10 : 10} className="px-3 py-8 text-center text-sm text-slate-500">
                    Nenhuma linha encontrada para os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : viewMode === 'flat' ? (
                filteredLines.map((line) => {
                  const discrepancy = hasCostDiscrepancy(line, itemCostHints);
                  const hint = itemCostHints[line.mappedItemId] ?? null;
                  return (
                    <TableRow
                      key={line.id}
                      className="border-slate-100 align-top"
                    >
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
                          <div className="text-slate-400">
                            {line.supplierReconciliationSource || line.supplierMatchSource}
                          </div>
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
                      <TableCell className="w-64 px-3 py-2 text-xs text-slate-700">
                        {line.status === 'ignored' ? (
                          <span className="text-slate-400">ignorada</span>
                        ) : (
                          <ItemSystemMapperCell
                            line={line}
                            items={items}
                            batchId={selectedBatch.id}
                            unitOptions={unitOptions}
                            costHint={hint}
                          />
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
                              {line.convertedCostAmount != null
                                ? `${formatMoney(line.convertedCostAmount)} / ${line.targetUnit || '-'}`
                                : '-'}
                            </div>
                            <div className="text-slate-500">
                              {line.conversionSource || '-'}
                              {line.conversionFactorUsed
                                ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}`
                                : ''}
                            </div>
                            {line.status !== 'ready' && discrepancy && hint?.lastCostPerUnit != null ? (
                              <div className="mt-1 text-[11px] font-medium text-red-600">
                                último: {formatMoney(hint.lastCostPerUnit)} / {line.targetUnit || '-'}
                              </div>
                            ) : null}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        <LineStatusBadge line={line} batchId={selectedBatch.id} />
                        {line.errorMessage ? (
                          <div className="mt-1 max-w-[180px] text-[11px] text-red-700">
                            {line.errorMessage}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="w-20 px-2 py-2">
                        <div className="flex flex-col items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button asChild variant="outline" size="icon" className="h-7 w-7">
                                <Link
                                  to={`/admin/import-stock-movements/${selectedBatch.id}/line/${line.id}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar linha</TooltipContent>
                          </Tooltip>

                          <Form
                            method="post"
                            action={`/admin/import-stock-movements/${selectedBatch.id}`}
                            preventScrollReset
                          >
                            <input
                              type="hidden"
                              name="_action"
                              value={line.status === 'ignored' ? 'batch-unignore-line' : 'batch-ignore-line'}
                            />
                            <input type="hidden" name="batchId" value={selectedBatch.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button type="submit" variant="outline" size="icon" className="h-7 w-7">
                                  {line.status === 'ignored' ? (
                                    <Eye className="h-3.5 w-3.5" />
                                  ) : (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {line.status === 'ignored' ? 'Reativar' : 'Ignorar'}
                              </TooltipContent>
                            </Tooltip>
                          </Form>

                          {line.status === 'error' ? (
                            <Form
                              method="post"
                              action={`/admin/import-stock-movements/${selectedBatch.id}`}
                              preventScrollReset
                            >
                              <input type="hidden" name="_action" value="batch-retry-line-error" />
                              <input type="hidden" name="batchId" value={selectedBatch.id} />
                              <input type="hidden" name="lineId" value={line.id} />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button type="submit" variant="outline" size="icon" className="h-7 w-7">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Retentar</TooltipContent>
                              </Tooltip>
                            </Form>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                /* ── Modo Comparativo (two-level) ── */
                filteredLines.map((line) => (
                  <EditableTwoLevelRow
                    key={line.id}
                    line={line}
                    items={items}
                    itemCostHints={itemCostHints}
                    selectedBatchId={selectedBatch.id}
                    unitOptions={unitOptions}
                    itemUnitOptionsByItemId={itemUnitOptionsByItemId}
                    measurementConversions={measurementConversions}
                    location={location}
                    isEditing={activeEditingLineId === line.id}
                    onStartEditing={() => setActiveEditingLineId(line.id)}
                    onStopEditing={() => setActiveEditingLineId(null)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default function AdminImportStockMovementsBatchLinesIndexRoute() {
  return <AdminImportStockMovementsBatchLinesRoute />;
}
function getItemBaseUnit(item: { purchaseUm?: string | null; consumptionUm?: string | null } | null | undefined) {
  return item?.consumptionUm || item?.purchaseUm || '-';
}
