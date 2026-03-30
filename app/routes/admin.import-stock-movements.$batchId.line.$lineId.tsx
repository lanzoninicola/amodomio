import { Link, useFetcher, useOutletContext, useParams, useRevalidator, useSearchParams } from '@remix-run/react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronsUpDown, Loader2 } from 'lucide-react';
import { DecimalInput } from '~/components/inputs/inputs';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { cn } from '~/lib/utils';
import { ITEM_UNIT_OPTIONS } from '~/domain/item/item-units';
import type { AdminImportStockMovementsBatchOutletContext } from './admin.import-stock-movements.$batchId';
import {
  formatDate,
  formatDocumentLabel,
  formatMoney,
  statusBadgeClass,
  supplierReconciliationLabel,
} from './admin.import-stock-movements.$batchId';

const COST_DISCREPANCY_THRESHOLD = 0.3;
const ITEM_CLASSIFICATIONS = [
  'insumo',
  'semi_acabado',
  'produto_final',
  'embalagem',
  'servico',
  'outro',
] as const;

function normalizeUnit(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
}

function parseDecimal(value: string) {
  const normalized = String(value || '').trim().replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function deriveUnitCost(totalAmount: unknown, quantity: unknown) {
  const total = Number(totalAmount);
  const qty = Number(quantity);
  if (!Number.isFinite(total) || !Number.isFinite(qty) || qty <= 0) return null;
  const unitCost = total / qty;
  return Number.isFinite(unitCost) && unitCost > 0 ? unitCost : null;
}

function formatDecimal(value: unknown, fractionDigits = 3) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatDateTimeLocalValue(value: unknown) {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getItemBaseUnit(item: { purchaseUm?: string | null; consumptionUm?: string | null } | null | undefined) {
  return item?.consumptionUm || item?.purchaseUm || '-';
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
  convertedCostAmount: number | null,
  mappedItemId: string | null,
  itemCostHints: Record<string, { lastCostPerUnit: number | null; avgCostPerUnit: number | null }>,
) {
  if (!mappedItemId) return false;
  const hint = itemCostHints[mappedItemId];
  if (!hint?.lastCostPerUnit || hint.lastCostPerUnit <= 0) return false;
  if (!Number.isFinite(Number(convertedCostAmount)) || Number(convertedCostAmount) <= 0) return false;
  const discrepancy = Math.abs(Number(convertedCostAmount) - hint.lastCostPerUnit) / hint.lastCostPerUnit;
  return discrepancy > COST_DISCREPANCY_THRESHOLD;
}

function sameNumberish(a: unknown, b: unknown, epsilon = 1e-9) {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isFinite(numA) && !Number.isFinite(numB)) return true;
  if (!Number.isFinite(numA) || !Number.isFinite(numB)) return false;
  return Math.abs(numA - numB) <= epsilon;
}

function getCostReviewApprovalMetadata(line: any) {
  const metadata =
    typeof line?.metadata === 'object' && line.metadata && !Array.isArray(line.metadata)
      ? (line.metadata as Record<string, any>)
      : null;
  const approval =
    metadata && typeof metadata.costReviewApproval === 'object' && metadata.costReviewApproval && !Array.isArray(metadata.costReviewApproval)
      ? (metadata.costReviewApproval as Record<string, any>)
      : null;
  return approval;
}

function isCostReviewApprovalValid(params: {
  line: any;
  mappedItemId: string | null;
  movementUnit: string | null;
  targetUnit: string | null;
  costAmount: number | null;
  convertedCostAmount: number | null;
  manualConversionFactor: string;
}) {
  const approval = getCostReviewApprovalMetadata(params.line);
  if (!approval) return false;

  const manualConversionFactorNumber = parseDecimal(params.manualConversionFactor);
  const currentManualFactor =
    Number.isFinite(manualConversionFactorNumber) && manualConversionFactorNumber > 0
      ? manualConversionFactorNumber
      : null;

  return (
    String(approval.mappedItemId || '') === String(params.mappedItemId || '') &&
    String(approval.targetUnit || '').toUpperCase() === String(params.targetUnit || '').toUpperCase() &&
    String(approval.movementUnit || '').toUpperCase() === String(params.movementUnit || '').toUpperCase() &&
    sameNumberish(approval.costAmount, params.costAmount) &&
    sameNumberish(approval.convertedCostAmount, params.convertedCostAmount) &&
    sameNumberish(approval.manualConversionFactor, currentManualFactor)
  );
}

function resolvePreview(args: {
  line: any;
  itemsById: Record<string, any>;
  measurementConversions: Array<{ fromUnit: string; toUnit: string; factor: number }>;
  itemCostHints: Record<string, { lastCostPerUnit: number | null; avgCostPerUnit: number | null }>;
  overrides?: {
    mappedItemId?: string;
    movementUnit?: string;
    qtyEntry?: number;
    costAmount?: number;
    costTotalAmount?: number;
    manualConversionFactor?: string;
  };
}) {
  const line = args.line;
  const mappedItemId = String(args.overrides?.mappedItemId ?? line?.mappedItemId ?? '').trim() || null;
  const movementUnit = normalizeUnit(args.overrides?.movementUnit ?? line?.movementUnit ?? line?.unitEntry);
  const qtyEntry = Number(args.overrides?.qtyEntry ?? line?.qtyEntry ?? NaN);
  const costTotalAmount = Number(args.overrides?.costTotalAmount ?? line?.costTotalAmount ?? NaN);
  const derivedCostAmount = deriveUnitCost(costTotalAmount, qtyEntry);
  const rawCostAmount = Number(args.overrides?.costAmount ?? line?.costAmount ?? NaN);
  const costAmount = Number.isFinite(rawCostAmount) && rawCostAmount > 0 ? rawCostAmount : (derivedCostAmount ?? NaN);
  const manualConversionFactor = String(args.overrides?.manualConversionFactor ?? line?.manualConversionFactor ?? '').trim();
  const selectedItem = mappedItemId ? args.itemsById[mappedItemId] || null : null;
  const targetUnit = normalizeUnit(selectedItem?.consumptionUm || selectedItem?.purchaseUm);
  const manualFactor = parseDecimal(manualConversionFactor);

  let conversionSource: string | null = null;
  let conversionFactorUsed: number | null = null;
  let convertedCostAmount: number | null = null;
  let convertedQuantity: number | null = null;
  let conversionError: string | null = null;

  if (!Number.isFinite(costAmount) || costAmount <= 0) {
    conversionError = 'Custo inválido';
  } else if (!movementUnit) {
    conversionError = 'UM da movimentação não identificada';
  } else if (!targetUnit) {
    conversionError = 'Item sem UM configurada';
  } else if (movementUnit === targetUnit) {
    conversionSource = 'same-unit';
    conversionFactorUsed = 1;
    convertedCostAmount = costAmount;
    convertedQuantity = Number.isFinite(qtyEntry) ? qtyEntry : null;
  } else if (manualFactor > 0) {
    conversionSource = 'manual';
    conversionFactorUsed = manualFactor;
    convertedCostAmount = costAmount / manualFactor;
    convertedQuantity = Number.isFinite(qtyEntry) ? qtyEntry * manualFactor : null;
  } else {
    const itemConsumptionUm = normalizeUnit(selectedItem?.consumptionUm);
    const itemPurchaseUm = normalizeUnit(selectedItem?.purchaseUm);
    const multiConversion = Array.isArray(selectedItem?.ItemPurchaseConversion)
      ? selectedItem.ItemPurchaseConversion.find((conversion: any) => normalizeUnit(conversion?.purchaseUm) === movementUnit)
      : null;
    const multiFactor = Number(multiConversion?.factor ?? NaN);

    if (multiConversion && itemConsumptionUm && targetUnit === itemConsumptionUm && multiFactor > 0) {
      conversionSource = 'item_purchase_factor';
      conversionFactorUsed = multiFactor;
      convertedCostAmount = costAmount / multiFactor;
      convertedQuantity = Number.isFinite(qtyEntry) ? qtyEntry * multiFactor : null;
    } else {
      const itemFactor = Number(selectedItem?.purchaseToConsumptionFactor ?? NaN);
      if (itemPurchaseUm && itemConsumptionUm && itemFactor > 0) {
        if (movementUnit === itemPurchaseUm && targetUnit === itemConsumptionUm) {
          conversionSource = 'item_purchase_factor';
          conversionFactorUsed = itemFactor;
          convertedCostAmount = costAmount / itemFactor;
          convertedQuantity = Number.isFinite(qtyEntry) ? qtyEntry * itemFactor : null;
        } else if (movementUnit === itemConsumptionUm && targetUnit === itemPurchaseUm) {
          conversionSource = 'item_purchase_factor_reverse';
          conversionFactorUsed = itemFactor;
          convertedCostAmount = costAmount * itemFactor;
          convertedQuantity = Number.isFinite(qtyEntry) ? qtyEntry / itemFactor : null;
        }
      }

      if (convertedCostAmount == null) {
        const measured = findMeasurementConversion(args.measurementConversions, movementUnit, targetUnit);
        if (measured) {
          conversionSource = measured.mode === 'direct' ? 'measurement_conversion_direct' : 'measurement_conversion_reverse';
          conversionFactorUsed = measured.factor;
          convertedCostAmount = measured.mode === 'direct' ? costAmount / measured.factor : costAmount * measured.factor;
          convertedQuantity = Number.isFinite(qtyEntry)
            ? measured.mode === 'direct'
              ? qtyEntry * measured.factor
              : qtyEntry / measured.factor
            : null;
        }
      }
    }
  }

  if (!conversionError && convertedCostAmount == null) {
    conversionError = `Sem conversão automática de ${movementUnit || '-'} para ${targetUnit || '-'}`;
  }

  let status = String(line?.status || '').trim() || 'pending_mapping';
  let statusMessage = String(line?.errorMessage || '').trim() || null;
  if (!['imported', 'ignored', 'skipped_duplicate', 'error', 'invalid'].includes(status)) {
    const supplierResolved =
      Boolean(line?.supplierId) ||
      ['matched', 'manual'].includes(String(line?.supplierReconciliationStatus || '').toLowerCase());

    if (!mappedItemId) {
      status = 'pending_mapping';
      statusMessage = 'Selecione um item do sistema para continuar.';
    } else if (!supplierResolved) {
      status = 'pending_supplier';
      statusMessage = 'O fornecedor deste documento ainda precisa ser conciliado.';
    } else if (conversionError) {
      status = 'pending_conversion';
      statusMessage = conversionError;
    } else if (
      hasCostDiscrepancy(convertedCostAmount, mappedItemId, args.itemCostHints) &&
      !isCostReviewApprovalValid({
        line,
        mappedItemId,
        movementUnit,
        targetUnit,
        costAmount: Number.isFinite(costAmount) ? costAmount : null,
        convertedCostAmount,
        manualConversionFactor,
      })
    ) {
      status = 'pending_cost_review';
      statusMessage = 'Linha com variacao relevante de custo. Revise e aprove antes de importar.';
    } else {
      status = 'ready';
      statusMessage = null;
    }
  }

  return {
    mappedItemId,
    selectedItem,
    movementUnit,
    qtyEntry,
    costAmount,
    costTotalAmount,
    targetUnit,
    convertedCostAmount,
    convertedQuantity,
    conversionSource,
    conversionFactorUsed,
    conversionError,
    status,
    statusMessage,
  };
}

function PendingCostReviewBadgeAction({
  batchId,
  lineId,
  onApproved,
}: {
  batchId: string;
  lineId: string;
  onApproved?: () => void;
}) {
  const fetcher = useFetcher<any>();
  const isSubmitting =
    fetcher.state !== 'idle' &&
    String(fetcher.formData?.get('_action') || '') === 'batch-approve-cost-review' &&
    String(fetcher.formData?.get('lineId') || '') === lineId;

  useEffect(() => {
    if (fetcher.state !== 'idle') return;
    if (fetcher.data?.status !== 200) return;
    if (String(fetcher.data?.payload?.approvedLineId || '') !== lineId) return;
    onApproved?.();
  }, [fetcher.state, fetcher.data, lineId, onApproved]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        fetcher.submit(
          {
            _action: 'batch-approve-cost-review',
            batchId,
            lineId,
          },
          { method: 'post', action: `/admin/import-stock-movements/${batchId}` },
        );
      }}
      className="inline-flex"
      disabled={isSubmitting}
    >
      <Badge variant="outline" className={cn('cursor-pointer hover:bg-amber-100', statusBadgeClass('pending_cost_review'))}>
        {isSubmitting ? 'aprovando...' : 'pending_cost_review'}
      </Badge>
    </button>
  );
}

export default function AdminImportStockMovementsBatchLineDetailRoute() {
  const { lines, items, selectedBatch, unitOptions, itemUnitOptionsByItemId, measurementConversions, itemCostHints } =
    useOutletContext<AdminImportStockMovementsBatchOutletContext>();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<any>();
  const createItemFetcher = useFetcher<any>();
  const activeLineId = String(params.lineId || '').trim();
  const activeLine = lines.find((entry) => String(entry?.id) === activeLineId) || null;
  const [editableLineId, setEditableLineId] = useState(activeLineId);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [classification, setClassification] = useState<(typeof ITEM_CLASSIFICATIONS)[number]>('insumo');
  const [consumptionUm, setConsumptionUm] = useState('__EMPTY__');
  const restoreScrollRef = useRef<number | null>(null);
  const lastHandledCreateItemResultRef = useRef<string | null>(null);

  const [mappedItemIdDraft, setMappedItemIdDraft] = useState('');
  const [movementUnitDraft, setMovementUnitDraft] = useState('');
  const [qtyEntryDraft, setQtyEntryDraft] = useState(0);
  const [costTotalAmountDraft, setCostTotalAmountDraft] = useState(0);
  const [manualConversionFactorDraft, setManualConversionFactorDraft] = useState('');
  const lastHandledFetcherResultRef = useRef<string | null>(null);

  useEffect(() => {
    setEditableLineId(activeLineId);
  }, [activeLineId]);

  const editableLine = lines.find((entry) => String(entry?.id) === String(editableLineId || '').trim()) || activeLine || null;

  useEffect(() => {
    if (!editableLine) return;
    setMappedItemIdDraft(String(editableLine?.mappedItemId || ''));
    setMovementUnitDraft(String(editableLine?.movementUnit || editableLine?.unitEntry || '').toUpperCase());
    setQtyEntryDraft(Number(editableLine?.qtyEntry ?? 0));
    setCostTotalAmountDraft(Number(editableLine?.costTotalAmount ?? 0));
    setManualConversionFactorDraft(String(editableLine?.manualConversionFactor ?? ''));
    const normalizedMovementUnit = normalizeUnit(editableLine?.movementUnit);
    setConsumptionUm(normalizedMovementUnit && unitOptions.includes(normalizedMovementUnit) ? normalizedMovementUnit : '__EMPTY__');
  }, [editableLine]);

  useEffect(() => {
    if (fetcher.state === 'idle') return;
    lastHandledFetcherResultRef.current = null;
  }, [fetcher.state]);

  useEffect(() => {
    if (createItemFetcher.state !== 'idle') return;
    if (createItemFetcher.data?.status !== 200) return;
    const createdItemId = String(createItemFetcher.data?.payload?.createdItemId || '');
    if (!createdItemId) return;
    if (lastHandledCreateItemResultRef.current === createdItemId) return;
    lastHandledCreateItemResultRef.current = createdItemId;
    setMappedItemIdDraft(createdItemId);
    setItemPickerOpen(false);
    setCreateDialogOpen(false);
    revalidator.revalidate();
    if (restoreScrollRef.current != null) {
      const restoreTop = restoreScrollRef.current;
      restoreScrollRef.current = null;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: restoreTop });
      });
    }
  }, [createItemFetcher.state, createItemFetcher.data, revalidator]);

  useEffect(() => {
    if (fetcher.state !== 'idle') return;
    if (fetcher.data?.status !== 200) return;
    const updatedLineId = String(fetcher.data?.payload?.updatedLineId || '');
    if (updatedLineId !== String(editableLine?.id || '')) return;
    const handledKey = JSON.stringify({
      updatedLineId,
      autoApprovedCostReview: Boolean(fetcher.data?.payload?.autoApprovedCostReview),
    });
    if (lastHandledFetcherResultRef.current === handledKey) return;
    lastHandledFetcherResultRef.current = handledKey;
    revalidator.revalidate();
  }, [fetcher.state, fetcher.data, editableLine?.id, revalidator]);

  const itemsById = useMemo(
    () =>
      Object.fromEntries(
        items.map((item: any) => [String(item.id), item]),
      ) as Record<string, any>,
    [items],
  );

  const returnTo = searchParams.get('returnTo') || `/admin/import-stock-movements/${selectedBatch?.id || ''}`;
  const documentNumber = String(activeLine?.invoiceNumber || '').trim();
  const documentLines = useMemo(() => {
    if (!documentNumber) return activeLine ? [activeLine] : [];
    return lines
      .filter((line) => String(line?.invoiceNumber || '').trim() === documentNumber)
      .sort((a, b) => Number(a?.rowNumber || 0) - Number(b?.rowNumber || 0));
  }, [activeLine, documentNumber, lines]);

  const activePreview = useMemo(
    () =>
      editableLine
        ? resolvePreview({
          line: editableLine,
          itemsById,
          measurementConversions,
          itemCostHints,
          overrides: {
            mappedItemId: mappedItemIdDraft,
            movementUnit: movementUnitDraft,
            qtyEntry: qtyEntryDraft,
            costTotalAmount: costTotalAmountDraft,
            manualConversionFactor: manualConversionFactorDraft,
          },
        })
        : null,
    [
      editableLine,
      costTotalAmountDraft,
      itemCostHints,
      itemsById,
      manualConversionFactorDraft,
      mappedItemIdDraft,
      measurementConversions,
      movementUnitDraft,
      qtyEntryDraft,
    ],
  );
  const derivedCostAmountDraft = useMemo(
    () => deriveUnitCost(costTotalAmountDraft, qtyEntryDraft),
    [costTotalAmountDraft, qtyEntryDraft],
  );
  const automaticPreview = useMemo(
    () =>
      editableLine
        ? resolvePreview({
          line: editableLine,
          itemsById,
          measurementConversions,
          itemCostHints,
          overrides: {
            mappedItemId: mappedItemIdDraft,
            movementUnit: movementUnitDraft,
            qtyEntry: qtyEntryDraft,
            costTotalAmount: costTotalAmountDraft,
            manualConversionFactor: '',
          },
        })
        : null,
    [
      editableLine,
      costTotalAmountDraft,
      itemCostHints,
      itemsById,
      mappedItemIdDraft,
      measurementConversions,
      movementUnitDraft,
      qtyEntryDraft,
    ],
  );
  const shouldShowManualConversionInput = Boolean(automaticPreview?.conversionError || manualConversionFactorDraft);

  const availableMovementUnits = useMemo(() => {
    const merged = new Set<string>(ITEM_UNIT_OPTIONS);
    const linkedUnits = itemUnitOptionsByItemId[mappedItemIdDraft] || [];
    for (const unit of linkedUnits) merged.add(unit);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [itemUnitOptionsByItemId, mappedItemIdDraft]);
  const selectedMappedItem = items.find((item: any) => item.id === mappedItemIdDraft) || null;
  const itemButtonLabel = selectedMappedItem
    ? `${selectedMappedItem.name} [${selectedMappedItem.classification || '-'}] (${getItemBaseUnit(selectedMappedItem)})`
    : 'Selecionar item...';
  const isCreatingItem =
    createItemFetcher.state !== 'idle' &&
    String(createItemFetcher.formData?.get('_action') || '') === 'batch-create-and-map-item' &&
    String(createItemFetcher.formData?.get('lineId') || '') === String(editableLine?.id || '');

  if (!activeLine) {
    return (
      <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <div>Linha não encontrada neste lote.</div>
        <Button asChild variant="outline" className="border-red-200 bg-white text-red-700 hover:bg-red-100">
          <Link to={returnTo}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-white pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="outline" className="h-9 rounded-xl">
            <Link to={returnTo}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar para o lote
            </Link>
          </Button>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Documento da linha</h3>
            <p className="text-sm text-slate-500">A subpágina mostra todos os produtos do mesmo documento, com destaque para a linha aberta.</p>
          </div>
        </div>
        <Badge variant="outline" className={statusBadgeClass(activePreview?.status || String(activeLine.status || ''))}>
          {activePreview?.status || activeLine.status}
        </Badge>
      </div>

      {fetcher.data?.message ? (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            fetcher.data?.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          )}
        >
          {fetcher.data.message}
        </div>
      ) : fetcher.data?.payload?.updatedLineId === activeLine.id ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Linha atualizada com sucesso.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Documento</div>
          <div className="text-sm font-medium text-slate-900">{formatDocumentLabel(activeLine.invoiceNumber)}</div>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Data</div>
          <div className="text-sm font-medium text-slate-900">{formatDate(activeLine.movementAt)}</div>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Fornecedor</div>
          <div className="text-sm font-medium text-slate-900">{activeLine.supplierName || '-'}</div>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Conciliação</div>
          <div className="text-sm text-slate-700">{supplierReconciliationLabel(activeLine)}</div>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Itens no documento</div>
          <div className="text-sm font-medium text-slate-900">{documentLines.length}</div>
        </div>
      </section>

      <fetcher.Form method="post" action={`/admin/import-stock-movements/${selectedBatch.id}`} className="space-y-3 bg-white" preventScrollReset>
        <input type="hidden" name="_action" value="batch-edit-line" />
        <input type="hidden" name="batchId" value={selectedBatch.id} />
        <input type="hidden" name="lineId" value={editableLine?.id || ''} />
        <input type="hidden" name="movementAt" value={formatDateTimeLocalValue(editableLine?.movementAt)} />
        <input type="hidden" name="ingredientName" value={editableLine?.ingredientName || ''} />
        <input type="hidden" name="motivo" value={editableLine?.motivo || ''} />
        <input type="hidden" name="invoiceNumber" value={editableLine?.invoiceNumber || ''} />
        <input type="hidden" name="supplierId" value={editableLine?.supplierId || ''} />
          <input type="hidden" name="supplierName" value={editableLine?.supplierName || ''} />
          <input type="hidden" name="supplierCnpj" value={editableLine?.supplierCnpj || ''} />
          <input type="hidden" name="observation" value={editableLine?.observation || ''} />
          <input type="hidden" name="autoApproveCostReview" value="off" />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-900">Comparativo por item do documento</h4>
          <p className="text-xs text-slate-500">Cada item aparece em dois níveis: primeiro a entrada do arquivo e logo abaixo o movimento gerado, com leve recuo à direita. Só a linha aberta é editável no bloco de movimento.</p>
        </div>
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="bg-slate-50 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Linha</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tipo</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Produto</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">UM</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quantidade</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Custo unit.</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Custo total</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Fator</TableHead>
                <TableHead className="bg-slate-50 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentLines.map((line) => {
                const isActive = line.id === editableLine?.id;
                const preview = resolvePreview({
                  line,
                  itemsById,
                  measurementConversions,
                  itemCostHints,
                  overrides: isActive
                    ? {
                      mappedItemId: mappedItemIdDraft,
                      movementUnit: movementUnitDraft,
                      qtyEntry: qtyEntryDraft,
                      costTotalAmount: costTotalAmountDraft,
                      manualConversionFactor: manualConversionFactorDraft,
                    }
                    : undefined,
                  });
                  const hint = preview.mappedItemId ? itemCostHints[preview.mappedItemId] ?? null : null;
                  const canActivateInlineEdit = !isActive;
                  const canApprovePersistedCostReview = String(line.status || '') === 'pending_cost_review';
                  const canSaveThenApprove = isActive && preview.status === 'pending_cost_review' && !canApprovePersistedCostReview;

                  return (
                  <Fragment key={line.id}>
                    <TableRow
                      key={`${line.id}-entry`}
                      className={cn('border-slate-200 align-top bg-white hover:bg-white', isActive && 'border-l-2 border-l-amber-300')}
                    >
                    <TableCell rowSpan={2} className={cn('px-3 py-3 text-xs font-semibold align-top text-slate-700', isActive && 'bg-slate-50')}>
                      {line.rowNumber}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Arquivo
                    </TableCell>
                    <TableCell className="min-w-[260px] px-3 py-3 text-xs font-medium text-slate-900">
                      {line.ingredientName || '-'}
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
                    </TableRow>
                    <TableRow
                      key={`${line.id}-movement`}
                      className={cn(
                        'border-sky-200 align-top bg-sky-50/70',
                        isActive && 'border-l-2 border-l-sky-400 bg-sky-100/70',
                        canActivateInlineEdit && 'cursor-pointer hover:bg-sky-100/80',
                      )}
                      onClick={canActivateInlineEdit ? () => setEditableLineId(String(line.id)) : undefined}
                    >
                      <TableCell className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                        Movimento
                      </TableCell>
                      <TableCell className={cn('min-w-[280px] px-3 py-3 pl-8 text-xs text-slate-900', isActive && 'font-medium')}>
                        {isActive ? (
                          <div className="space-y-2">
                            <input type="hidden" name="mappedItemId" value={mappedItemIdDraft} />
                            <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={itemPickerOpen}
                                  className="h-9 w-full justify-between bg-white"
                                >
                                  <span className="truncate text-left">{itemButtonLabel}</span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[min(420px,calc(100vw-2rem))] p-0"
                                align="start"
                                side="bottom"
                                collisionPadding={16}
                              >
                                <Command>
                                  <CommandInput placeholder="Buscar item do sistema..." />
                                  <CommandList className="max-h-[min(45vh,320px)]">
                                    <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                                    {items.map((item) => (
                                      <CommandItem
                                        key={item.id}
                                        value={`${item.name} ${item.classification || ''} ${item.purchaseUm || ''} ${item.consumptionUm || ''} ${item.id}`}
                                        onSelect={() => {
                                          setMappedItemIdDraft(item.id);
                                          setItemPickerOpen(false);
                                        }}
                                      >
                                        <Check className={cn('mr-2 h-4 w-4', mappedItemIdDraft === item.id ? 'opacity-100' : 'opacity-0')} />
                                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                          <span className="truncate">
                                            {item.name} [{item.classification || '-'}] ({getItemBaseUnit(item)})
                                          </span>
                                          <Link
                                            to={`/admin/items/${item.id}/main`}
                                            className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                            onMouseDown={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                            }}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                            }}
                                          >
                                            Abrir
                                          </Link>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <div className="flex items-center gap-3">
                              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-auto whitespace-nowrap p-0 text-[11px] font-medium text-slate-600 hover:bg-transparent hover:text-slate-900 hover:underline hover:underline-offset-2"
                                  >
                                    + Novo item
                                  </Button>
                                </DialogTrigger>
                                <DialogContent
                                  className="max-w-md"
                                  onCloseAutoFocus={(event) => {
                                    event.preventDefault();
                                  }}
                                >
                                  <DialogHeader>
                                    <DialogTitle>Criar novo item</DialogTitle>
                                  </DialogHeader>
                                  <createItemFetcher.Form
                                    method="post"
                                    action={`/admin/import-stock-movements/${selectedBatch.id}`}
                                    className="space-y-3"
                                    preventScrollReset
                                    onSubmit={() => {
                                      restoreScrollRef.current = window.scrollY;
                                    }}
                                  >
                                    <input type="hidden" name="_action" value="batch-create-and-map-item" />
                                    <input type="hidden" name="batchId" value={selectedBatch.id} />
                                    <input type="hidden" name="lineId" value={editableLine?.id || ''} />
                                    <input type="hidden" name="ingredientNameNormalized" value={editableLine?.ingredientNameNormalized || ''} />
                                    <input type="hidden" name="consumptionUm" value={consumptionUm === '__EMPTY__' ? '' : consumptionUm} />
                                    <input type="hidden" name="classification" value={classification} />
                                    <div className="space-y-1">
                                      <Label>Nome do item</Label>
                                      <Input
                                        name="itemName"
                                        defaultValue={editableLine?.ingredientName || ''}
                                        placeholder="Nome do novo item"
                                        disabled={isCreatingItem}
                                        required
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Classificação</Label>
                                      <Select
                                        value={classification}
                                        onValueChange={(value) => setClassification(value as (typeof ITEM_CLASSIFICATIONS)[number])}
                                        disabled={isCreatingItem}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Selecione a classificação" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {ITEM_CLASSIFICATIONS.map((value) => (
                                            <SelectItem key={value} value={value}>
                                              {value}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Unidade de medida</Label>
                                      <Select value={consumptionUm} onValueChange={setConsumptionUm} disabled={isCreatingItem}>
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Selecionar unidade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__EMPTY__">Selecionar...</SelectItem>
                                          {unitOptions.map((unit) => (
                                            <SelectItem key={unit} value={unit}>
                                              {unit}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isCreatingItem}>
                                      {isCreatingItem ? 'Criando e vinculando...' : 'Criar e vincular'}
                                    </Button>
                                  </createItemFetcher.Form>
                                </DialogContent>
                              </Dialog>
                              {mappedItemIdDraft ? (
                                <Link
                                  to={`/admin/items/${mappedItemIdDraft}/main`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                                >
                                  Editar item
                                </Link>
                              ) : (
                                <span className="text-[11px] text-slate-400">Editar item</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>{preview.selectedItem ? `${preview.selectedItem.name} (${getItemBaseUnit(preview.selectedItem)})` : '-'}</div>
                        )}
                    </TableCell>
                    <TableCell className="min-w-[120px] px-3 py-3 text-xs text-slate-700">
                      {isActive ? (
                        <>
                          <input type="hidden" name="movementUnit" value={movementUnitDraft} />
                          <Select value={movementUnitDraft || '__EMPTY__'} onValueChange={(value) => setMovementUnitDraft(value === '__EMPTY__' ? '' : value)}>
                            <SelectTrigger className="h-9 bg-white">
                              <SelectValue placeholder="Selecionar UM" />
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
                        preview.targetUnit || '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px] px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                      {isActive ? (
                        <DecimalInput name="qtyEntry" defaultValue={qtyEntryDraft} onValueChange={setQtyEntryDraft} fractionDigits={3} className="w-full bg-white" />
                      ) : (
                        formatDecimal(preview.convertedQuantity)
                      )}
                    </TableCell>
                    <TableCell className="min-w-[150px] px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                      {isActive ? (
                        <>
                          <input type="hidden" name="costAmount" value={derivedCostAmountDraft != null ? String(derivedCostAmountDraft) : ''} />
                          <div className="px-0 py-0 text-right font-mono text-xs tabular-nums text-slate-700">
                            {derivedCostAmountDraft != null
                              ? `${formatMoney(derivedCostAmountDraft)}${movementUnitDraft ? ` / ${movementUnitDraft}` : ''}`
                              : '-'}
                          </div>
                        </>
                      ) : (
                        `${formatMoney(preview.convertedCostAmount)}${preview.targetUnit ? ` / ${preview.targetUnit}` : ''}`
                      )}
                    </TableCell>
                    <TableCell className="min-w-[150px] px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                      {isActive ? (
                        <DecimalInput name="costTotalAmount" defaultValue={costTotalAmountDraft} onValueChange={setCostTotalAmountDraft} fractionDigits={2} className="w-full bg-white" />
                      ) : (
                        formatMoney(preview.costTotalAmount)
                      )}
                    </TableCell>
                    <TableCell className="min-w-[180px] px-3 py-3 text-xs text-slate-700">
                      {isActive ? (
                        shouldShowManualConversionInput ? (
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500">Manual</Label>
                            <DecimalInput
                              name="manualConversionFactor"
                              defaultValue={manualConversionFactorDraft ? Number(manualConversionFactorDraft) : 0}
                              onValueChange={(value) => setManualConversionFactorDraft(value > 0 ? String(value) : '')}
                              fractionDigits={6}
                              className="w-full bg-white"
                              placeholder="0,000000"
                            />
                          </div>
                        ) : (
                          <>
                            <input type="hidden" name="manualConversionFactor" value="" />
                            <div className="space-y-0.5">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Automático</div>
                              <div className="space-y-0.5 text-slate-700">
                                <div className="font-mono text-xs">
                                  {automaticPreview?.conversionFactorUsed
                                    ? formatDecimal(automaticPreview.conversionFactorUsed, 6)
                                    : '-'}
                                </div>
                                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                                  {automaticPreview?.conversionSource || '-'}
                                </div>
                              </div>
                            </div>
                          </>
                        )
                      ) : preview.conversionFactorUsed ? (
                        <div className="space-y-0.5">
                          <div className="font-mono">{formatDecimal(preview.conversionFactorUsed, 6)}</div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">{preview.conversionSource || '-'}</div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-mono">-</div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">{preview.conversionSource || '-'}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[220px] px-3 py-3 text-xs">
                        {preview.status === 'pending_cost_review' && canApprovePersistedCostReview ? (
                          <PendingCostReviewBadgeAction
                            batchId={selectedBatch.id}
                            lineId={String(line.id)}
                            onApproved={() => revalidator.revalidate()}
                          />
                        ) : preview.status === 'pending_cost_review' && canSaveThenApprove ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const form = event.currentTarget.form;
                              if (!form) return;
                              const formData = new FormData(form);
                              formData.set('autoApproveCostReview', 'on');
                              fetcher.submit(formData, {
                                method: 'post',
                                action: `/admin/import-stock-movements/${selectedBatch.id}`,
                              });
                            }}
                            className="inline-flex"
                            disabled={fetcher.state !== 'idle'}
                          >
                            <Badge
                              variant="outline"
                              className={cn('cursor-pointer hover:bg-amber-100', statusBadgeClass('pending_cost_review'))}
                            >
                              {fetcher.state !== 'idle' ? 'salvando...' : 'pending_cost_review'}
                            </Badge>
                          </button>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(preview.statusMessage ? 'cursor-help' : '', statusBadgeClass(preview.status))}
                          >
                            {preview.status}
                          </Badge>
                      )}
                      {preview.status === 'pending_cost_review' && hint?.lastCostPerUnit != null ? (
                        <div className="mt-1 text-[11px] font-medium text-red-700">
                          último: {formatMoney(hint.lastCostPerUnit)}
                          {preview.targetUnit ? ` / ${preview.targetUnit}` : ''}
                        </div>
                      ) : null}
                      {!isActive && preview.statusMessage && preview.status !== 'pending_cost_review' ? (
                        <div className="mt-1 text-[11px] text-slate-600">{preview.statusMessage}</div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild type="button" variant="outline" className="rounded-xl">
            <Link to={returnTo}>Fechar</Link>
          </Button>
          <Button type="submit" className="rounded-xl bg-slate-900 text-white hover:bg-slate-800" disabled={fetcher.state !== 'idle'}>
            {fetcher.state !== 'idle' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar linha {editableLine?.rowNumber || activeLine.rowNumber}
          </Button>
        </div>
      </fetcher.Form>
    </div>
  );
}
