import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { ArrowLeft } from 'lucide-react';
import Container from '~/components/layout/container/container';
import { StockMovementEditor } from '~/components/admin/stock-movement-editor';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getAvailableItemUnits } from '~/domain/item/item-units.server';
import { listStockMovementImportMovements } from '~/domain/stock-movement/stock-movement-import.server';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

export const meta: MetaFunction = () => [{ title: 'Admin | Editar movimentação de estoque' }];

function str(value: string | null) {
  return String(value || '').trim();
}

function sanitizeReturnTo(value: string, fallback: string) {
  return value.startsWith('/') ? value : fallback;
}

function normalizeItemUnit(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const lineId = str(params.lineId || null);
    if (!lineId) return badRequest('Linha inválida');

    const db = itemPrismaEntity.client as any;
    const url = new URL(request.url);
    const returnTo = sanitizeReturnTo(
      str(url.searchParams.get('returnTo')),
      `/admin/stock-movements?lineId=${encodeURIComponent(lineId)}&status=all`,
    );
    const [result, items, suppliers, measurementConversionsRaw] = await Promise.all([
      listStockMovementImportMovements({
        lineId,
        status: 'all',
        page: 1,
        pageSize: 2,
      }),
      db.item.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          classification: true,
          purchaseUm: true,
          consumptionUm: true,
          purchaseToConsumptionFactor: true,
          ItemPurchaseConversion: { select: { purchaseUm: true, factor: true } },
        },
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
      typeof db.measurementUnitConversion?.findMany === 'function'
        ? db.measurementUnitConversion.findMany({
          where: { active: true },
          select: {
            factor: true,
            FromUnit: { select: { code: true } },
            ToUnit: { select: { code: true } },
          },
        })
        : [],
    ]);

    if ((result.rows || []).length !== 1) {
      return badRequest('Não foi possível identificar uma única movimentação para esta linha');
    }

    const row = result.rows[0];
    const mappedItemId = str(row.itemId || row.Line?.mappedItemId || row.ImportLine?.mappedItemId || null) || undefined;
    const unitOptions = await getAvailableItemUnits(mappedItemId);
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

    return ok({ row, items, suppliers, unitOptions, measurementConversions, returnTo });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminStockMovementLineDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const payload = (loaderData as any)?.payload || {};
  const row = payload.row;
  const items = payload.items || [];
  const suppliers = payload.suppliers || [];
  const unitOptions = payload.unitOptions || [];
  const measurementConversions = payload.measurementConversions || [];
  const returnTo = payload.returnTo || '/admin/stock-movements';

  return (
    <Container fullWidth className=" px-4">
      <div className="flex w-full flex-col gap-6">
        <section className="space-y-4 border-b border-slate-200/80 pb-5">
          <Link to={returnTo} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950">
            <ArrowLeft size={16} />
            voltar para movimentações
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Editar movimentação de estoque</h1>
            <p className="text-sm text-slate-500">
              Esta página foi aberta a partir da linha de importação vinculada ao histórico de custo.
            </p>
          </div>

          <div className="grid gap-0 overflow-hidden rounded-2xl bg-slate-100/80 shadow-sm md:grid-cols-3">
            <div className="bg-white px-4 py-3 md:border-r md:border-slate-200">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Linha</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{row.lineId}</div>
            </div>
            <div className="bg-white px-4 py-3 md:border-r md:border-slate-200">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Movimentação</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{row.id}</div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Lote</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{row.Batch?.name || row.batchId}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <StockMovementEditor row={row} items={items} suppliers={suppliers} unitOptions={unitOptions} measurementConversions={measurementConversions} returnTo={returnTo} />
        </section>
      </div>
    </Container>
  );
}
