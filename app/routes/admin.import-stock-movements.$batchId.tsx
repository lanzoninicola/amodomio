import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, Link, useActionData, useFetcher, useLoaderData, useNavigation, useRevalidator } from '@remix-run/react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
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
import { PendingConversionForm } from '~/components/admin/import-stock-conversion-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { authenticator } from '~/domain/auth/google.server';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getAvailableItemUnits } from '~/domain/item/item-units.server';
import {
  archiveStockNfImportBatch,
  deleteStockNfImportBatch,
  getStockNfImportBatchView,
  mapBatchLinesToItem,
  reconcileStockNfImportBatchSuppliersFromFile,
  rollbackStockNfImportBatch,
  setBatchLineIgnored,
  setBatchLineManualConversion,
  startStockNfImportBatchApply,
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

const LINE_STATUS_GUIDE = [
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
    status: 'pending_conversion',
    meaning: 'Não foi encontrada conversão válida de unidade/custo.',
    impact: 'Bloqueia a importação até informar ou resolver a conversão.',
  },
  {
    status: 'skipped_duplicate',
    meaning: 'Linha detectada como duplicada no lote atual ou já aplicada antes.',
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
    status: 'applied',
    meaning: 'Linha já foi aplicada como movimentação de estoque.',
    impact: 'Já entrou na importação; não deve ser aplicada novamente.',
  },
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

function formatDocumentLabel(value: any) {
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
    readyToApply: Number(summary?.readyToApply || 0),
    invalid: Number(summary?.invalid || 0),
    pendingMapping: Number(summary?.pendingMapping || 0),
    pendingSupplier: Number(summary?.pendingSupplier || 0),
    pendingConversion: Number(summary?.pendingConversion || 0),
    applied: Number(summary?.applied || 0),
    ignored: Number(summary?.ignored || 0),
    skippedDuplicate: Number(summary?.skippedDuplicate || 0),
    error: Number(summary?.error || 0),
  };
}

function supplierReconciliationLabel(line: any) {
  if (line?.supplierReconciliationStatus === 'manual') return 'conciliado manualmente';
  if (line?.supplierReconciliationStatus === 'matched' || line?.supplierId) return 'conciliado com cadastro';
  if (line?.supplierReconciliationStatus === 'unmatched') return 'pendente de conciliação';
  return 'sem conciliação iniciada';
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
    case 'ignored':
      return 'border-slate-200 bg-slate-100 text-slate-600';
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

    const db = itemPrismaEntity.client as any;
    const [selected, unitOptions, categories] = await Promise.all([
      getStockNfImportBatchView(batchId),
      getAvailableItemUnits(),
      db.category.findMany({
        where: { type: 'item' },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }],
      }),
    ]);
    if (!selected) return badRequest('Lote não encontrado');

    return ok({ selected, batchId, unitOptions, categories });
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
    const currentBatch = await db.stockNfImportBatch.findUnique({
      where: { id: batchId },
      select: { id: true, applyStatus: true },
    });
    if (!currentBatch) return badRequest('Lote não encontrado');
    const isBatchApplying = String(currentBatch.applyStatus || 'idle') === 'applying';
    if (isBatchApplying && _action !== 'batch-apply') {
      return badRequest('Aguarde o término da aplicação em andamento antes de executar outra ação no lote.');
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

    if (_action === 'batch-apply') {
      await startStockNfImportBatchApply({ batchId, actor });
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
      await reconcileStockNfImportBatchSuppliersFromFile({
        batchId,
        fileName: supplierNotesFile.name,
        fileBuffer: Buffer.from(await supplierNotesFile.arrayBuffer()),
      });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-rollback') {
      await rollbackStockNfImportBatch({ batchId, actor });
      return redirect(redirectToCurrentPath(request, `/admin/import-stock-movements/${batchId}`));
    }

    if (_action === 'batch-archive') {
      await archiveStockNfImportBatch(batchId);
      return redirect('/admin/import-stock-movements');
    }

    if (_action === 'batch-delete') {
      await deleteStockNfImportBatch(batchId);
      return redirect('/admin/import-stock-movements');
    }

    return badRequest('Ação inválida');
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminImportStockMovementsBatchDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const applyStepFetcher = useFetcher<any>();
  const payload = (loaderData as any)?.payload || {};
  const selected = payload.selected as any;
  const selectedBatch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const items = (selected?.items || []) as any[];
  const appliedChanges = (selected?.appliedChanges || []) as any[];
  const unitOptions = (((loaderData as any)?.payload?.unitOptions || []) as string[]);
  const summary = summaryFromAny(selected?.summary || selectedBatch?.summary);
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
  const batchApplyStatus = String(selectedBatch?.applyStatus || 'idle');
  const batchApplyProcessedCount = Number(selectedBatch?.applyProcessedCount || 0);
  const batchApplyErrorCount = Number(selectedBatch?.applyErrorCount || 0);
  const batchApplyTotalCount = Number(selectedBatch?.applyTotalCount || 0);
  const batchApplyMessage = String(selectedBatch?.applyMessage || '').trim();
  const isApplyingBatch =
    batchApplyStatus === 'applying' ||
    (navigation.state === 'submitting' &&
      String(navigation.formData?.get('_action') || '') === 'batch-apply' &&
      String(navigation.formData?.get('batchId') || '') === String(selectedBatch?.id || ''));
  const applyStepInFlight = applyStepFetcher.state !== 'idle';
  const displayedProcessedCount = Number(applyStepFetcher.data?.payload?.progress?.processedCount ?? batchApplyProcessedCount);
  const displayedErrorCount = Number(applyStepFetcher.data?.payload?.progress?.errorCount ?? batchApplyErrorCount);
  const displayedTotalCount = Number(applyStepFetcher.data?.payload?.progress?.totalCount ?? batchApplyTotalCount);
  const displayedApplyMessage = String(applyStepFetcher.data?.payload?.progress?.message || batchApplyMessage || '').trim();

  useEffect(() => {
    if (!selectedBatch?.id) return;
    if (batchApplyStatus !== 'applying') return;
    if (applyStepInFlight) return;

    const timeoutId = window.setTimeout(() => {
      applyStepFetcher.submit(
        { batchId: String(selectedBatch.id) },
        { method: 'post', action: '/api/admin-stock-import-batch-apply-step' },
      );
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [selectedBatch?.id, batchApplyStatus, applyStepInFlight, applyStepFetcher]);

  useEffect(() => {
    if (applyStepFetcher.state !== 'idle') return;
    if (!applyStepFetcher.data) return;
    revalidator.revalidate();
  }, [applyStepFetcher.state, applyStepFetcher.data, revalidator]);

  if (!selectedBatch) return null;

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={isApplyingBatch}>
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
            {displayedApplyMessage ? <p className="text-sm text-slate-600">{displayedApplyMessage}</p> : null}
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
              <input type="hidden" name="_action" value="batch-apply" />
              <input type="hidden" name="batchId" value={selectedBatch.id} />
              <Button type="submit" className="h-11 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={summary.readyToApply <= 0 || isApplyingBatch}>
                {isApplyingBatch ? 'Aplicação em andamento...' : `Aplicar conciliadas (${summary.readyToApply})`}
              </Button>
            </Form>

            <div className="grid gap-2 sm:grid-cols-3">
              <Form method="post">
                <input type="hidden" name="_action" value="batch-rollback" />
                <input type="hidden" name="batchId" value={selectedBatch.id} />
                <Button type="submit" variant="outline" className="h-11 w-full rounded-xl" disabled={appliedChanges.length <= 0 || isApplyingBatch}>
                  Rollback
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="_action" value="batch-archive" />
                <input type="hidden" name="batchId" value={selectedBatch.id} />
                <Button type="submit" variant="outline" className="h-11 w-full rounded-xl" disabled={isApplyingBatch}>Arquivar</Button>
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

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-11">
        {[
          ['Total', summary.total],
          ['Prontas', summary.ready],
          ['Prontas p/ aplicar', summary.readyToApply],
          ['Aplicadas', summary.applied],
          ['Pend. vínculo', summary.pendingMapping],
          ['Pend. fornecedor', summary.pendingSupplier],
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
      </section>

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
                      <div>{line.qtyEntry ?? '-'} {line.unitEntry || ''}</div>
                      <div className="text-slate-500">cons: {line.qtyConsumption ?? '-'} {line.unitConsumption || ''}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-700">
                      <div>{formatMoney(line.costAmount)} / {line.movementUnit || '-'}</div>
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
                            {line.conversionSource || '-'}{line.conversionFactorUsed ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}` : ''}
                          </div>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs">
                      <Badge variant="outline" className={statusBadgeClass(String(line.status))}>{line.status}</Badge>
                      <Form method="post" className="mt-2">
                        <input type="hidden" name="_action" value={line.status === 'ignored' ? 'batch-unignore-line' : 'batch-ignore-line'} />
                        <input type="hidden" name="batchId" value={selectedBatch.id} />
                        <input type="hidden" name="lineId" value={line.id} />
                        <Button type="submit" variant="outline" className="h-7 px-2 text-[11px]">
                          {line.status === 'ignored' ? 'Reativar' : 'Ignorar'}
                        </Button>
                      </Form>
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
