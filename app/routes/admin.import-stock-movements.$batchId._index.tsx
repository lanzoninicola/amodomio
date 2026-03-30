import { Form, Link, useFetcher, useLocation, useOutletContext } from '@remix-run/react';
import { EyeOff, Eye, Loader2, Pencil, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DecimalInput } from '~/components/inputs/inputs';
import { PendingConversionForm } from '~/components/admin/import-stock-conversion-form';
import { MoneyInput } from '~/components/money-input/MoneyInput';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { Textarea } from '~/components/ui/textarea';
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

function LineEditDialog({
  line,
  batchId,
  items,
  suppliers,
  unitOptions,
  itemUnitOptionsByItemId,
  measurementConversions,
  open,
  onOpenChange,
}: {
  line: any;
  batchId: string;
  items: any[];
  suppliers: any[];
  unitOptions: string[];
  itemUnitOptionsByItemId: Record<string, string[]>;
  measurementConversions: Array<{ fromUnit: string; toUnit: string; factor: number }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<any>();
  const isSubmitting = fetcher.state !== 'idle';
  const [supplierIdDraft, setSupplierIdDraft] = useState(String(line?.supplierId || ''));
  const [mappedItemIdDraft, setMappedItemIdDraft] = useState(String(line?.mappedItemId || ''));
  const [movementUnitDraft, setMovementUnitDraft] = useState(
    String(line?.movementUnit || line?.unitEntry || '').toUpperCase(),
  );
  const [qtyEntryDraft, setQtyEntryDraft] = useState<number>(Number(line?.qtyEntry ?? 0));
  const [costAmountDraft, setCostAmountDraft] = useState<number>(Number(line?.costAmount ?? 0));
  const [manualConversionFactorDraft, setManualConversionFactorDraft] = useState(String(line?.manualConversionFactor ?? ''));

  const selectedSupplier = suppliers.find((s) => s.id === supplierIdDraft) || null;
  const selectedItem = items.find((item) => item.id === mappedItemIdDraft) || null;
  const supplierNameHiddenValue = selectedSupplier?.name || line?.supplierName || '';
  const supplierCnpjHiddenValue = selectedSupplier?.cnpj || line?.supplierCnpj || '';
  const computedCostTotal =
    Number.isFinite(qtyEntryDraft) && Number.isFinite(costAmountDraft)
      ? qtyEntryDraft * costAmountDraft
      : NaN;
  const conversionPreview = useMemo(() => {
    const movementUnit = normalizeUnit(movementUnitDraft);
    const targetUnit = normalizeUnit(selectedItem?.consumptionUm || selectedItem?.purchaseUm);
    const costAmount = Number(costAmountDraft);
    const manualFactor = parseDecimal(manualConversionFactorDraft);

    if (!Number.isFinite(costAmount) || costAmount <= 0) {
      return {
        status: 'invalid',
        targetUnit,
        convertedCostAmount: null,
        conversionSource: null,
        conversionFactorUsed: null,
        errorMessage: 'Custo inválido',
      };
    }

    if (!movementUnit) {
      return {
        status: 'pending_conversion',
        targetUnit,
        convertedCostAmount: null,
        conversionSource: null,
        conversionFactorUsed: null,
        errorMessage: 'UM da movimentação não identificada',
      };
    }

    if (!targetUnit) {
      return {
        status: 'pending_conversion',
        targetUnit: null,
        convertedCostAmount: null,
        conversionSource: null,
        conversionFactorUsed: null,
        errorMessage: 'Item sem UM configurada',
      };
    }

    if (movementUnit === targetUnit) {
      return {
        status: 'ready',
        targetUnit,
        convertedCostAmount: costAmount,
        conversionSource: 'same-unit',
        conversionFactorUsed: 1,
        errorMessage: null,
      };
    }

    if (manualFactor > 0) {
      return {
        status: 'ready',
        targetUnit,
        convertedCostAmount: costAmount / manualFactor,
        conversionSource: 'manual',
        conversionFactorUsed: manualFactor,
        errorMessage: null,
      };
    }

    const itemConsumptionUm = normalizeUnit(selectedItem?.consumptionUm);
    const itemPurchaseUm = normalizeUnit(selectedItem?.purchaseUm);
    const multiConversion = Array.isArray(selectedItem?.ItemPurchaseConversion)
      ? selectedItem.ItemPurchaseConversion.find((conversion: any) => normalizeUnit(conversion?.purchaseUm) === movementUnit)
      : null;
    const multiFactor = Number(multiConversion?.factor ?? NaN);
    if (multiConversion && itemConsumptionUm && targetUnit === itemConsumptionUm && multiFactor > 0) {
      return {
        status: 'ready',
        targetUnit,
        convertedCostAmount: costAmount / multiFactor,
        conversionSource: 'item_purchase_factor',
        conversionFactorUsed: multiFactor,
        errorMessage: null,
      };
    }

    const itemFactor = Number(selectedItem?.purchaseToConsumptionFactor ?? NaN);
    if (itemPurchaseUm && itemConsumptionUm && itemFactor > 0) {
      if (movementUnit === itemPurchaseUm && targetUnit === itemConsumptionUm) {
        return {
          status: 'ready',
          targetUnit,
          convertedCostAmount: costAmount / itemFactor,
          conversionSource: 'item_purchase_factor',
          conversionFactorUsed: itemFactor,
          errorMessage: null,
        };
      }

      if (movementUnit === itemConsumptionUm && targetUnit === itemPurchaseUm) {
        return {
          status: 'ready',
          targetUnit,
          convertedCostAmount: costAmount * itemFactor,
          conversionSource: 'item_purchase_factor_reverse',
          conversionFactorUsed: itemFactor,
          errorMessage: null,
        };
      }
    }

    const measured = findMeasurementConversion(measurementConversions, movementUnit, targetUnit);
    if (measured) {
      return measured.mode === 'direct'
        ? {
            status: 'ready',
            targetUnit,
            convertedCostAmount: costAmount / measured.factor,
            conversionSource: 'measurement_conversion_direct',
            conversionFactorUsed: measured.factor,
            errorMessage: null,
          }
        : {
            status: 'ready',
            targetUnit,
            convertedCostAmount: costAmount * measured.factor,
            conversionSource: 'measurement_conversion_reverse',
            conversionFactorUsed: measured.factor,
            errorMessage: null,
          };
    }

    return {
      status: 'pending_conversion',
      targetUnit,
      convertedCostAmount: null,
      conversionSource: null,
      conversionFactorUsed: null,
      errorMessage: `Prévia local sem conversão automática de ${movementUnit} para ${targetUnit}`,
    };
  }, [costAmountDraft, manualConversionFactorDraft, measurementConversions, movementUnitDraft, selectedItem]);
  const convertedQuantityPreview = useMemo(() => {
    if (!Number.isFinite(qtyEntryDraft) || qtyEntryDraft <= 0) return null;
    if (conversionPreview.status !== 'ready' || !conversionPreview.targetUnit) return null;

    const movementUnit = normalizeUnit(movementUnitDraft);
    const targetUnit = normalizeUnit(conversionPreview.targetUnit);
    const manualFactor = parseDecimal(manualConversionFactorDraft);
    const itemConsumptionUm = normalizeUnit(selectedItem?.consumptionUm);
    const itemPurchaseUm = normalizeUnit(selectedItem?.purchaseUm);

    if (!movementUnit || !targetUnit) return null;
    if (movementUnit === targetUnit) return qtyEntryDraft;
    if (manualFactor > 0) return qtyEntryDraft * manualFactor;

    const multiConversion = Array.isArray(selectedItem?.ItemPurchaseConversion)
      ? selectedItem.ItemPurchaseConversion.find((conversion: any) => normalizeUnit(conversion?.purchaseUm) === movementUnit)
      : null;
    const multiFactor = Number(multiConversion?.factor ?? NaN);
    if (multiConversion && itemConsumptionUm && targetUnit === itemConsumptionUm && multiFactor > 0) {
      return qtyEntryDraft * multiFactor;
    }

    const itemFactor = Number(selectedItem?.purchaseToConsumptionFactor ?? NaN);
    if (itemPurchaseUm && itemConsumptionUm && itemFactor > 0) {
      if (movementUnit === itemPurchaseUm && targetUnit === itemConsumptionUm) return qtyEntryDraft * itemFactor;
      if (movementUnit === itemConsumptionUm && targetUnit === itemPurchaseUm) return qtyEntryDraft / itemFactor;
    }

    const measured = findMeasurementConversion(measurementConversions, movementUnit, targetUnit);
    if (measured) {
      return measured.mode === 'direct' ? qtyEntryDraft * measured.factor : qtyEntryDraft / measured.factor;
    }

    return null;
  }, [conversionPreview, manualConversionFactorDraft, measurementConversions, movementUnitDraft, qtyEntryDraft, selectedItem]);
  const availableMovementUnits = useMemo(() => {
    const merged = new Set<string>(ITEM_UNIT_OPTIONS);
    const linkedUnits = itemUnitOptionsByItemId[mappedItemIdDraft] || [];
    for (const unit of linkedUnits) merged.add(unit);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [itemUnitOptionsByItemId, mappedItemIdDraft]);

  useEffect(() => {
    if (fetcher.state !== 'idle') return;
    if (fetcher.data?.status !== 200) return;
    if (fetcher.data?.payload?.updatedLineId !== line?.id) return;
    onOpenChange(false);
  }, [fetcher.state, fetcher.data, line?.id, onOpenChange]);

  if (!line) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`Editar linha ${line.rowNumber}${line.ingredientName ? ` • ${line.ingredientName}` : ''}`}</DialogTitle>
        </DialogHeader>

        {fetcher.data?.message ? (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${fetcher.data?.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
          >
            {fetcher.data.message}
          </div>
        ) : null}

        <fetcher.Form
          method="post"
          action={`/admin/import-stock-movements/${batchId}`}
          className="space-y-5"
          preventScrollReset
        >
          <input type="hidden" name="_action" value="batch-edit-line" />
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="lineId" value={line.id} />
          <input type="hidden" name="supplierId" value={supplierIdDraft} />
          <input type="hidden" name="supplierName" value={supplierNameHiddenValue} />
          <input type="hidden" name="supplierCnpj" value={supplierCnpjHiddenValue} />
          <input type="hidden" name="mappedItemId" value={mappedItemIdDraft} />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="movementAt">Data</Label>
              <Input
                id="movementAt"
                name="movementAt"
                type="datetime-local"
                defaultValue={formatDateTimeLocalValue(line.movementAt)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceNumber">Documento</Label>
              <Input
                id="invoiceNumber"
                name="invoiceNumber"
                defaultValue={line.invoiceNumber || ''}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ingredientName">Ingrediente</Label>
              <Input
                id="ingredientName"
                name="ingredientName"
                defaultValue={line.ingredientName || ''}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                name="motivo"
                defaultValue={line.motivo || ''}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Select
                value={supplierIdDraft || '__EMPTY__'}
                onValueChange={(v) => setSupplierIdDraft(v === '__EMPTY__' ? '' : v)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem vínculo</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.cnpj ? `• ${s.cnpj}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Item do sistema</Label>
              <Select
                value={mappedItemIdDraft || '__EMPTY__'}
                onValueChange={(v) => setMappedItemIdDraft(v === '__EMPTY__' ? '' : v)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem item mapeado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem item mapeado</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} [{item.classification || '-'}] ({getItemBaseUnit(item)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="qtyEntry">Quantidade</Label>
              <DecimalInput
                id="qtyEntry"
                name="qtyEntry"
                defaultValue={qtyEntryDraft}
                fractionDigits={4}
                className="w-full"
                onValueChange={setQtyEntryDraft}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label>UM do movimento</Label>
              <Select
                name="movementUnit"
                value={movementUnitDraft || '__EMPTY__'}
                onValueChange={(v) => setMovementUnitDraft(v === '__EMPTY__' ? '' : v)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem unidade</SelectItem>
                  {availableMovementUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costAmount">Custo unitário</Label>
              <DecimalInput
                id="costAmount"
                name="costAmount"
                defaultValue={costAmountDraft}
                fractionDigits={4}
                className="w-full"
                onValueChange={setCostAmountDraft}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costTotalAmountPreview">Custo total</Label>
              <MoneyInput
                id="costTotalAmountPreview"
                name="costTotalAmount"
                defaultValue={Number.isFinite(computedCostTotal) ? computedCostTotal : 0}
                className="h-10 w-full"
                readOnly
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="manualConversionFactor">Fator manual de conversão</Label>
              <Input
                id="manualConversionFactor"
                name="manualConversionFactor"
                value={manualConversionFactorDraft}
                onChange={(event) => setManualConversionFactorDraft(event.currentTarget.value)}
                placeholder="Ex.: 1000"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="observation">Observação</Label>
              <Textarea
                id="observation"
                name="observation"
                defaultValue={line.observation || ''}
                disabled={isSubmitting}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div>
                <span className="font-medium text-slate-900">Status:</span> {conversionPreview.status || '-'}
              </div>
              <div>
                <span className="font-medium text-slate-900">Conversão:</span>{' '}
                {conversionPreview.conversionSource || '-'}
                {conversionPreview.conversionFactorUsed
                  ? ` • fator ${Number(conversionPreview.conversionFactorUsed).toFixed(6)}`
                  : ''}
              </div>
              <div>
                <span className="font-medium text-slate-900">Custo unitário convertido:</span>{' '}
                {formatMoney(conversionPreview.convertedCostAmount)} / {conversionPreview.targetUnit || '-'}
              </div>
              <div>
                <span className="font-medium text-slate-900">Quantidade convertida:</span>{' '}
                {formatDecimal(convertedQuantityPreview)} {conversionPreview.targetUnit || '-'}
              </div>
              {conversionPreview.errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {conversionPreview.errorMessage}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Fechar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
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
  const [statusGuideOpen, setStatusGuideOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
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
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {normalizedForcedStatus ? `Linhas com status ${normalizedForcedStatus}` : 'Linhas do lote'}
              </h3>
              {normalizedForcedStatus ? (
                <div className="text-xs text-slate-500">
                  Filtro por status aplicado via navegação da página.
                </div>
              ) : null}
            </div>
            <div className="text-xs text-slate-500">
              {filteredLines.length} de {lines.length} linha(s)
            </div>
          </div>



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
                <TableHead className="w-64 px-3 py-2 text-xs">Item do sistema</TableHead>
                <TableHead className="px-3 py-2 text-xs">Conversão</TableHead>
                <TableHead className="px-3 py-2 text-xs">Status</TableHead>
                <TableHead className="w-20 px-3 py-2 text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.length === 0 ? (
                <TableRow className="border-slate-100">
                  <TableCell colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">
                    Nenhuma linha encontrada para os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
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
