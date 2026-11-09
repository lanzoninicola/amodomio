import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useNavigation } from '@remix-run/react';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCcw } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { isDatabaseConnectivityError } from '~/lib/errors/connectivity';
import prismaClient from '~/lib/prisma/client.server';

function formatDate(value: unknown) {
  if (!value) return '-';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatMoney(value: number | null) {
  if (value == null) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function discrepancyPct(converted: number | null, last: number | null) {
  if (converted == null || last == null || last === 0) return null;
  return ((converted - last) / last) * 100;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = 50;

  const db = prismaClient as any;
  try {
    const [total, approvals] = await Promise.all([
      db.stockMovementCostReviewApproval.count(),
      db.stockMovementCostReviewApproval.findMany({
        orderBy: [{ approvedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          Batch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return json({
      approvals,
      total,
      page,
      pageSize,
      unavailable: false,
      errorMessage: null,
    });
  } catch (error) {
    const unavailable = isDatabaseConnectivityError(error);

    console.error('Failed to load stock movement cost review approvals', error);

    return json(
      {
        approvals: [],
        total: 0,
        page,
        pageSize,
        unavailable,
        errorMessage: unavailable
          ? 'Não foi possível alcançar o banco de dados agora. A tela continuará disponível para nova tentativa.'
          : 'Não foi possível carregar as aprovações de revisão de custo.',
      },
      { status: unavailable ? 503 : 500 },
    );
  }
}

export default function CostReviewApprovalsPage() {
  const { approvals, total, page, pageSize, unavailable, errorMessage } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const totalPages = Math.ceil(total / pageSize);
  const isNavigating = navigation.state !== 'idle';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-amber-500" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aprovações de revisão de custo</h1>
          <p className="text-sm text-slate-500">Histórico auditável de todas as aprovações de custo fora do padrão.</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">
                  {unavailable ? 'Banco temporariamente indisponível' : 'Falha ao carregar a lista'}
                </h2>
                <p className="max-w-2xl text-sm text-slate-600">{errorMessage}</p>
                <p className="text-xs text-slate-500">
                  {unavailable
                    ? 'Esse caso não deve virar tela branca de erro. Mantemos o layout estável e permitimos tentar novamente.'
                    : 'A página foi preservada, mas os dados não puderam ser exibidos nesta tentativa.'}
                </p>
              </div>
            </div>

            <Link
              to={`?page=${page}`}
              replace
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Tentar novamente
            </Link>
          </div>
        </div>
      ) : null}

      <div className="relative rounded-xl border border-slate-200 bg-white">
        {isNavigating ? (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-white/80 backdrop-blur-[1px]">
            <div className="space-y-3 p-4">
              <Skeleton className="h-8 w-40" />
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="grid grid-cols-8 gap-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">Data</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">Item</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">Custo aprovado</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">Último custo</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">Variação</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">Aprovado por</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">WhatsApp</TableHead>
              <TableHead className="text-[11px] font-black uppercase tracking-wider text-slate-500">Lote</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.length === 0 && !errorMessage && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-400">
                  Nenhuma aprovação registrada ainda.
                </TableCell>
              </TableRow>
            )}
            {approvals.map((a: any) => {
              const pct = discrepancyPct(a.convertedCostAmount, a.lastCostPerUnit);
              return (
                <TableRow key={a.id} className="align-top">
                  <TableCell className="whitespace-nowrap py-3 text-xs text-slate-600">
                    {formatDate(a.approvedAt)}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm font-medium text-slate-800">{a.mappedItemName || a.ingredientName}</div>
                    {a.mappedItemName && a.mappedItemName !== a.ingredientName && (
                      <div className="text-[11px] text-slate-400">{a.ingredientName}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 font-mono text-sm tabular-nums text-slate-800">
                    {formatMoney(a.convertedCostAmount)}
                    {a.targetUnit ? <span className="ml-1 text-[11px] text-slate-400">/{a.targetUnit}</span> : null}
                  </TableCell>
                  <TableCell className="py-3 font-mono text-sm tabular-nums text-slate-500">
                    {formatMoney(a.lastCostPerUnit)}
                  </TableCell>
                  <TableCell className="py-3">
                    {pct != null ? (
                      <Badge
                        variant="outline"
                        className={
                          pct > 0
                            ? 'border-red-200 bg-red-50 font-mono text-red-700'
                            : 'border-emerald-200 bg-emerald-50 font-mono text-emerald-700'
                        }
                      >
                        {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-slate-600">
                    {a.approvedBy || <span className="text-slate-400">-</span>}
                  </TableCell>
                  <TableCell className="py-3">
                    {a.notifiedWhatsapp ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Enviado</Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {a.Batch ? (
                      <Link
                        to={`/admin/import-stock-movements/${a.Batch.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {a.Batch.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} registro(s)</span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link to={`?page=${page - 1}`} className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50">
                Anterior
              </Link>
            )}
            <span>Página {page} de {totalPages}</span>
            {page < totalPages && (
              <Link to={`?page=${page + 1}`} className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50">
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
