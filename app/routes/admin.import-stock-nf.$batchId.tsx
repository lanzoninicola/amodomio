import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, Link, useActionData, useFetcher, useLoaderData } from '@remix-run/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { authenticator } from '~/domain/auth/google.server';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getAvailableItemUnits } from '~/domain/item/item-units.server';
import {
  applyStockNfImportBatch,
  archiveStockNfImportBatch,
  deleteStockNfImportBatch,
  getStockNfImportBatchView,
  mapBatchLinesToItem,
  rollbackStockNfImportBatch,
  setBatchLineManualConversion,
} from '~/domain/stock-nf-import/stock-nf-import.server';
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

function str(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function normalizeItemUnit(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
}

function num(value: FormDataEntryValue | null) {
  const n = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function formatDate(value: any) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatMoney(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function capitalizeWords(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    ready: Number(summary?.ready || 0),
    invalid: Number(summary?.invalid || 0),
    pendingMapping: Number(summary?.pendingMapping || 0),
    pendingSupplier: Number(summary?.pendingSupplier || 0),
    pendingConversion: Number(summary?.pendingConversion || 0),
    applied: Number(summary?.applied || 0),
    skippedDuplicate: Number(summary?.skippedDuplicate || 0),
    error: Number(summary?.error || 0),
  };
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'applied':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'pending_mapping':
    case 'pending_supplier':
    case 'pending_conversion':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'invalid':
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'skipped_duplicate':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function DeleteBatchButton({ batchId, batchName, status }: { batchId: string; batchName: string; status: string }) {
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

function ItemSystemMapperCell({
  line,
  items,
  batchId,
  unitOptions,
}: {
  line: any;
  items: any[];
  batchId: string;
  unitOptions: string[];
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
    ? `${selectedItem.name} [${selectedItem.classification || '-'}] (${selectedItem.purchaseUm || selectedItem.consumptionUm || '-'})`
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
      <mapItemFetcher.Form method="post" className="space-y-1">
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
                          { method: 'post' },
                        );
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', selectedItemId === item.id ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">
                          {item.name} [{item.classification || '-'}] ({item.purchaseUm || item.consumptionUm || '-'})
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
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="h-9 whitespace-nowrap text-xs">
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
        </div>
        <div>
          {selectedItemId ? (
            <Link
              to={`/admin/items/${selectedItemId}/main`}
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
        <div className="text-[11px] text-slate-500">{line.mappingSource || '-'}</div>
      </mapItemFetcher.Form>
    </div>
  );
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const batchId = String(params.batchId || '').trim();
    if (!batchId) return badRequest('Lote inválido');

    const [selected, unitOptions] = await Promise.all([
      getStockNfImportBatchView(batchId),
      getAvailableItemUnits(),
    ]);
    if (!selected) return badRequest('Lote não encontrado');

    return ok({ selected, batchId, unitOptions });
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

      return redirect(`/admin/import-stock-nf/${batchId}`);
    }

    if (_action === 'batch-set-manual-conversion') {
      const lineId = str(formData.get('lineId'));
      const factor = num(formData.get('factor'));
      if (!lineId) return badRequest('Linha inválida');
      if (!(factor > 0)) return badRequest('Informe um fator maior que zero');
      await setBatchLineManualConversion({ batchId, lineId, factor });
      return redirect(`/admin/import-stock-nf/${batchId}`);
    }

    if (_action === 'batch-create-and-map-item') {
      const lineId = str(formData.get('lineId'));
      const ingredientNameNormalized = str(formData.get('ingredientNameNormalized')) || null;
      const itemName = str(formData.get('itemName'));
      const classificationRaw = str(formData.get('classification')).toLowerCase();
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

      const created = await itemPrismaEntity.create({
        name: capitalizeWords(itemName),
        classification: classificationRaw,
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

    if (_action === 'batch-apply') {
      await applyStockNfImportBatch({ batchId, actor });
      return redirect(`/admin/import-stock-nf/${batchId}`);
    }

    if (_action === 'batch-rollback') {
      await rollbackStockNfImportBatch({ batchId, actor });
      return redirect(`/admin/import-stock-nf/${batchId}`);
    }

    if (_action === 'batch-archive') {
      await archiveStockNfImportBatch(batchId);
      return redirect('/admin/import-stock-nf');
    }

    if (_action === 'batch-delete') {
      await deleteStockNfImportBatch(batchId);
      return redirect('/admin/import-stock-nf');
    }

    return badRequest('Ação inválida');
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminImportStockNfBatchDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const payload = (loaderData as any)?.payload || {};
  const selected = payload.selected as any;
  const selectedBatch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const items = (selected?.items || []) as any[];
  const appliedChanges = (selected?.appliedChanges || []) as any[];
  const unitOptions = (((loaderData as any)?.payload?.unitOptions || []) as string[]);
  const summary = summaryFromAny(selected?.summary || selectedBatch?.summary);
  const [statusFilter, setStatusFilter] = useState('all');
  const availableStatuses = useMemo(
    () => Array.from(new Set(lines.map((line) => String(line.status || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lines],
  );
  const filteredLines = useMemo(() => {
    if (statusFilter === 'all') return lines;
    return lines.filter((line) => String(line.status || '') === statusFilter);
  }, [lines, statusFilter]);

  if (!selectedBatch) return null;

  return (
    <div className="flex flex-col gap-4">
      {actionData?.message ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${actionData.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {actionData.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Link to="/admin/import-stock-nf" className="text-sm font-medium text-slate-600 underline">
          Voltar para lotes
        </Link>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{selectedBatch.name}</h2>
            <Badge variant="outline" className={statusBadgeClass(String(selectedBatch.status))}>{selectedBatch.status}</Badge>
          </div>
          <div className="mt-1 text-sm text-slate-600">ID: {selectedBatch.id}</div>
          <div className="mt-1 text-sm text-slate-600">
            Arquivo: {selectedBatch.originalFileName || '-'} • Aba: {selectedBatch.worksheetName || '-'}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Período: {formatDate(selectedBatch.periodStart)} até {formatDate(selectedBatch.periodEnd)}
          </div>
          {selectedBatch.notes ? <div className="mt-1 text-sm text-slate-600">{selectedBatch.notes}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Form method="post">
            <input type="hidden" name="_action" value="batch-apply" />
            <input type="hidden" name="batchId" value={selectedBatch.id} />
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={summary.ready <= 0}>
              Aplicar prontas ({summary.ready})
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="_action" value="batch-rollback" />
            <input type="hidden" name="batchId" value={selectedBatch.id} />
            <Button type="submit" variant="outline" disabled={appliedChanges.length <= 0}>
              Rollback
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="_action" value="batch-archive" />
            <input type="hidden" name="batchId" value={selectedBatch.id} />
            <Button type="submit" variant="outline">Arquivar</Button>
          </Form>
          <DeleteBatchButton
            batchId={String(selectedBatch.id)}
            batchName={String(selectedBatch.name || 'sem nome')}
            status={String(selectedBatch.status || '')}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          ['Total', summary.total],
          ['Prontas', summary.ready],
          ['Aplicadas', summary.applied],
          ['Pend. vínculo', summary.pendingMapping],
          ['Pend. fornecedor', summary.pendingSupplier],
          ['Pend. conversão', summary.pendingConversion],
          ['Duplicadas', summary.skippedDuplicate],
          ['Inválidas', summary.invalid],
          ['Erros', summary.error],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-lg font-semibold text-slate-900">{value as any}</div>
          </div>
        ))}
      </div>

      <div className="bg-white">
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Linhas do lote</h3>
            <div className="text-xs text-slate-500">{filteredLines.length} de {lines.length} linha(s)</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
                <TableHead className="px-3 py-2 text-xs">Data/NF</TableHead>
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
                      <div className="text-slate-500">NF {line.invoiceNumber || '-'}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">{line.supplierName || '-'}</div>
                      <div className="text-slate-500">
                        {line.supplierCnpj || 'sem CNPJ'} {line.supplierId ? '• conciliado com cadastro' : line.supplierMatchSource ? '• pendente de conciliação' : '• sem fornecedor'}
                      </div>
                      {line.supplierMatchSource ? <div className="text-slate-400">{line.supplierMatchSource}</div> : null}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs">
                      <div className="font-medium text-slate-900">{line.ingredientName}</div>
                      <div className="text-slate-500">{line.motivo || '-'}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-700">
                      <div>{line.qtyEntry ?? '-'} {line.unitEntry || ''}</div>
                      <div className="text-slate-500">cons: {line.qtyConsumption ?? '-'} {line.unitConsumption || ''}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-700">
                      <div>{formatMoney(line.costAmount)} / {line.movementUnit || '-'}</div>
                      <div className="text-slate-500">total: {formatMoney(line.costTotalAmount)}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-700">
                      <ItemSystemMapperCell line={line} items={items} batchId={selectedBatch.id} unitOptions={unitOptions} />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-700">
                      {line.status === 'pending_conversion' ? (
                        <Form method="post" className="space-y-1">
                          <input type="hidden" name="_action" value="batch-set-manual-conversion" />
                          <input type="hidden" name="batchId" value={selectedBatch.id} />
                          <input type="hidden" name="lineId" value={line.id} />
                          <div className="flex items-center gap-2">
                            <Input name="factor" type="number" min="0" step="0.000001" placeholder="fator" className="h-8 w-24" />
                            <Button type="submit" variant="outline" className="h-8 px-2 text-[11px]">
                              Salvar
                            </Button>
                          </div>
                          <div className="text-[11px] text-slate-500">destino por 1 origem</div>
                        </Form>
                      ) : (
                        <>
                          <div>
                            {line.convertedCostAmount != null ? `${formatMoney(line.convertedCostAmount)} / ${line.targetUnit || '-'}` : '-'}
                          </div>
                          <div className="text-slate-500">
                            {line.conversionSource || '-'}{line.conversionFactorUsed ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}` : ''}
                          </div>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs">
                      <Badge variant="outline" className={statusBadgeClass(String(line.status))}>{line.status}</Badge>
                      {line.errorMessage ? <div className="mt-1 max-w-[220px] text-[11px] text-red-700">{line.errorMessage}</div> : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {appliedChanges.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Alterações aplicadas (snapshot para rollback)</h3>
          <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50/90">
                <TableRow className="hover:bg-slate-50/90">
                  <TableHead className="px-3 py-2 text-xs">Aplicado em</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Item</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Antes</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Depois</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Rollback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appliedChanges.map((c) => (
                  <TableRow key={c.id} className="border-slate-100">
                    <TableCell className="px-3 py-2 text-xs">{formatDate(c.appliedAt)}</TableCell>
                    <TableCell className="px-3 py-2 text-xs">{c.itemId}</TableCell>
                    <TableCell className="px-3 py-2 text-xs">{formatMoney(c.previousCostAmount)} / {c.previousCostUnit || '-'}</TableCell>
                    <TableCell className="px-3 py-2 text-xs">{formatMoney(c.newCostAmount)} / {c.newCostUnit || '-'}</TableCell>
                    <TableCell className="px-3 py-2 text-xs">
                      {c.rolledBackAt ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">revertido</Badge>
                      ) : c.rollbackStatus ? (
                        <Badge variant="outline" className={statusBadgeClass(c.rollbackStatus)}>{c.rollbackStatus}</Badge>
                      ) : (
                        <span className="text-slate-500">pendente</span>
                      )}
                      {c.rollbackMessage ? <div className="mt-1 text-[11px] text-red-700">{c.rollbackMessage}</div> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
