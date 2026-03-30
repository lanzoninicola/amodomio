import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, Link, NavLink, Outlet, useActionData, useFetcher, useLoaderData, useNavigation, useRevalidator } from '@remix-run/react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { authenticator } from '~/domain/auth/google.server';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getAvailableItemUnits } from '~/domain/item/item-units.server';
import { isItemCostExcludedFromMetrics, normalizeItemCostToConsumptionUnit } from '~/domain/item/item-cost-metrics.server';
import {
  archiveStockMovementImportBatch,
  deleteStockMovementImportBatch,
  getStockMovementImportBatchView,
  importStockMovementImportBatchLine,
  mapBatchLinesToItem,
  reconcileStockMovementImportBatchSuppliersFromFile,
  rollbackStockMovementImportBatch,
  retryStockMovementImportBatchErrors,
  approveBatchLineCostReview,
  setBatchLineIgnored,
  setBatchLineManualConversion,
  startStockMovementImportBatch,
  updateStockMovementImportBatchLineEditableFields,
} from '~/domain/stock-movement/stock-movement-import.server';
import { cn } from '~/lib/utils';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

const ITEM_CLASSIFICATIONS = [
  'insumo',
  'semi_acabado',
  'produto_final',
  'embalagem',
  'servico',
  'outro',
] as const;

function resolveLatestCostHint(params: {
  currentRows: any[];
  historyRows: any[];
}) {
  const firstHistoryRow = params.historyRows[0];
  const item = firstHistoryRow?.ItemVariation?.Item || params.currentRows[0]?.ItemVariation?.Item || {};

  for (const row of params.historyRows) {
    if (isItemCostExcludedFromMetrics(row)) continue;
    const normalized = normalizeItemCostToConsumptionUnit(
      { costAmount: row.costAmount, unit: row.unit, source: row.source },
      item,
    );
    if (Number.isFinite(normalized) && Number(normalized) > 0) {
      return Number(normalized);
    }
  }

  for (const row of params.currentRows) {
    const normalized = normalizeItemCostToConsumptionUnit(
      { costAmount: row.costAmount, unit: row.unit, source: row.source },
      row?.ItemVariation?.Item || item,
    );
    if (Number.isFinite(normalized) && Number(normalized) > 0) {
      return Number(normalized);
    }
  }

  return null;
}

export const LINE_STATUS_GUIDE = [
  {
    status: 'ready',
    meaning: 'Linha pronta, com item mapeado e conversão resolvida.',
    impact: 'Pode ser importada quando o fornecedor do documento já estiver conciliado.',
  },
  {
    status: 'pending_mapping',
    meaning: 'Ingrediente ainda não foi vinculado a um item do sistema.',
    impact: 'Bloqueia a importação até o vínculo ser resolvido.',
  },
  {
    status: 'pending_supplier',
    meaning: 'Documento ainda está sem conciliação de fornecedor.',
    impact: 'Bloqueia a aplicação da linha até a conciliação do fornecedor.',
  },
  {
    status: 'pending_cost_review',
    meaning: 'Linha com variacao relevante de custo em relacao ao ultimo valor conhecido.',
    impact: 'Bloqueia a importação até o usuário revisar e aprovar manualmente.',
  },
  {
    status: 'pending_conversion',
    meaning: 'Não foi encontrada conversão válida de unidade/custo.',
    impact: 'Bloqueia a importação até informar ou resolver a conversão.',
  },
  {
    status: 'skipped_duplicate',
    meaning: 'Linha detectada como duplicada no lote atual ou já importada antes.',
    impact: 'Não será importada para evitar duplicidade.',
  },
  {
    status: 'ignored',
    meaning: 'Linha foi ignorada manualmente pelo usuário.',
    impact: 'Fica fora da importação enquanto permanecer ignorada.',
  },
  {
    status: 'invalid',
    meaning: 'Linha inválida por documento, data, motivo ou custo inconsistente.',
    impact: 'Não pode ser importada.',
  },
  {
    status: 'error',
    meaning: 'Falha durante processamento ou aplicação da linha.',
    impact: 'Não é importada até corrigir a causa e reprocessar.',
  },
  {
    status: 'imported',
    meaning: 'Linha já foi importada como movimentação de estoque.',
    impact: 'Já entrou no estoque; não deve ser importada novamente.',
  },
] as const;

const LINE_STATUS_NAV = LINE_STATUS_GUIDE.map((row) => ({
  status: row.status,
  label:
    {
      ready: 'Prontas',
      pending_mapping: 'Pend. vínculo',
      pending_supplier: 'Pend. fornecedor',
      pending_cost_review: 'Rev. custo',
      pending_conversion: 'Pend. conversão',
      skipped_duplicate: 'Duplicadas',
      ignored: 'Ignoradas',
      invalid: 'Inválidas',
      error: 'Erros',
      imported: 'Importadas',
    }[row.status] || String(row.status),
}));

function str(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function normalizeItemUnit(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
}

function getItemBaseUnit(item: { purchaseUm?: string | null; consumptionUm?: string | null } | null | undefined) {
  return item?.consumptionUm || item?.purchaseUm || '-';
}

function num(value: FormDataEntryValue | null) {
  const n = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function deriveUnitCost(totalAmount: unknown, quantity: unknown) {
  const total = Number(totalAmount);
  const qty = Number(quantity);
  if (!Number.isFinite(total) || !Number.isFinite(qty) || qty <= 0) return null;
  const unitCost = total / qty;
  return Number.isFinite(unitCost) && unitCost > 0 ? unitCost : null;
}

export function formatDate(value: any) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

export function formatMoney(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDocumentLabel(value: any) {
  const documentNumber = String(value || '').trim();
  if (!documentNumber) return '-';
  if (documentNumber.startsWith('CUPOM-')) return 'Cupom fiscal';
  return documentNumber;
}

function capitalizeWords(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function redirectToCurrentPath(request: Request, fallbackPath: string) {
  const formUrl = new URL(request.url);
  const pathname = String(formUrl.pathname || '').trim();
  return pathname || fallbackPath;
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    ready: Number(summary?.ready || 0),
    readyToImport: Number(summary?.readyToImport || 0),
    invalid: Number(summary?.invalid || 0),
    pendingMapping: Number(summary?.pendingMapping || 0),
    pendingSupplier: Number(summary?.pendingSupplier || 0),
    pendingConversion: Number(summary?.pendingConversion || 0),
    pendingCostReview: Number(summary?.pendingCostReview || 0),
    imported: Number(summary?.imported || 0),
    ignored: Number(summary?.ignored || 0),
    skippedDuplicate: Number(summary?.skippedDuplicate || 0),
    error: Number(summary?.error || 0),
  };
}

export function supplierReconciliationLabel(line: any) {
  if (line?.supplierReconciliationStatus === 'manual') return 'conciliado manualmente';
  if (line?.supplierReconciliationStatus === 'matched' || line?.supplierId) return 'conciliado com cadastro';
  if (line?.supplierReconciliationStatus === 'unmatched') return 'pendente de conciliação';
  return 'sem conciliação iniciada';
}

export function statusBadgeClass(status: string) {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'imported':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'pending_mapping':
    case 'pending_supplier':
    case 'pending_conversion':
    case 'pending_cost_review':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'invalid':
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'skipped_duplicate':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    case 'ignored':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

export function DeleteBatchButton({ batchId, batchName, status }: { batchId: string; batchName: string; status: string }) {
  const isValidated = status === 'validated';

  if (!isValidated) {
    return (
      <Form method="post">
        <input type="hidden" name="_action" value="batch-delete" />
        <input type="hidden" name="batchId" value={batchId} />
        <Button type="submit" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
          Eliminar lote
        </Button>
      </Form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
          Eliminar lote
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar lote validado?</AlertDialogTitle>
          <AlertDialogDescription>
            O lote <strong>{batchName}</strong> está com status <strong>validated</strong>. Confirme se deseja eliminar este lote.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Form method="post">
            <input type="hidden" name="_action" value="batch-delete" />
            <input type="hidden" name="batchId" value={batchId} />
            <AlertDialogAction asChild>
              <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
                Confirmar eliminação
              </Button>
            </AlertDialogAction>
          </Form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ItemSystemMapperCell({
  line,
  items,
  batchId,
  unitOptions,
  costHint,
}: {
  line: any;
  items: any[];
  batchId: string;
  unitOptions: string[];
  costHint?: { lastCostPerUnit: number | null; avgCostPerUnit: number | null } | null;
}) {
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(String(line.mappedItemId || ''));
  const [classification, setClassification] = useState<(typeof ITEM_CLASSIFICATIONS)[number]>('insumo');
  const [consumptionUm, setConsumptionUm] = useState(() => {
    const normalizedUnit = normalizeItemUnit(line.movementUnit);
    return normalizedUnit && unitOptions.includes(normalizedUnit) ? normalizedUnit : '__EMPTY__';
  });
  const mapItemFetcher = useFetcher<typeof action>();
  const createItemFetcher = useFetcher<typeof action>();
  const restoreScrollRef = useRef<number | null>(null);
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const isMappingItem =
    mapItemFetcher.state !== 'idle' &&
    mapItemFetcher.formData?.get('_action') === 'batch-map-item' &&
    String(mapItemFetcher.formData?.get('lineId') || '') === String(line.id);
  const isCreatingItem =
    createItemFetcher.state !== 'idle' &&
    createItemFetcher.formData?.get('_action') === 'batch-create-and-map-item' &&
    String(createItemFetcher.formData?.get('lineId') || '') === String(line.id);
  const buttonLabel = selectedItem
    ? `${selectedItem.name} [${selectedItem.classification || '-'}] (${getItemBaseUnit(selectedItem)})`
    : line.mappedItemName || 'Selecionar item...';

  useEffect(() => {
    if (createItemFetcher.state !== 'idle') return;
    if ((createItemFetcher.data as any)?.status !== 200) return;
    const createdItemId = String((createItemFetcher.data as any)?.payload?.createdItemId || '');
    if (createdItemId) {
      setSelectedItemId(createdItemId);
    }
    setCreateDialogOpen(false);
    if (restoreScrollRef.current != null) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: restoreScrollRef.current || 0 });
      });
    }
  }, [createItemFetcher.state, createItemFetcher.data]);

  return (
    <div className="space-y-1">
      <mapItemFetcher.Form method="post" action={`/admin/import-stock-movements/${batchId}`} className="space-y-1">
        <input type="hidden" name="_action" value="batch-map-item" />
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="lineId" value={line.id} />
        <input type="hidden" name="ingredientNameNormalized" value={line.ingredientNameNormalized || ''} />
        <input type="hidden" name="itemId" value={selectedItemId} />
        <input type="hidden" name="saveAlias" value="on" />
        <div className="flex min-w-[320px] items-center gap-2">
          <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={itemPickerOpen}
                className="h-9 flex-1 justify-between"
                disabled={isMappingItem}
              >
                <span className="truncate text-left">{buttonLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar item do sistema..." />
                <CommandList className="max-h-[45vh]">
                  <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.name} ${item.classification || ''} ${item.purchaseUm || ''} ${item.consumptionUm || ''} ${item.id}`}
                      onSelect={() => {
                        setSelectedItemId(item.id);
                        setItemPickerOpen(false);
                        mapItemFetcher.submit(
                          {
                            _action: 'batch-map-item',
                            batchId,
                            lineId: line.id,
                            ingredientNameNormalized: line.ingredientNameNormalized || '',
                            itemId: item.id,
                            saveAlias: 'on',
                          },
                          { method: 'post', action: `/admin/import-stock-movements/${batchId}` },
                        );
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', selectedItemId === item.id ? 'opacity-100' : 'opacity-0')} />
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
          <label className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-600">
            <input type="checkbox" name="applyToAllSameIngredient" className="h-3.5 w-3.5" />
            todas iguais
          </label>
        </div>
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
                action={`/admin/import-stock-movements/${batchId}`}
                className="space-y-3"
                preventScrollReset
                onSubmit={() => {
                  restoreScrollRef.current = window.scrollY;
                }}
              >
                <input type="hidden" name="_action" value="batch-create-and-map-item" />
                <input type="hidden" name="batchId" value={batchId} />
                <input type="hidden" name="lineId" value={line.id} />
                <input type="hidden" name="ingredientNameNormalized" value={line.ingredientNameNormalized || ''} />
                <input type="hidden" name="consumptionUm" value={consumptionUm === '__EMPTY__' ? '' : consumptionUm} />
                <input type="hidden" name="classification" value={classification} />
                <div className="space-y-1">
                  <Label htmlFor={`itemName-${line.id}`}>Nome do item</Label>
                  <Input
                    id={`itemName-${line.id}`}
                    name="itemName"
                    defaultValue={capitalizeWords(line.ingredientName || '')}
                    placeholder="Nome do novo item"
                    disabled={isCreatingItem}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`classification-${line.id}`}>Classificação</Label>
                  <Select
                    value={classification}
                    onValueChange={(value) => setClassification(value as (typeof ITEM_CLASSIFICATIONS)[number])}
                    disabled={isCreatingItem}
                  >
                    <SelectTrigger id={`classification-${line.id}`} className="h-9">
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
                  <Label htmlFor={`consumptionUm-${line.id}`}>Unidade de medida</Label>
                  <Select value={consumptionUm} onValueChange={setConsumptionUm} disabled={isCreatingItem}>
                    <SelectTrigger id={`consumptionUm-${line.id}`} className="h-9">
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
          {selectedItemId ? (
            <>
              <Link
                to={`/admin/items/${selectedItemId}/main`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                Editar item
              </Link>
              <Link
                to={`/admin/stock-movements?itemId=${encodeURIComponent(selectedItemId)}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                Movimentações estoque
              </Link>
            </>
          ) : (
            <>
              <span className="text-[11px] text-slate-400">Editar item</span>
              <span className="text-[11px] text-slate-400">Movimentações estoque</span>
            </>
          )}
        </div>
        {costHint && (costHint.lastCostPerUnit != null || costHint.avgCostPerUnit != null) ? (
          <div className="text-[11px] text-slate-500">
            {costHint.lastCostPerUnit != null && <>último: {formatMoney(costHint.lastCostPerUnit)}</>}
            {costHint.avgCostPerUnit != null && (
              <> {costHint.lastCostPerUnit != null ? '• ' : ''}médio: {formatMoney(costHint.avgCostPerUnit)}</>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500">{line.mappingSource || '-'}</div>
        )}
      </mapItemFetcher.Form>
    </div>
  );
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const batchId = String(params.batchId || '').trim();
    if (!batchId) return badRequest('Lote inválido');

    const db = itemPrismaEntity.client as any;
    const [selected, unitOptions, categories, suppliers, measurementConversionsRaw] = await Promise.all([
      getStockMovementImportBatchView(batchId),
      getAvailableItemUnits(),
      db.category.findMany({
        where: { type: 'item' },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }],
      }),
      typeof db.supplier?.findMany === 'function'
        ? db.supplier.findMany({
            select: { id: true, name: true, cnpj: true },
            orderBy: [{ name: 'asc' }],
            take: 2000,
          })
        : Promise.resolve([]),
      typeof db.measurementUnitConversion?.findMany === 'function'
        ? db.measurementUnitConversion.findMany({
            where: { active: true },
            select: {
              factor: true,
              FromUnit: { select: { code: true } },
              ToUnit: { select: { code: true } },
            },
          })
        : Promise.resolve([]),
    ]);
    if (!selected) return badRequest('Lote não encontrado');

    const measurementConversions = (measurementConversionsRaw as Array<{
      factor: number;
      FromUnit?: { code?: string | null } | null;
      ToUnit?: { code?: string | null } | null;
    }>).flatMap((row) => {
      const fromUnit = normalizeItemUnit(row?.FromUnit?.code);
      const toUnit = normalizeItemUnit(row?.ToUnit?.code);
      const factor = Number(row?.factor ?? NaN);
      if (!fromUnit || !toUnit || !(factor > 0)) return [];
      return [{ fromUnit, toUnit, factor }];
    });

    const itemIds = Array.from(
      new Set(
        ((selected.items as any[]) || [])
          .map((item) => String(item?.id || '').trim())
          .filter(Boolean),
      ),
    );
    const itemUnitOptionsByItemId: Record<string, string[]> = {};
    if (itemIds.length > 0 && typeof db.itemUnit?.findMany === 'function') {
      const linkedUnits = await db.itemUnit.findMany({
        where: {
          itemId: { in: itemIds },
          MeasurementUnit: { active: true },
        },
        select: {
          itemId: true,
          unitCode: true,
        },
      });

      for (const itemId of itemIds) {
        itemUnitOptionsByItemId[itemId] = [];
      }

      for (const row of linkedUnits as Array<{ itemId: string; unitCode: string }>) {
        const itemId = String(row.itemId || '').trim();
        const unitCode = normalizeItemUnit(row.unitCode);
        if (!itemId || !unitCode) continue;
        if (!itemUnitOptionsByItemId[itemId]) itemUnitOptionsByItemId[itemId] = [];
        if (!itemUnitOptionsByItemId[itemId].includes(unitCode)) {
          itemUnitOptionsByItemId[itemId].push(unitCode);
        }
      }

      for (const itemId of Object.keys(itemUnitOptionsByItemId)) {
        itemUnitOptionsByItemId[itemId].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      }
    }

    const mappedItemIds = [
      ...new Set(
        (selected.lines as any[]).filter((l) => l.mappedItemId).map((l) => String(l.mappedItemId)),
      ),
    ];
    const itemCostHints: Record<string, { lastCostPerUnit: number | null; avgCostPerUnit: number | null }> = {};
    if (mappedItemIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const itemVariationSelect = {
        itemId: true,
        isReference: true,
        Item: {
          select: {
            purchaseUm: true,
            consumptionUm: true,
            purchaseToConsumptionFactor: true,
            ItemPurchaseConversion: {
              select: {
                purchaseUm: true,
                factor: true,
              },
            },
          },
        },
      };
      const [costRows, historyRows] = await Promise.all([
        db.itemCostVariation.findMany({
          where: { ItemVariation: { itemId: { in: mappedItemIds }, deletedAt: null } },
          select: { costAmount: true, unit: true, source: true, ItemVariation: { select: itemVariationSelect } },
          orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
        }),
        db.itemCostVariationHistory.findMany({
          where: {
            ItemVariation: { itemId: { in: mappedItemIds }, deletedAt: null },
            OR: [{ validFrom: { gte: thirtyDaysAgo } }, { createdAt: { gte: thirtyDaysAgo } }],
          },
          select: {
            costAmount: true,
            unit: true,
            source: true,
            metadata: true,
            validFrom: true,
            createdAt: true,
            ItemVariation: { select: itemVariationSelect },
          },
          orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
          take: 500,
        }),
      ]);
      const currentRowsByItemId = new Map<string, any[]>();
      for (const row of costRows as any[]) {
        const itemId = row.ItemVariation?.itemId;
        if (!itemId) continue;
        if (!currentRowsByItemId.has(itemId)) currentRowsByItemId.set(itemId, []);
        currentRowsByItemId.get(itemId)!.push(row);
      }
      const historyByItemId = new Map<string, any[]>();
      for (const row of historyRows as any[]) {
        const itemId = row.ItemVariation?.itemId;
        if (!itemId) continue;
        if (!historyByItemId.has(itemId)) historyByItemId.set(itemId, []);
        historyByItemId.get(itemId)!.push(row);
      }
      for (const itemId of mappedItemIds) {
        itemCostHints[itemId] = {
          lastCostPerUnit: resolveLatestCostHint({
            currentRows: currentRowsByItemId.get(itemId) || [],
            historyRows: historyByItemId.get(itemId) || [],
          }),
          avgCostPerUnit: null,
        };
      }
      for (const [itemId, entries] of historyByItemId.entries()) {
        const item = (entries[0] as any)?.ItemVariation?.Item || {};
        const normalized = (entries as any[])
          .filter((e) => !isItemCostExcludedFromMetrics(e))
          .map((e) => normalizeItemCostToConsumptionUnit({ costAmount: e.costAmount, unit: e.unit, source: e.source }, item))
          .filter((v): v is number => Number.isFinite(v as number) && (v as number) > 0);
        const avg = normalized.length > 0 ? normalized.reduce((a, b) => a + b, 0) / normalized.length : null;
        if (itemId in itemCostHints) {
          itemCostHints[itemId].avgCostPerUnit = avg;
        } else {
          itemCostHints[itemId] = { lastCostPerUnit: null, avgCostPerUnit: avg };
        }
      }
    }

    return ok({
      selected,
      batchId,
      unitOptions,
      itemUnitOptionsByItemId,
      measurementConversions,
      categories,
      suppliers,
      itemCostHints,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    const actor = (user as any)?.email || (user as any)?.displayName || (user as any)?.name || null;

    const routeBatchId = String(params.batchId || '').trim();
    if (!routeBatchId) return badRequest('Lote inválido');

    const formData = await request.formData();
    const _action = str(formData.get('_action'));
    const batchId = str(formData.get('batchId')) || routeBatchId;

    if (batchId !== routeBatchId) return badRequest('Lote divergente');

    const db = itemPrismaEntity.client as any;
    const currentBatch = await db.stockMovementImportBatch.findUnique({
      where: { id: batchId },
      select: { id: true, importStatus: true },
    });
    if (!currentBatch) return badRequest('Lote não encontrado');
    const isBatchImporting = String(currentBatch.importStatus || 'idle') === 'importing';
    if (isBatchImporting && _action !== 'batch-import') {
      return badRequest('Aguarde o término da importação em andamento antes de executar outra ação no lote.');
    }

    if (_action === 'batch-map-item') {
      const itemId = str(formData.get('itemId'));
      const lineId = str(formData.get('lineId')) || null;
      const ingredientNameNormalized = str(formData.get('ingredientNameNormalized')) || null;
      const applyToAllSameIngredient = str(formData.get('applyToAllSameIngredient')) === 'on';
      const saveAlias = str(formData.get('saveAlias')) === 'on';
      if (!itemId) return badRequest('Selecione um item');

      await mapBatchLinesToItem({
        batchId,
        lineId,
        ingredientNameNormalized,
        itemId,
        applyToAllSameIngredient,
        saveAlias,
        actor,
      });

      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-set-manual-conversion') {
      const lineId = str(formData.get('lineId'));
      const factor = num(formData.get('factor'));
      if (!lineId) return badRequest('Linha inválida');
      if (!(factor > 0)) return badRequest('Informe um fator maior que zero');
      await setBatchLineManualConversion({ batchId, lineId, factor });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-edit-line') {
      const lineId = str(formData.get('lineId'));
      if (!lineId) return badRequest('Linha inválida');
      const autoApproveCostReview = str(formData.get('autoApproveCostReview')) === 'on';
      const importAfterSave = str(formData.get('importAfterSave')) === 'on';
      const mappedItemId = str(formData.get('mappedItemId')) || null;
      const movementUnit = str(formData.get('movementUnit')).toUpperCase() || null;
      const qtyEntryRaw = num(formData.get('qtyEntry'));
      const costTotalAmountRaw = num(formData.get('costTotalAmount'));
      const derivedCostAmount = deriveUnitCost(costTotalAmountRaw, qtyEntryRaw);
      if (movementUnit) {
        const availableUnits = await getAvailableItemUnits(mappedItemId || undefined);
        if (!availableUnits.includes(movementUnit)) {
          return badRequest('UM do movimento inválida');
        }
      }
      const movementAtRaw = str(formData.get('movementAt'));
      const movementAt = movementAtRaw ? new Date(movementAtRaw) : null;
      const manualFactorRaw = num(formData.get('manualConversionFactor'));
      const previousLine = await db.stockMovementImportBatchLine.findUnique({
        where: { id: lineId },
        select: { appliedAt: true, rolledBackAt: true },
      });
      await updateStockMovementImportBatchLineEditableFields({
        batchId,
        lineId,
        actor,
        movementAt: movementAt && !Number.isNaN(movementAt.getTime()) ? movementAt : null,
        ingredientName: str(formData.get('ingredientName')),
        motivo: str(formData.get('motivo')) || null,
        invoiceNumber: str(formData.get('invoiceNumber')) || null,
        supplierId: str(formData.get('supplierId')) || null,
        supplierName: str(formData.get('supplierName')) || null,
        supplierCnpj: str(formData.get('supplierCnpj')) || null,
        qtyEntry: qtyEntryRaw || null,
        unitEntry: movementUnit,
        qtyConsumption: qtyEntryRaw || null,
        unitConsumption: movementUnit,
        movementUnit,
        costAmount: derivedCostAmount,
        costTotalAmount: costTotalAmountRaw || null,
        mappedItemId,
        manualConversionFactor: Number.isFinite(manualFactorRaw) && manualFactorRaw > 0 ? manualFactorRaw : null,
        observation: str(formData.get('observation')) || null,
      });
      let autoApprovedCostReview = false;
      if (autoApproveCostReview) {
        const updatedLine = await db.stockMovementImportBatchLine.findUnique({
          where: { id: lineId },
          select: { status: true },
        });
        if (String(updatedLine?.status || '') === 'pending_cost_review') {
          await approveBatchLineCostReview({ batchId, lineId, actor });
          autoApprovedCostReview = true;
        }
      }
      let importedLine = false;
      if (importAfterSave && (previousLine?.rolledBackAt || !previousLine?.appliedAt)) {
        const importResult = await importStockMovementImportBatchLine({
          batchId,
          lineId,
          actor,
        });
        importedLine = importResult.imported > 0;
      }
      return ok({ updatedLineId: lineId, autoApprovedCostReview, importedLine });
    }

    if (_action === 'batch-approve-cost-review') {
      const lineId = str(formData.get('lineId'));
      if (!lineId) return badRequest('Linha inválida');
      await approveBatchLineCostReview({ batchId, lineId, actor });
      return ok({ approvedLineId: lineId });
    }

    if (_action === 'batch-ignore-line' || _action === 'batch-unignore-line') {
      const lineId = str(formData.get('lineId'));
      if (!lineId) return badRequest('Linha inválida');
      await setBatchLineIgnored({
        batchId,
        lineId,
        ignored: _action === 'batch-ignore-line',
      });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-retry-line-error') {
      const lineId = str(formData.get('lineId'));
      if (!lineId) return badRequest('Linha inválida');
      await retryStockMovementImportBatchErrors({ batchId, lineId });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-retry-errors') {
      await retryStockMovementImportBatchErrors({ batchId });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-create-and-map-item') {
      const lineId = str(formData.get('lineId'));
      const ingredientNameNormalized = str(formData.get('ingredientNameNormalized')) || null;
      const itemName = str(formData.get('itemName'));
      const classificationRaw = str(formData.get('classification')).toLowerCase();
      const categoryIdRaw = str(formData.get('categoryId'));
      const categoryId = categoryIdRaw || null;
      const consumptionUm = normalizeItemUnit(formData.get('consumptionUm'));

      if (!lineId) return badRequest('Linha inválida');
      if (!itemName) return badRequest('Informe o nome do novo item');
      if (!ITEM_CLASSIFICATIONS.includes(classificationRaw as (typeof ITEM_CLASSIFICATIONS)[number])) {
        return badRequest('Classificação inválida');
      }
      const availableUnits = await getAvailableItemUnits();
      if (consumptionUm && !availableUnits.includes(consumptionUm)) {
        return badRequest('Unidade de consumo inválida');
      }
      if (categoryId) {
        const categoryExists = await db.category.findUnique({
          where: { id: categoryId },
          select: { id: true, type: true },
        });
        if (!categoryExists || categoryExists.type !== 'item') {
          return badRequest('Categoria inválida');
        }
      }

      const created = await itemPrismaEntity.create({
        name: capitalizeWords(itemName),
        classification: classificationRaw,
        categoryId,
        consumptionUm,
        active: true,
        canPurchase: true,
        canStock: true,
      });

      await mapBatchLinesToItem({
        batchId,
        lineId,
        ingredientNameNormalized,
        itemId: created.id,
        applyToAllSameIngredient: false,
        saveAlias: true,
        actor,
      });

      return ok({ createdItemId: created.id });
    }

    if (_action === 'batch-import') {
      await startStockMovementImportBatch({ batchId, actor });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-attach-supplier-json') {
      const supplierNotesFile = formData.get('supplierNotesFile');
      if (!(supplierNotesFile instanceof File) || supplierNotesFile.size <= 0) {
        return badRequest('Selecione um arquivo JSON');
      }
      if (!supplierNotesFile.name.toLowerCase().endsWith('.json')) {
        return badRequest('Arquivo inválido. Envie um .json');
      }
      await reconcileStockMovementImportBatchSuppliersFromFile({
        batchId,
        fileName: supplierNotesFile.name,
        fileBuffer: Buffer.from(await supplierNotesFile.arrayBuffer()),
      });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-rollback') {
      await rollbackStockMovementImportBatch({ batchId, actor });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-archive') {
      await archiveStockMovementImportBatch(batchId);
      return redirect('/admin/import-stock-movements');
    }

    if (_action === 'batch-delete') {
      await deleteStockMovementImportBatch(batchId);
      return redirect('/admin/import-stock-movements');
    }

    return badRequest('Ação inválida');
  } catch (error) {
    return serverError(error);
  }
}

export type AdminImportStockMovementsBatchOutletContext = {
  selected: any;
  selectedBatch: any;
  lines: any[];
  items: any[];
  appliedChanges: any[];
  unitOptions: string[];
  itemUnitOptionsByItemId: Record<string, string[]>;
  measurementConversions: Array<{ fromUnit: string; toUnit: string; factor: number }>;
  suppliers: any[];
  itemCostHints: Record<string, { lastCostPerUnit: number | null; avgCostPerUnit: number | null }>;
  summary: ReturnType<typeof summaryFromAny>;
  isImportingBatch: boolean;
};

export default function AdminImportStockMovementsBatchDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const importStepFetcher = useFetcher<any>();
  const payload = (loaderData as any)?.payload || {};
  const selected = payload.selected as any;
  const selectedBatch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const items = (selected?.items || []) as any[];
  const appliedChanges = (selected?.appliedChanges || []) as any[];
  const unitOptions = (((loaderData as any)?.payload?.unitOptions || []) as string[]);
  const itemUnitOptionsByItemId = (((loaderData as any)?.payload?.itemUnitOptionsByItemId || {}) as Record<string, string[]>);
  const measurementConversions = (((loaderData as any)?.payload?.measurementConversions || []) as Array<{
    fromUnit: string;
    toUnit: string;
    factor: number;
  }>);
  const suppliers = (((loaderData as any)?.payload?.suppliers || []) as any[]);
  const itemCostHints = (((loaderData as any)?.payload?.itemCostHints || {}) as Record<
    string,
    { lastCostPerUnit: number | null; avgCostPerUnit: number | null }
  >);
  const summary = summaryFromAny(selected?.summary || selectedBatch?.summary);
  const batchImportStatus = String(selectedBatch?.importStatus || 'idle');
  const batchImportProcessedCount = Number(selectedBatch?.importProcessedCount || 0);
  const batchImportErrorCount = Number(selectedBatch?.importErrorCount || 0);
  const batchImportTotalCount = Number(selectedBatch?.importTotalCount || 0);
  const batchImportMessage = String(selectedBatch?.importMessage || '').trim();
  const isImportingBatch =
    batchImportStatus === 'importing' ||
    (navigation.state === 'submitting' &&
      String(navigation.formData?.get('_action') || '') === 'batch-import' &&
      String(navigation.formData?.get('batchId') || '') === String(selectedBatch?.id || ''));
  const importStepInFlight = importStepFetcher.state !== 'idle';
  const displayedProcessedCount = Number(importStepFetcher.data?.payload?.progress?.processedCount ?? batchImportProcessedCount);
  const displayedErrorCount = Number(importStepFetcher.data?.payload?.progress?.errorCount ?? batchImportErrorCount);
  const displayedTotalCount = Number(importStepFetcher.data?.payload?.progress?.totalCount ?? batchImportTotalCount);
  const displayedImportMessage = String(importStepFetcher.data?.payload?.progress?.message || batchImportMessage || '').trim();
  const statusCounts = lines.reduce(
    (acc, line) => {
      const status = String(line?.status || '').trim();
      if (!status) return acc;
      acc[status] = Number(acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const availableStatusTabs = LINE_STATUS_NAV.filter((item) => Number(statusCounts[item.status] || 0) > 0);
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 pb-3 font-medium transition ${
      isActive
        ? 'border-slate-950 text-slate-950'
        : 'border-transparent text-slate-400 hover:text-slate-700'
    }`;

  useEffect(() => {
    if (!selectedBatch?.id) return;
    if (batchImportStatus !== 'importing') return;
    if (importStepInFlight) return;

    const timeoutId = window.setTimeout(() => {
      importStepFetcher.submit(
        { batchId: String(selectedBatch.id) },
        { method: 'post', action: '/api/admin-stock-import-batch-import-step' },
      );
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [selectedBatch?.id, batchImportStatus, importStepInFlight, importStepFetcher]);

  useEffect(() => {
    if (importStepFetcher.state !== 'idle') return;
    if (!importStepFetcher.data) return;
    revalidator.revalidate();
  }, [importStepFetcher.state, importStepFetcher.data, revalidator]);

  if (!selectedBatch) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        {String((loaderData as any)?.message || 'Não foi possível carregar o lote.')}
      </div>
    );
  }

  const outletContext: AdminImportStockMovementsBatchOutletContext = {
    selected,
    selectedBatch,
    lines,
    items,
    appliedChanges,
    unitOptions,
    itemUnitOptionsByItemId,
    measurementConversions,
    suppliers,
    itemCostHints,
    summary,
    isImportingBatch,
  };

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={isImportingBatch}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="max-w-md rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle>Aplicando linhas conciliadas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <div className="space-y-1 text-sm text-slate-700">
                <div>Processando a importação deste lote linha por linha. Aguarde o término.</div>
                {displayedTotalCount > 0 ? (
                  <div className="text-slate-500">
                    {displayedProcessedCount} de {displayedTotalCount} linha(s) processadas • {displayedErrorCount} erro(s)
                  </div>
                ) : null}
              </div>
            </div>
            {displayedImportMessage ? <p className="text-sm text-slate-600">{displayedImportMessage}</p> : null}
            <p className="text-sm leading-6 text-slate-500">
              Não feche, atualize ou saia desta página enquanto a aplicação estiver em execução. Isso evita interromper a percepção do processo antes da conclusão.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {actionData?.message ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${actionData.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {actionData.message}
        </div>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-4">
            <Link
              to="/admin/import-stock-movements"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
            >
              <span className="text-slate-400">←</span>
              Voltar para lotes
            </Link>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[28px] font-semibold tracking-tight text-slate-950">{selectedBatch.name}</h2>
                <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', statusBadgeClass(String(selectedBatch.status)))}>
                  {selectedBatch.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-slate-600">{selectedBatch.id}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{selectedBatch.worksheetName || 'sem aba'}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {summary.pendingSupplier > 0 ? `${summary.pendingSupplier} pend. fornecedor` : 'fornecedor conciliado'}
                </span>
              </div>

              <div className="grid gap-x-8 gap-y-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Arquivo</div>
                  <div className="mt-1 text-slate-700">{selectedBatch.originalFileName || '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">JSON fornecedor</div>
                  <div className="mt-1 text-slate-700">{selectedBatch.supplierNotesFileName || 'não anexado'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Período</div>
                  <div className="mt-1 text-slate-700">{formatDate(selectedBatch.periodStart)} até {formatDate(selectedBatch.periodEnd)}</div>
                </div>
              </div>

              {selectedBatch.notes ? <div className="max-w-3xl text-sm text-slate-500">{selectedBatch.notes}</div> : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 xl:w-[420px] xl:items-stretch">
            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                to={`/admin/mobile/import-stock-movements/${selectedBatch.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Abrir mobile
              </Link>
              <Link
                to={`/admin/supplier-reconciliation?batchId=${selectedBatch.id}`}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
              >
                Conciliar fornecedor
              </Link>
            </div>

            <Form method="post">
              <input type="hidden" name="_action" value="batch-import" />
              <input type="hidden" name="batchId" value={selectedBatch.id} />
              <Button type="submit" className="h-11 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={summary.readyToImport <= 0 || isImportingBatch}>
                {isImportingBatch ? 'Importação em andamento...' : `Importar conciliadas (${summary.readyToImport})`}
              </Button>
            </Form>

            {summary.error > 0 ? (
              <Form method="post">
                <input type="hidden" name="_action" value="batch-retry-errors" />
                <input type="hidden" name="batchId" value={selectedBatch.id} />
                <Button type="submit" variant="outline" className="h-11 w-full rounded-xl" disabled={isImportingBatch}>
                  Retentar erros ({summary.error})
                </Button>
              </Form>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-3">
              <Form method="post">
                <input type="hidden" name="_action" value="batch-rollback" />
                <input type="hidden" name="batchId" value={selectedBatch.id} />
                <Button type="submit" variant="outline" className="h-11 w-full rounded-xl" disabled={appliedChanges.length <= 0 || isImportingBatch}>
                  Desfazer importação
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="_action" value="batch-archive" />
                <input type="hidden" name="batchId" value={selectedBatch.id} />
                <Button type="submit" variant="outline" className="h-11 w-full rounded-xl" disabled={isImportingBatch}>Arquivar</Button>
              </Form>
              <DeleteBatchButton
                batchId={String(selectedBatch.id)}
                batchName={String(selectedBatch.name || 'sem nome')}
                status={String(selectedBatch.status || '')}
              />
            </div>
          </div>
        </div>

        <Separator />

        {summary.pendingSupplier > 0 ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Este lote ainda tem {summary.pendingSupplier} registro(s) sem conciliação de fornecedor.
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-12">
          {[
            ['Total', summary.total],
            ['Prontas', summary.ready],
            ['Prontas p/ importar', summary.readyToImport],
            ['Importadas', summary.imported],
            ['Pend. vínculo', summary.pendingMapping],
            ['Pend. fornecedor', summary.pendingSupplier],
            ['Rev. custo', summary.pendingCostReview],
            ['Pend. conversão', summary.pendingConversion],
            ['Ignoradas', summary.ignored],
            ['Duplicadas', summary.skippedDuplicate],
            ['Inválidas', summary.invalid],
            ['Erros', summary.error],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-slate-50 px-3 py-2.5">
              <div className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-500">{label}</div>
              <div className="mt-0.5 text-[18px] font-semibold leading-none tracking-tight text-slate-950">{value as any}</div>
            </div>
          ))}
        </div>

        <Separator />
      </section>

      <section className="space-y-4">
        <nav className="overflow-x-auto border-b border-slate-100">
          <div className="flex min-w-max items-center gap-6 text-sm">
            <NavLink to="." end className={tabClass}>
              Todas ({lines.length})
            </NavLink>

            {availableStatusTabs.map((item) => (
              <NavLink key={item.status} to={`status/${item.status}`} className={tabClass}>
                {item.label} ({statusCounts[item.status] || 0})
              </NavLink>
            ))}

            <NavLink to="applied-changes" className={tabClass}>
              Alterações importadas ({appliedChanges.length})
            </NavLink>
          </div>
        </nav>

        <Outlet context={outletContext} />
      </section>
    </div>
  );
}
