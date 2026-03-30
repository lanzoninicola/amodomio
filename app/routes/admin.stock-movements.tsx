import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from '@remix-run/react';
import { ArrowLeftRight, Eye, PlusCircle } from 'lucide-react';
import { getItemBaseUnit } from '~/components/admin/stock-movement-editor';
import Container from '~/components/layout/container/container';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { authenticator } from '~/domain/auth/google.server';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getAvailableItemUnits } from '~/domain/item/item-units.server';
import {
  getStockMovementDirectionLabel,
  getStockMovementTypeLabel,
  normalizeStockMovementDirection,
} from '~/domain/stock-movement/stock-movement-types';
import {
  importStockMovementImportBatchLine,
  listStockMovementImportMovements,
  rollbackStockMovementImportBatchLine,
  setBatchLineIgnored,
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

function rollbackFailureMessage(result: { deleted?: number; conflicts?: number; errors?: number }) {
  if (Number(result?.deleted || 0) > 0) return null;
  if (Number(result?.conflicts || 0) > 0) {
    return 'Não foi possível reverter esta movimentação porque o custo atual do item já não aponta mais para esta importação.';
  }
  if (Number(result?.errors || 0) > 0) {
    return 'Não foi possível concluir a reversão desta movimentação.';
  }
  return 'A reversão desta movimentação não produziu alterações.';
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
  const normalized = normalizeStockMovementDirection(direction);
  if (normalized === 'exit') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'neutral') return 'border-violet-200 bg-violet-50 text-violet-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
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
      const result = await rollbackStockMovementImportBatchLine({
        batchId,
        lineId,
        actor,
      });
      const rollbackError = rollbackFailureMessage(result);
      if (rollbackError) return badRequest(rollbackError);
      return ok({
        rolledBackMovementId: movementId || null,
        message: 'Movimentação revertida. A linha de origem já pode ser remapeada e editada novamente.',
      });
    }

    if (_action === 'movement-rollback-and-ignore-line') {
      const result = await rollbackStockMovementImportBatchLine({
        batchId,
        lineId,
        actor,
        allowDeleteWithoutCostRollback: true,
      });
      const rollbackError = rollbackFailureMessage(result);
      if (rollbackError) return badRequest(rollbackError);
      await setBatchLineIgnored({
        batchId,
        lineId,
        ignored: true,
      });
      return ok({
        rolledBackMovementId: movementId || null,
        ignoredLineId: lineId,
        message:
          Number((result as any)?.deletedWithoutCostRollback || 0) > 0
            ? 'Movimentação removida do fluxo e linha ignorada. O custo atual do item foi preservado porque já havia alterações posteriores.'
            : 'Movimentação revertida e linha ignorada. Ela saiu do fluxo de importação deste lote.',
      });
    }

    if (_action !== 'movement-edit-line') return badRequest('Ação inválida');

    const ingredientName = str(formData.get('ingredientName'));
    if (!ingredientName) return badRequest('Ingrediente é obrigatório');

    const costTotalAmount = optionalNumber(formData.get('costTotalAmount'));
    if (Number.isNaN(costTotalAmount)) return badRequest('Custo total inválido');
    const qtyEntry = optionalNumber(formData.get('qtyEntry'));
    if (Number.isNaN(qtyEntry)) return badRequest('Quantidade de entrada inválida');
    const qtyConsumption = optionalNumber(formData.get('qtyConsumption'));
    if (Number.isNaN(qtyConsumption)) return badRequest('Quantidade de consumo inválida');
    const rawCostAmount = optionalNumber(formData.get('costAmount'));
    if (Number.isNaN(rawCostAmount)) return badRequest('Custo unitário inválido');
    const costAmount =
      Number.isFinite(Number(costTotalAmount)) && Number.isFinite(Number(qtyEntry)) && Number(qtyEntry) > 0
        ? Number(costTotalAmount) / Number(qtyEntry)
        : rawCostAmount;
    if (costAmount != null && (!Number.isFinite(costAmount) || costAmount <= 0)) {
      return badRequest('Não foi possível calcular o custo unitário');
    }
    const manualConversionFactor = optionalNumber(formData.get('manualConversionFactor'));
    if (Number.isNaN(manualConversionFactor)) return badRequest('Fator manual inválido');

    const movementAtRaw = str(formData.get('movementAt'));
    const movementAt = movementAtRaw ? parseDateTimeLocal(movementAtRaw) : null;
    if (movementAtRaw && !movementAt) return badRequest('Data da movimentação inválida');

    const db = itemPrismaEntity.client as any;
    const previousLine = await db.stockMovementImportBatchLine.findUnique({
      where: { id: lineId },
      select: { appliedAt: true, rolledBackAt: true },
    });

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

    let importedLine = false;
    if (previousLine?.rolledBackAt || !previousLine?.appliedAt) {
      const importResult = await importStockMovementImportBatchLine({
        batchId,
        lineId,
        actor,
      });
      importedLine = importResult.imported > 0;
    }

    return ok({
      updatedLineId: lineId,
      importedLine,
      message: importedLine
        ? 'Linha atualizada e reaplicada no estoque. O histórico do item já foi atualizado.'
        : undefined,
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminStockMovementsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const payload = (loaderData as any)?.payload || {};
  const rows = (payload.rows || []) as any[];
  const summary = payload.summary || { total: 0, active: 0, deleted: 0, uniqueItems: 0, uniqueSuppliers: 0 };
  const pagination = payload.pagination || { page: 1, totalPages: 1, totalItems: 0 };
  const filters = payload.filters || { q: '', movementId: '', lineId: '', supplier: '', item: '', from: '', to: '', status: 'active' };
  const isFiltering = navigation.state !== 'idle' && navigation.location?.pathname === '/admin/stock-movements';
  const currentPath = `/admin/stock-movements${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  return (
    <Container fullWidth className="mt-12 px-4">
      <div className="flex flex-col gap-6">
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
                        {row.itemId && row.Item?.name ? (
                          <Link to={`/admin/items/${row.itemId}`} className="font-medium text-slate-900 hover:underline">
                            {row.Item.name}
                          </Link>
                        ) : (
                          <div className="font-medium text-slate-900">{row.Item?.name || 'Item removido'}</div>
                        )}
                        <div className="text-slate-500">origem: {row.Line?.ingredientName || '-'}</div>
                        <div className="text-slate-400">{row.Item?.classification || '-'}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-xs">
                        <Badge variant="outline" className={movementDirectionBadgeClass(row.direction)}>
                          {getStockMovementDirectionLabel(row.direction)}
                        </Badge>
                        <div className="mt-1 text-slate-500">{getStockMovementTypeLabel(row.movementType || 'manual')}</div>
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
                        {row.batchId ? (
                          <Link to={`/admin/import-stock-movements/${row.batchId}`} className="font-medium text-slate-900 hover:underline">
                            {row.Batch?.name || row.batchId}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-500">sem lote</span>
                        )}
                        <div className="text-slate-500">item ID: {row.itemId}</div>
                      </TableCell>

                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        {row.lineId ? (
                          <Link
                            to={`/admin/stock-movements/${row.id}?returnTo=${encodeURIComponent(currentPath)}`}
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Eye size={16} />
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
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
