import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useFetcher, useLoaderData, useNavigation, useRevalidator, useSearchParams } from '@remix-run/react';
import { ArrowLeftRight, Eye, PlusCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DecimalInput } from '~/components/inputs/inputs';
import Container from '~/components/layout/container/container';
import { MoneyInput } from '~/components/money-input/MoneyInput';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { Textarea } from '~/components/ui/textarea';
import { authenticator } from '~/domain/auth/google.server';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getAvailableItemUnits } from '~/domain/item/item-units.server';
import {
  listStockMovementImportMovements,
  rollbackStockMovementImportBatchLine,
  updateStockMovementImportBatchLineEditableFields,
} from '~/domain/stock-movement/stock-movement-import.server';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

const PAGE_SIZE = 50;

function str(value: FormDataEntryValue | string | null) {
  return String(value || '').trim();
}

function parsePage(value: string | null) {
  const parsed = Number(value || '1');
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function parseYmdStart(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseYmdEnd(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function parseDateTimeLocal(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = str(value).replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDate(value: unknown) {
  if (!value) return '-';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatDateTimeLocalValue(value: unknown) {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function formatDecimal(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function buildPageHref(filters: {
  q: string;
  movementId: string;
  lineId: string;
  supplier: string;
  item: string;
  from: string;
  to: string;
  status: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();
  if (filters.q) searchParams.set('q', filters.q);
  if (filters.movementId) searchParams.set('movementId', filters.movementId);
  if (filters.lineId) searchParams.set('lineId', filters.lineId);
  if (filters.supplier) searchParams.set('supplier', filters.supplier);
  if (filters.item) searchParams.set('item', filters.item);
  if (filters.from) searchParams.set('from', filters.from);
  if (filters.to) searchParams.set('to', filters.to);
  if (filters.status && filters.status !== 'active') searchParams.set('status', filters.status);
  if (filters.page > 1) searchParams.set('page', String(filters.page));
  return `/admin/stock-movements?${searchParams.toString()}`;
}

function movementLifecycleBadgeClass(deletedAt: unknown) {
  return deletedAt
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function movementDirectionBadgeClass(direction: unknown) {
  return String(direction || 'entry') === 'exit'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-sky-200 bg-sky-50 text-sky-700';
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const q = str(url.searchParams.get('q'));
    const movementId = str(url.searchParams.get('movementId'));
    const lineId = str(url.searchParams.get('lineId'));
    const supplier = str(url.searchParams.get('supplier'));
    const item = str(url.searchParams.get('item'));
    const from = str(url.searchParams.get('from'));
    const to = str(url.searchParams.get('to'));
    const requestedStatus = str(url.searchParams.get('status'));
    const status = requestedStatus === 'all' || requestedStatus === 'deleted' ? requestedStatus : 'active';
    const page = parsePage(url.searchParams.get('page'));

    const db = itemPrismaEntity.client as any;
    const [result, items, suppliers, unitOptions] = await Promise.all([
      listStockMovementImportMovements({
        q,
        movementId,
        lineId,
        supplier,
        item,
        from: parseYmdStart(from),
        to: parseYmdEnd(to),
        status: status as 'active' | 'deleted' | 'all',
        page,
        pageSize: PAGE_SIZE,
      }),
      db.item.findMany({
        where: { active: true },
        select: { id: true, name: true, classification: true, purchaseUm: true, consumptionUm: true },
        orderBy: [{ name: 'asc' }],
        take: 2000,
      }),
      typeof db.supplier?.findMany === 'function'
        ? db.supplier.findMany({
          select: { id: true, name: true, cnpj: true },
          orderBy: [{ name: 'asc' }],
          take: 2000,
        })
        : [],
      getAvailableItemUnits(),
    ]);

    return ok({
      ...result,
      items,
      suppliers,
      unitOptions,
      filters: {
        q,
        movementId,
        lineId,
        supplier,
        item,
        from,
        to,
        status,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    if (!user) return badRequest('Não autenticado');

    const formData = await request.formData();
    const _action = str(formData.get('_action'));
    let batchId = str(formData.get('batchId'));
    let lineId = str(formData.get('lineId'));
    const movementId = str(formData.get('movementId'));
    const actor = String((user as any)?.email || (user as any)?.name || 'admin');
    if ((!batchId || !lineId) && movementId) {
      const db = itemPrismaEntity.client as any;
      const movement = await db.stockMovement.findUnique({
        where: { id: movementId },
        select: {
          id: true,
          importBatchId: true,
          importLineId: true,
        },
      });
      if (!movement) return badRequest('Movimentação inválida');
      batchId = str(movement.importBatchId);
      lineId = str(movement.importLineId);
    }
    if (!batchId || !lineId) return badRequest('Movimentação inválida');

    if (_action === 'movement-rollback-line') {
      await rollbackStockMovementImportBatchLine({
        batchId,
        lineId,
        actor,
      });
      return ok({
        rolledBackMovementId: movementId || null,
        message: 'Importação desfeita. O movimento vinculado foi eliminado e a linha de origem já pode ser editada.',
      });
    }

    if (_action !== 'movement-edit-line') return badRequest('Ação inválida');

    const ingredientName = str(formData.get('ingredientName'));
    if (!ingredientName) return badRequest('Ingrediente é obrigatório');

    const costAmount = optionalNumber(formData.get('costAmount'));
    if (Number.isNaN(costAmount)) return badRequest('Custo unitário inválido');
    const costTotalAmount = optionalNumber(formData.get('costTotalAmount'));
    if (Number.isNaN(costTotalAmount)) return badRequest('Custo total inválido');
    const qtyEntry = optionalNumber(formData.get('qtyEntry'));
    if (Number.isNaN(qtyEntry)) return badRequest('Quantidade de entrada inválida');
    const qtyConsumption = optionalNumber(formData.get('qtyConsumption'));
    if (Number.isNaN(qtyConsumption)) return badRequest('Quantidade de consumo inválida');
    const manualConversionFactor = optionalNumber(formData.get('manualConversionFactor'));
    if (Number.isNaN(manualConversionFactor)) return badRequest('Fator manual inválido');

    const movementAtRaw = str(formData.get('movementAt'));
    const movementAt = movementAtRaw ? parseDateTimeLocal(movementAtRaw) : null;
    if (movementAtRaw && !movementAt) return badRequest('Data da movimentação inválida');

    await updateStockMovementImportBatchLineEditableFields({
      batchId,
      lineId,
      actor,
      movementAt,
      ingredientName,
      motivo: str(formData.get('motivo')) || null,
      identification: str(formData.get('identification')) || null,
      invoiceNumber: str(formData.get('invoiceNumber')) || null,
      supplierId: str(formData.get('supplierId')) || null,
      supplierName: str(formData.get('supplierName')) || null,
      supplierCnpj: str(formData.get('supplierCnpj')) || null,
      qtyEntry,
      unitEntry: str(formData.get('unitEntry')) || null,
      qtyConsumption,
      unitConsumption: str(formData.get('unitConsumption')) || null,
      movementUnit: str(formData.get('movementUnit')) || null,
      costAmount,
      costTotalAmount,
      observation: str(formData.get('observation')) || null,
      mappedItemId: str(formData.get('mappedItemId')) || null,
      manualConversionFactor,
    });

    return ok({ updatedLineId: lineId });
  } catch (error) {
    return serverError(error);
  }
}

function MovementEditDialog({
  row,
  items,
  suppliers,
  unitOptions,
  open,
  onOpenChange,
  onSaved,
}: {
  row: any;
  items: any[];
  suppliers: any[];
  unitOptions: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== 'idle';
  const line = row?.Line || null;
  const updatedLineId = (fetcher.data as any)?.payload?.updatedLineId;
  const isActiveMovement = Boolean(!row?.deletedAt);
  const canEdit = true;
  const supplierOptions = useMemo(() => suppliers || [], [suppliers]);
  const itemOptions = useMemo(() => items || [], [items]);
  const movementUnitInitial = String(line?.movementUnit || line?.unitEntry || line?.unitConsumption || row?.movementUnit || '').trim().toUpperCase();
  const [qtyEntryDraft, setQtyEntryDraft] = useState<number>(Number(line?.qtyEntry ?? 0));
  const [movementUnitDraft, setMovementUnitDraft] = useState(movementUnitInitial || '');
  const [costAmountDraft, setCostAmountDraft] = useState<number>(Number(line?.costAmount ?? 0));
  const [supplierIdDraft, setSupplierIdDraft] = useState(String(line?.supplierId || row?.supplierId || ''));
  const [mappedItemIdDraft, setMappedItemIdDraft] = useState(String(line?.mappedItemId || row?.itemId || ''));

  useEffect(() => {
    if (fetcher.state !== 'idle') return;
    if ((fetcher.data as any)?.status !== 200) return;
    if (updatedLineId !== row?.lineId) return;
    onSaved();
    onOpenChange(false);
  }, [fetcher.state, fetcher.data, onOpenChange, onSaved, row?.lineId, updatedLineId]);

  if (!row || !line) return null;

  const selectedSupplier = supplierOptions.find((supplier) => supplier.id === supplierIdDraft) || null;
  const supplierNameHiddenValue = selectedSupplier?.name || row.supplierName || line.supplierName || '';
  const supplierCnpjHiddenValue = selectedSupplier?.cnpj || row.supplierCnpj || line.supplierCnpj || '';
  const computedCostTotal =
    Number.isFinite(qtyEntryDraft) && Number.isFinite(costAmountDraft)
      ? qtyEntryDraft * costAmountDraft
      : NaN;

  const importSnapshot = {
    qtyEntry: line.qtyEntry,
    unitEntry: line.unitEntry,
    qtyConsumption: line.qtyConsumption,
    unitConsumption: line.unitConsumption,
    movementUnit: line.movementUnit,
    costAmount: line.costAmount,
    costTotalAmount: line.costTotalAmount,
    convertedCostAmount: line.convertedCostAmount,
    targetUnit: line.targetUnit,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar movimentação de estoque</DialogTitle>
        </DialogHeader>

        {isActiveMovement ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            A correção será aplicada sobre a movimentação ativa e registrada como ajuste auditável. A origem da importação permanece vinculada para rastreabilidade.
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Esta movimentação foi eliminada a partir da origem de importação. A edição atua apenas na linha de origem para preservar a rastreabilidade.
          </div>
        )}

        {(fetcher.data as any)?.message ? (
          <div className={`rounded-lg border px-3 py-2 text-sm ${(fetcher.data as any)?.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {(fetcher.data as any).message}
          </div>
        ) : null}

        <fetcher.Form method="post" className="space-y-5">
          <input type="hidden" name="movementId" value={row.id} />
          <input type="hidden" name="batchId" value={row.batchId} />
          <input type="hidden" name="lineId" value={row.lineId} />
          <input type="hidden" name="supplierId" value={supplierIdDraft} />
          <input type="hidden" name="supplierName" value={supplierNameHiddenValue} />
          <input type="hidden" name="supplierCnpj" value={supplierCnpjHiddenValue} />
          <input type="hidden" name="mappedItemId" value={mappedItemIdDraft} />
          <input type="hidden" name="unitEntry" value={movementUnitDraft} />
          <input type="hidden" name="qtyConsumption" value={qtyEntryDraft.toFixed(4)} />
          <input type="hidden" name="unitConsumption" value={movementUnitDraft} />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="movementAt">Data da movimentação</Label>
              <Input id="movementAt" name="movementAt" type="datetime-local" defaultValue={formatDateTimeLocalValue(line.movementAt || row.movementAt)} disabled={!canEdit || isSubmitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceNumber">Documento</Label>
              <Input id="invoiceNumber" name="invoiceNumber" defaultValue={line.invoiceNumber || row.invoiceNumber || ''} disabled={!canEdit || isSubmitting} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="ingredientName">Ingrediente/origem</Label>
              <Input id="ingredientName" name="ingredientName" defaultValue={line.ingredientName || ''} required disabled={!canEdit || isSubmitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo</Label>
              <Input id="motivo" name="motivo" defaultValue={line.motivo || ''} disabled={!canEdit || isSubmitting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="identification">Identificação</Label>
              <Input id="identification" name="identification" defaultValue={line.identification || ''} disabled={!canEdit || isSubmitting} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Origem importada</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Quantidade</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {formatNumber(importSnapshot.qtyEntry)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">UM do movimento</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {importSnapshot.movementUnit || '-'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo unitário</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {formatMoney(importSnapshot.costAmount)} / {importSnapshot.movementUnit || '-'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo total</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {formatMoney(
                    Number.isFinite(Number(importSnapshot.costTotalAmount))
                      ? importSnapshot.costTotalAmount
                      : Number(importSnapshot.qtyEntry ?? 0) * Number(importSnapshot.costAmount ?? 0),
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo convertido</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {formatMoney(importSnapshot.convertedCostAmount)} / {importSnapshot.targetUnit || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-6">
            <div className="space-y-1.5 md:col-span-4">
              <Label>Fornecedor informado</Label>
              <Select
                value={supplierIdDraft || '__EMPTY__'}
                onValueChange={(value) => setSupplierIdDraft(value === '__EMPTY__' ? '' : value)}
                disabled={!canEdit || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem vínculo</SelectItem>
                  {supplierOptions.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} {supplier.cnpj ? `• ${supplier.cnpj}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Item do sistema</Label>
              <Select
                value={mappedItemIdDraft || '__EMPTY__'}
                onValueChange={(value) => setMappedItemIdDraft(value === '__EMPTY__' ? '' : value)}
                disabled={!canEdit || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem item mapeado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem item mapeado</SelectItem>
                  {itemOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} [{item.classification || '-'}] ({item.purchaseUm || item.consumptionUm || '-'})
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
                disabled={!canEdit || isSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label>UM do movimento</Label>
              <Select
                name="movementUnit"
                value={movementUnitDraft || '__EMPTY__'}
                onValueChange={(value) => setMovementUnitDraft(value === '__EMPTY__' ? '' : value)}
                disabled={!canEdit || isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem unidade</SelectItem>
                  {unitOptions.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costAmount">Custo unitário</Label>
              <MoneyInput
                id="costAmount"
                name="costAmount"
                defaultValue={costAmountDraft}
                className="h-10 w-full"
                onValueChange={setCostAmountDraft}
                disabled={!canEdit || isSubmitting}
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
                disabled={!canEdit || isSubmitting}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="manualConversionFactor">Fator manual</Label>
              <Input id="manualConversionFactor" name="manualConversionFactor" defaultValue={line.manualConversionFactor ?? ''} disabled={!canEdit || isSubmitting} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="observation">Observação</Label>
              <Textarea id="observation" name="observation" defaultValue={line.observation || ''} disabled={!canEdit || isSubmitting} className="min-h-[96px]" />
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div>
                <span className="font-medium text-slate-900">Status atual:</span> {line.status || '-'}
              </div>
              <div>
                <span className="font-medium text-slate-900">Conversão:</span> {line.conversionSource || '-'}
                {line.conversionFactorUsed ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}` : ''}
              </div>
              <div>
                <span className="font-medium text-slate-900">Custo convertido:</span> {formatMoney(line.convertedCostAmount)} / {line.targetUnit || '-'}
              </div>
              <div>
                <span className="font-medium text-slate-900">Lote:</span>{' '}
                <Link to={`/admin/import-stock-movements/${row.batchId}`} className="underline underline-offset-2">
                  {row.Batch?.name || row.batchId}
                </Link>
              </div>
              {line.errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {line.errorMessage}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Fechar
            </Button>
            {canEdit ? (
              <Button type="submit" name="_action" value="movement-edit-line" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            ) : null}
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminStockMovementsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const payload = (loaderData as any)?.payload || {};
  const rows = (payload.rows || []) as any[];
  const items = (payload.items || []) as any[];
  const suppliers = (payload.suppliers || []) as any[];
  const unitOptions = (payload.unitOptions || []) as string[];
  const summary = payload.summary || { total: 0, active: 0, deleted: 0, uniqueItems: 0, uniqueSuppliers: 0 };
  const pagination = payload.pagination || { page: 1, totalPages: 1, totalItems: 0 };
  const filters = payload.filters || { q: '', movementId: '', lineId: '', supplier: '', item: '', from: '', to: '', status: 'active' };
  const isFiltering = navigation.state !== 'idle' && navigation.location?.pathname === '/admin/stock-movements';
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  useEffect(() => {
    const shouldOpenEdit = searchParams.get('openEdit') === '1';
    if (!shouldOpenEdit) return;
    if (rows.length !== 1) return;
    if (selectedRow?.id === rows[0]?.id) return;
    setSelectedRow(rows[0]);
  }, [rows, searchParams, selectedRow]);

  return (
    <Container fullWidth className="mt-12 px-4">
      <div className="flex flex-col gap-6">
        <MovementEditDialog
          key={selectedRow?.id || 'movement-edit-dialog'}
          row={selectedRow}
          items={items}
          suppliers={suppliers}
          unitOptions={unitOptions}
          open={Boolean(selectedRow)}
          onSaved={() => revalidator.revalidate()}
          onOpenChange={(open) => {
            if (!open) setSelectedRow(null);
          }}
        />

        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ArrowLeftRight size={12} />
                </span>
                estoque
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">movimentações</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin/import-stock-movements"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Importação de movimentações
              </Link>
              <Link
                to="/admin/import-stock-movements/new"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <PlusCircle size={15} />
                Nova importação
              </Link>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Movimentações de estoque</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Analise entradas e saídas de estoque a partir da entidade principal de movimentação. A importação é apenas uma das origens possíveis.
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ['Movimentações', summary.total],
            ['Ativas', summary.active],
            ['Eliminadas', summary.deleted],
            ['Itens', summary.uniqueItems],
            ['Fornecedores', summary.uniqueSuppliers],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className="text-2xl font-semibold text-slate-950">{value as any}</div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <Form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Busca geral</label>
              <Input name="q" defaultValue={filters.q} placeholder="documento, lote, fornecedor ou ingrediente" className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Movimentação ID</label>
              <Input name="movementId" defaultValue={filters.movementId} placeholder="ID exato da movimentação" className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Fornecedor</label>
              <Input name="supplier" defaultValue={filters.supplier} placeholder="Nome do fornecedor" className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Produto</label>
              <Input name="item" defaultValue={filters.item} placeholder="Item ou ingrediente" className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">De</label>
              <Input name="from" type="date" defaultValue={filters.from} className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Até</label>
              <Input name="to" type="date" defaultValue={filters.to} className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
              <select
                name="status"
                defaultValue={filters.status}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="active">Somente ativas</option>
                <option value="deleted">Somente eliminadas</option>
                <option value="all">Todas</option>
              </select>
            </div>
            <div className="flex items-end gap-2 xl:col-span-6">
              <Button type="submit" disabled={isFiltering}>
                {isFiltering ? 'Filtrando...' : 'Aplicar filtros'}
              </Button>
              <Link
                to="/admin/stock-movements"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpar
              </Link>
            </div>
          </Form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="overflow-auto rounded-xl">
            <Table className="min-w-[1320px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-slate-50/80">
                  <TableHead className="px-3 py-2 text-xs">Movimentação</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Fornecedor / NF</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Produto</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Direção</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Quantidade</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Custo</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Lote</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-3 py-10 text-center text-sm text-slate-500">
                      Nenhuma movimentação encontrada para os filtros informados.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="border-slate-100 align-top">
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">{formatDate(row.movementAt)}</div>
                        <div className="text-slate-500">importado em {formatDate(row.appliedAt)}</div>
                        <div className="text-slate-400">mov. {row.id}</div>
                        <div className="text-slate-400">linha {row.Line?.rowNumber ?? '-'}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">{row.supplierName || 'Sem fornecedor'}</div>
                        <div className="text-slate-500">Doc. {row.invoiceNumber || '-'}</div>
                        <div className="text-slate-400">{row.supplierCnpj || 'sem CNPJ'}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">{row.Item?.name || 'Item removido'}</div>
                        <div className="text-slate-500">origem: {row.Line?.ingredientName || '-'}</div>
                        <div className="text-slate-400">{row.Item?.classification || '-'}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs">
                        <Badge variant="outline" className={movementDirectionBadgeClass(row.direction)}>
                          {row.direction === 'exit' ? 'saída' : 'entrada'}
                        </Badge>
                        <div className="mt-1 text-slate-500">{row.movementType || 'manual'}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">
                          {formatDecimal(row.quantityAmount ?? row.Line?.qtyEntry ?? row.Line?.qtyConsumption)} {row.quantityUnit || row.Line?.unitEntry || row.Line?.unitConsumption || ''}
                        </div>
                        {row.Line ? (
                          <div className="text-slate-500">
                            origem: {formatDecimal(row.Line?.qtyEntry ?? row.Line?.qtyConsumption)} {row.Line?.unitEntry || row.Line?.unitConsumption || ''}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">
                          {formatMoney(row.newCostAmount)} / {row.newCostUnit || row.movementUnit || '-'}
                        </div>
                        <div className="text-slate-500">
                          total NF: {formatMoney(row.Line?.costTotalAmount)}
                        </div>
                        <div className="text-slate-400">
                          antes: {formatMoney(row.previousCostAmount)} / {row.previousCostUnit || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <Link to={`/admin/import-stock-movements/${row.batchId}`} className="font-medium text-slate-900 hover:underline">
                          {row.Batch?.name || row.batchId}
                        </Link>
                        <div className="text-slate-500">item ID: {row.itemId}</div>
                      </TableCell>

                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <Button type="button" variant="outline" className="h-8 px-3 text-[11px]" onClick={() => setSelectedRow(row)}>
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div>
              Página {pagination.page} de {pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={buildPageHref({ ...filters, page: Math.max(1, pagination.page - 1) })}
                className={`inline-flex h-9 items-center justify-center rounded-md border px-3 ${pagination.page <= 1 ? 'pointer-events-none border-slate-100 text-slate-300' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                Anterior
              </Link>
              <Link
                to={buildPageHref({ ...filters, page: Math.min(pagination.totalPages, pagination.page + 1) })}
                className={`inline-flex h-9 items-center justify-center rounded-md border px-3 ${pagination.page >= pagination.totalPages ? 'pointer-events-none border-slate-100 text-slate-300' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                Próxima
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Container>
  );
}
