import type { LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useLoaderData } from '@remix-run/react';
import { Filter, Search } from 'lucide-react';
import {
  getItemCostHistoryVariationPercent,
  ItemCostHistoryTable,
} from '~/components/admin/item-cost-history-table';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { listItemCostHistoryTimeline } from '~/domain/item/item-cost-monitoring.server';
import prismaClient from '~/lib/prisma/client.server';
import { cn } from '~/lib/utils';
import { ok, serverError } from '~/utils/http-response.server';

const PAGE_SIZE = 50;

const VARIATION_RANGE_OPTIONS = [
  { value: 'all', label: 'Todas as variações' },
  { value: 'drop_strong', label: 'até -10%: queda forte' },
  { value: 'drop_moderate', label: '-10% a -3%: queda moderada' },
  { value: 'stable', label: '-3% a +3%: estável' },
  { value: 'rise_moderate', label: '+3% a +10%: alta moderada' },
  { value: 'rise_strong', label: 'acima de +10%: alta forte' },
] as const;

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Todas as origens' },
  { value: 'import', label: 'Importação' },
  { value: 'manual', label: 'Manual' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'item-cost-sheet', label: 'Ficha de custo' },
] as const;

const SORT_OPTIONS = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'variation_desc', label: 'Maior alta (%)' },
  { value: 'variation_asc', label: 'Maior queda (%)' },
] as const;

type VariationRange = (typeof VARIATION_RANGE_OPTIONS)[number]['value'];
type SourceOption = (typeof SOURCE_OPTIONS)[number]['value'];
type SortOption = (typeof SORT_OPTIONS)[number]['value'];

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

function parseVariationRange(value: string | null): VariationRange {
  const normalized = str(value);
  return VARIATION_RANGE_OPTIONS.some((option) => option.value === normalized) ? (normalized as VariationRange) : 'all';
}

function parseSourceOption(value: string | null): SourceOption {
  const normalized = str(value);
  return SOURCE_OPTIONS.some((option) => option.value === normalized) ? (normalized as SourceOption) : 'all';
}

function parseSortOption(value: string | null): SortOption {
  const normalized = str(value);
  return SORT_OPTIONS.some((option) => option.value === normalized) ? (normalized as SortOption) : 'recent';
}

function matchesVariationRange(variationPercent: number | null, range: VariationRange) {
  if (range === 'all') return true;
  if (variationPercent == null || !Number.isFinite(variationPercent)) return false;
  if (range === 'drop_strong') return variationPercent <= -10;
  if (range === 'drop_moderate') return variationPercent > -10 && variationPercent < -3;
  if (range === 'stable') return variationPercent >= -3 && variationPercent <= 3;
  if (range === 'rise_moderate') return variationPercent > 3 && variationPercent <= 10;
  return variationPercent > 10;
}

function matchesSource(row: any, source: SourceOption) {
  if (source === 'all') return true;
  return String(row?.source || '').trim().toLowerCase() === source;
}

function sortRows(rows: any[], sort: SortOption) {
  if (sort === 'recent') {
    return [...rows].sort((a, b) => {
      const aTime = new Date(String(a.effectiveAt || a.validFrom || a.createdAt || 0)).getTime();
      const bTime = new Date(String(b.effectiveAt || b.validFrom || b.createdAt || 0)).getTime();
      return bTime - aTime;
    });
  }

  return [...rows].sort((a, b) => {
    const variationA = getItemCostHistoryVariationPercent(a.previousCostAmount, a.costAmount);
    const variationB = getItemCostHistoryVariationPercent(b.previousCostAmount, b.costAmount);
    const safeA =
      variationA == null || !Number.isFinite(variationA)
        ? (sort === 'variation_desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY)
        : variationA;
    const safeB =
      variationB == null || !Number.isFinite(variationB)
        ? (sort === 'variation_desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY)
        : variationB;
    if (sort === 'variation_desc') return safeB - safeA;
    return safeA - safeB;
  });
}

function shouldHideGlobalHistoryRow(
  row: any,
  movementLookup: Map<string, { itemId: string | null; deletedAt: Date | null }>,
) {
  const referenceType = String(row?.referenceType || '').trim();
  if (referenceType === 'stock-movement-delete') return true;

  const metadata =
    row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  if (metadata?.hideFromItemHistory === true || metadata?.hideFromGlobalCostHistory === true) return true;

  const referenceId = String(row?.referenceId || '').trim();
  if (referenceType !== 'stock-movement' || !referenceId) return false;

  const movement = movementLookup.get(referenceId);
  if (!movement) return true;
  if (movement.deletedAt) return true;
  return String(movement.itemId || '') !== String(row?.itemId || '');
}

function buildPageHref(filters: {
  q: string;
  supplier: string;
  item: string;
  from: string;
  to: string;
  source: string;
  variationRange: string;
  sort: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();
  if (filters.q) searchParams.set('q', filters.q);
  if (filters.supplier) searchParams.set('supplier', filters.supplier);
  if (filters.item) searchParams.set('item', filters.item);
  if (filters.from) searchParams.set('from', filters.from);
  if (filters.to) searchParams.set('to', filters.to);
  if (filters.source && filters.source !== 'all') searchParams.set('source', filters.source);
  if (filters.variationRange && filters.variationRange !== 'all') searchParams.set('variationRange', filters.variationRange);
  if (filters.sort && filters.sort !== 'recent') searchParams.set('sort', filters.sort);
  if (filters.page > 1) searchParams.set('page', String(filters.page));
  const query = searchParams.toString();
  return `/admin/global-cost-history${query ? `?${query}` : ''}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const q = str(url.searchParams.get('q'));
    const supplier = str(url.searchParams.get('supplier'));
    const item = str(url.searchParams.get('item'));
    const from = str(url.searchParams.get('from'));
    const to = str(url.searchParams.get('to'));
    const source = parseSourceOption(url.searchParams.get('source'));
    const variationRange = parseVariationRange(url.searchParams.get('variationRange'));
    const sort = parseSortOption(url.searchParams.get('sort'));
    const page = parsePage(url.searchParams.get('page'));

    const timeline = await listItemCostHistoryTimeline({
      q,
      supplier,
      item,
      from: parseYmdStart(from),
      to: parseYmdEnd(to),
    });

    const db = prismaClient as any;
    const stockMovementReferenceIds = Array.from(new Set(
      timeline
        .filter((row: any) => String(row?.referenceType || '').trim() === 'stock-movement' && row?.referenceId)
        .map((row: any) => String(row.referenceId)),
    ));
    const referencedMovements = stockMovementReferenceIds.length > 0
      ? await db.stockMovement.findMany({
          where: { id: { in: stockMovementReferenceIds } },
          select: { id: true, itemId: true, deletedAt: true },
        })
      : [];
    const movementLookup = new Map<string, { itemId: string | null; deletedAt: Date | null }>(
      referencedMovements.map((movement: any) => [
        String(movement.id),
        { itemId: movement.itemId || null, deletedAt: movement.deletedAt || null },
      ]),
    );
    const visibleTimeline = timeline.filter((row: any) => !shouldHideGlobalHistoryRow(row, movementLookup));

    const filteredRows = visibleTimeline
      .filter((row) => matchesSource(row, source))
      .filter((row) => matchesVariationRange(getItemCostHistoryVariationPercent(row.previousCostAmount, row.costAmount), variationRange));
    const orderedRows = sortRows(filteredRows, sort);
    const totalItems = orderedRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedRows = orderedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const sourceSummary = SOURCE_OPTIONS
      .filter((option) => option.value !== 'all')
      .reduce((acc, option) => {
        acc[option.value] = filteredRows.filter((row) => String(row.source || '').trim().toLowerCase() === option.value).length;
        return acc;
      }, {} as Record<string, number>);

    return ok({
      rows: paginatedRows,
      summary: {
        total: totalItems,
        uniqueItems: new Set(filteredRows.map((row) => String(row.itemId || '')).filter(Boolean)).size,
        uniqueSuppliers: new Set(filteredRows.map((row) => String(row.supplierName || '')).filter(Boolean)).size,
        currentCount: filteredRows.filter((row) => Boolean(row.isCurrent)).length,
        sourceSummary,
      },
      pagination: {
        page: safePage,
        pageSize: PAGE_SIZE,
        totalItems,
        totalPages,
      },
      filters: {
        q,
        supplier,
        item,
        from,
        to,
        source,
        variationRange,
        sort,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminGlobalCostHistoryRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const payload = (loaderData as any)?.payload || {};
  const rows = (payload.rows || []) as any[];
  const summary = payload.summary || {};
  const pagination = payload.pagination || {};
  const filters = payload.filters || {};
  const currentPage = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);

  return (
    <div className="flex flex-col gap-4">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-slate-950">Histórico global de custos</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Timeline consolidada dos eventos que alteraram custo de item. Importação aparece como origem do evento, não como trilha principal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{summary.total || 0} eventos</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{summary.currentCount || 0} vigentes</span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{summary.uniqueItems || 0} itens</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">{summary.uniqueSuppliers || 0} fornecedores</span>
          </div>
        </div>

        <Form method="get" className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_160px_160px_180px_220px_170px]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Buscar por item, fornecedor ou documento"
              className="pl-9"
            />
          </div>
          <Input type="search" name="supplier" defaultValue={filters.supplier} placeholder="Fornecedor" />
          <Input type="search" name="item" defaultValue={filters.item} placeholder="Item" />
          <Input type="date" name="from" defaultValue={filters.from} />
          <Input type="date" name="to" defaultValue={filters.to} />
          <Select name="source" defaultValue={filters.source || 'all'}>
            <SelectTrigger>
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select name="sort" defaultValue={filters.sort || 'recent'}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenação" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <input type="hidden" name="variationRange" value={filters.variationRange || 'all'} />
            <Button type="submit" variant="outline" className="shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </Form>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Filtro por variação (%)</div>
          <div className="flex flex-wrap gap-2">
            {VARIATION_RANGE_OPTIONS.map((option) => {
              const isActive = (filters.variationRange || 'all') === option.value;

              return (
                <Link
                  key={option.value}
                  to={buildPageHref({
                    ...filters,
                    variationRange: option.value,
                    page: 1,
                  })}
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1.5 text-xs transition',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  <span>{option.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          {SOURCE_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
            <span key={option.value} className="rounded-full bg-slate-50 px-2.5 py-1">
              {option.label}: {summary.sourceSummary?.[option.value] || 0}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <ItemCostHistoryTable
          rows={rows}
          emptyMessage="Nenhum evento de custo encontrado com os filtros atuais."
        />

        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Página {currentPage} de {totalPages} • {pagination.totalItems || 0} evento(s)
          </span>
          <div className="flex items-center gap-2">
            {currentPage <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to={buildPageHref({ ...filters, page: currentPage - 1 })}>Anterior</Link>
              </Button>
            )}
            {currentPage >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Próxima
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to={buildPageHref({ ...filters, page: currentPage + 1 })}>Próxima</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
