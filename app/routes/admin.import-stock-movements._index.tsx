import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react';
import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Search, Trash2 } from 'lucide-react';
import NoRecordsFound from '~/components/primitives/no-records-found/no-records-found';
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
import { Input } from '~/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { deleteStockMovementImportBatch, listStockMovementImportBatches } from '~/domain/stock-movement/stock-movement-import.server';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

function str(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function formatDate(value: any) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    ready: Number(summary?.ready || 0),
    readyToImport: Number(summary?.readyToImport || 0),
    imported: Number(summary?.imported || 0),
    pendingSupplier: Number(summary?.pendingSupplier || 0),
  };
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'validated':
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'imported':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'partial':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'archived':
      return 'border-slate-200 bg-slate-100 text-slate-700';
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
        <Button type="submit" variant="outline" size="icon" className="h-9 w-9 rounded-md border-red-200 bg-white text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Eliminar lote</span>
        </Button>
      </Form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-md border-red-200 bg-white text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Eliminar lote</span>
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

export async function loader(_: LoaderFunctionArgs) {
  try {
    const batches = await listStockMovementImportBatches(100);
    return ok({ batches });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const action = str(formData.get('_action'));
    if (action !== 'batch-delete') return badRequest('Ação inválida');

    const batchId = str(formData.get('batchId'));
    if (!batchId) return badRequest('Lote inválido');

    await deleteStockMovementImportBatch(batchId);
    return ok({ message: 'Lote eliminado com sucesso' });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminImportStockMovementsIndexRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const batches = ((loaderData as any)?.payload?.batches || []) as any[];
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return batches;

    return batches.filter((batch) => {
      const haystack = [batch.name, batch.originalFileName, batch.worksheetName, batch.status]
        .map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(query));
    });
  }, [batches, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4 border-b border-slate-200 pb-4">
        {actionData?.message ? (
          <div className={`rounded-lg border px-3 py-2 text-sm ${actionData.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {actionData.message}
          </div>
        ) : null}
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            {filtered.length} lote(s) de importação.
          </p>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-[620px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                type="search"
                className="h-12 rounded-xl border-slate-300 bg-white pl-10 text-sm text-black placeholder:text-slate-400 focus-visible:border-black focus-visible:ring-1 focus-visible:ring-black"
                placeholder="Pesquise por lote, arquivo ou status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-5 text-sm text-black">
              <Button asChild variant="outline" className="h-10 rounded-xl border-slate-200 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50">
                <Link to="/admin/global-cost-history">
                  Ver histórico global de custos
                </Link>
              </Button>
              <span className="font-medium">ordenado por criação</span>
              <span className="text-slate-600">{batches.length} no total</span>
              <span className="text-slate-600">{filtered.length} em exibição</span>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <NoRecordsFound text="Nenhum lote de importação encontrado" />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-slate-50/70">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Lote</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Arquivo</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Total</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Importadas</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Importar</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Criado em</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((batch) => {
                const summary = summaryFromAny(batch.summary);
                return (
                  <TableRow key={batch.id} className="border-slate-100 align-top hover:bg-slate-50/40">
                    <TableCell className="px-4 py-4">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Link
                          to={`/admin/import-stock-movements/${batch.id}`}
                          className="truncate text-[15px] font-semibold leading-5 text-slate-900 hover:underline"
                        >
                          {batch.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                            {batch.id}
                          </span>
                          {summary.pendingSupplier > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                              {summary.pendingSupplier} pend. fornecedor
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="min-w-[210px] space-y-1">
                        <div className="line-clamp-2 text-sm font-medium leading-5 text-slate-800">
                          {batch.originalFileName || '-'}
                        </div>
                        <div className="text-xs text-slate-500">Aba: {batch.worksheetName || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="min-w-[68px] rounded-xl bg-slate-50 px-3 py-2 text-center">
                        <div className="text-lg font-semibold leading-none text-slate-950">{summary.total}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">linhas</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="min-w-[68px] rounded-xl bg-slate-50 px-3 py-2 text-center">
                        <div className="text-lg font-semibold leading-none text-slate-950">{summary.imported}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">importadas</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="min-w-[88px] rounded-xl bg-emerald-50 px-3 py-2 text-center">
                        <div className="text-lg font-semibold leading-none text-emerald-800">{summary.readyToImport}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-emerald-700">prontas</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="min-w-[172px]">
                        {summary.pendingSupplier > 0 ? (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-amber-800">
                              {summary.pendingSupplier} pendência(s)
                            </div>
                            <Button asChild variant="outline" className="h-8 rounded-md border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 hover:text-amber-900">
                              <Link to={`/admin/supplier-reconciliation?batchId=${batch.id}`}>
                                Conciliar fornecedor
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <div className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Conciliado
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <Badge variant="outline" className={statusBadgeClass(String(batch.status))}>
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-slate-600">
                      <div className="min-w-[120px] leading-5">{formatDate(batch.createdAt)}</div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                          <Link to={`/admin/import-stock-movements/${batch.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver lote</span>
                          </Link>
                        </Button>
                        <DeleteBatchButton
                          batchId={String(batch.id)}
                          batchName={String(batch.name || 'sem nome')}
                          status={String(batch.status || '')}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{filtered.length} lote(s) listado(s).</span>
            <span className="text-xs font-semibold text-slate-900">Visão consolidada dos lotes</span>
          </div>
        </div>
      )}
    </div>
  );
}
