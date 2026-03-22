import type { LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useLoaderData, useNavigation } from '@remix-run/react';
import { ArrowLeftRight, PlusCircle } from 'lucide-react';
import Container from '~/components/layout/container/container';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { listStockNfImportMovements } from '~/domain/stock-nf-import/stock-nf-import.server';
import { ok, serverError } from '~/utils/http-response.server';

const PAGE_SIZE = 50;

function str(value: string | null) {
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

function buildPageHref(filters: {
  q: string;
  supplier: string;
  item: string;
  from: string;
  to: string;
  status: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();
  if (filters.q) searchParams.set('q', filters.q);
  if (filters.supplier) searchParams.set('supplier', filters.supplier);
  if (filters.item) searchParams.set('item', filters.item);
  if (filters.from) searchParams.set('from', filters.from);
  if (filters.to) searchParams.set('to', filters.to);
  if (filters.status && filters.status !== 'active') searchParams.set('status', filters.status);
  if (filters.page > 1) searchParams.set('page', String(filters.page));
  return `/admin/stock-movements?${searchParams.toString()}`;
}

function movementStatusBadgeClass(rolledBackAt: unknown) {
  return rolledBackAt
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const q = str(url.searchParams.get('q'));
    const supplier = str(url.searchParams.get('supplier'));
    const item = str(url.searchParams.get('item'));
    const from = str(url.searchParams.get('from'));
    const to = str(url.searchParams.get('to'));
    const requestedStatus = str(url.searchParams.get('status'));
    const status = requestedStatus === 'all' || requestedStatus === 'rolled_back' ? requestedStatus : 'active';
    const page = parsePage(url.searchParams.get('page'));

    const result = await listStockNfImportMovements({
      q,
      supplier,
      item,
      from: parseYmdStart(from),
      to: parseYmdEnd(to),
      status: status as 'active' | 'rolled_back' | 'all',
      page,
      pageSize: PAGE_SIZE,
    });

    return ok({
      ...result,
      filters: {
        q,
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

export default function AdminStockMovementsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const payload = (loaderData as any)?.payload || {};
  const rows = (payload.rows || []) as any[];
  const summary = payload.summary || { total: 0, active: 0, rolledBack: 0, uniqueItems: 0, uniqueSuppliers: 0 };
  const pagination = payload.pagination || { page: 1, totalPages: 1, totalItems: 0 };
  const filters = payload.filters || { q: '', supplier: '', item: '', from: '', to: '', status: 'active' };
  const isFiltering = navigation.state !== 'idle' && navigation.location?.pathname === '/admin/stock-movements';

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
              Analise as entradas de estoque geradas pela importação de movimentações com filtro por período, fornecedor e produto.
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ['Movimentações', summary.total],
            ['Ativas', summary.active],
            ['Revertidas', summary.rolledBack],
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
                <option value="rolled_back">Somente revertidas</option>
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
                  <TableHead className="px-3 py-2 text-xs">Quantidade</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Custo</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Lote</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                      Nenhuma movimentação encontrada para os filtros informados.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="border-slate-100 align-top">
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-medium text-slate-900">{formatDate(row.movementAt)}</div>
                        <div className="text-slate-500">aplicado em {formatDate(row.appliedAt)}</div>
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
                      <TableCell className="px-3 py-3 text-xs text-slate-700">
                        <div>
                          entrada: {row.Line?.qtyEntry ?? '-'} {row.Line?.unitEntry || ''}
                        </div>
                        <div className="text-slate-500">
                          consumo: {row.Line?.qtyConsumption ?? '-'} {row.Line?.unitConsumption || ''}
                        </div>
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
                      <TableCell className="px-3 py-3 text-xs">
                        <Badge variant="outline" className={movementStatusBadgeClass(row.rolledBackAt)}>
                          {row.rolledBackAt ? 'revertida' : 'ativa'}
                        </Badge>
                        {row.rolledBackAt ? <div className="mt-1 text-slate-500">em {formatDate(row.rolledBackAt)}</div> : null}
                        {row.rollbackMessage ? <div className="mt-1 max-w-[240px] text-red-700">{row.rollbackMessage}</div> : null}
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
