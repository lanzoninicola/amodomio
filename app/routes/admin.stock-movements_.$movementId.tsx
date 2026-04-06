import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { ArrowLeft } from 'lucide-react';
import Container from '~/components/layout/container/container';
import { StockMovementEditor } from '~/components/admin/stock-movement-editor';
import { Separator } from '~/components/ui/separator';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getAvailableItemUnits } from '~/domain/item/item-units.server';
import { listStockMovementImportMovements } from '~/domain/stock-movement/stock-movement-import.server';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

function str(value: string | null) {
  return String(value || '').trim();
}

function sanitizeReturnTo(value: string, fallback: string) {
  return value.startsWith('/') ? value : fallback;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const movementId = str(params.movementId || null);
    if (!movementId) return badRequest('Movimentação inválida');

    const db = itemPrismaEntity.client as any;
    const url = new URL(request.url);
    const returnTo = sanitizeReturnTo(str(url.searchParams.get('returnTo')), '/admin/stock-movements');
    const [result, items, suppliers] = await Promise.all([
      listStockMovementImportMovements({
        movementId,
        status: 'all',
        page: 1,
        pageSize: 1,
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
    ]);

    const row = result.rows?.[0] || null;
    if (!row) return badRequest('Movimentação não encontrada');
    const mappedItemId = str(row.itemId || row.Line?.mappedItemId || row.ImportLine?.mappedItemId || null) || undefined;
    const unitOptions = await getAvailableItemUnits(mappedItemId);

    return ok({ row, items, suppliers, unitOptions, returnTo });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminStockMovementDetailRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const payload = (loaderData as any)?.payload || {};
  const row = payload.row;
  const items = payload.items || [];
  const suppliers = payload.suppliers || [];
  const unitOptions = payload.unitOptions || [];
  const returnTo = payload.returnTo || '/admin/stock-movements';

  return (
    <Container fullWidth className=" px-4">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <section className="space-y-4 pb-2">
          <Link to={returnTo} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950">
            <ArrowLeft size={16} />
            voltar para movimentações
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Editar movimentação de estoque</h1>
            <p className="text-sm text-slate-500">
              Revise a origem importada e ajuste os campos editáveis da movimentação.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Movimentação</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{row.id}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Lote</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{row.Batch?.name || row.batchId}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Item</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">{row.Item?.name || row.Line?.ingredientName || 'Sem item'}</div>
            </div>
          </div>
          <Separator />
        </section>

        <StockMovementEditor row={row} items={items} suppliers={suppliers} unitOptions={unitOptions} returnTo={returnTo} />
      </div>
    </Container>
  );
}
