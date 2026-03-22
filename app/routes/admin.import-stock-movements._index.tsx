import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
import { deleteStockNfImportBatch, listStockNfImportBatches } from '~/domain/stock-nf-import/stock-nf-import.server';
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
    applied: Number(summary?.applied || 0),
  };
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'validated':
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'applied':
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
        <Button type="submit" variant="outline" className="rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50">
          Eliminar
        </Button>
      </Form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50">
          Eliminar
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
    const batches = await listStockNfImportBatches(100);
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

    await deleteStockNfImportBatch(batchId);
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
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Criado em</TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((batch) => {
                const summary = summaryFromAny(batch.summary);
                return (
                  <TableRow key={batch.id} className="border-slate-100 hover:bg-slate-50/40">
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link to={`/admin/import-stock-movements/${batch.id}`} className="truncate font-medium text-slate-900 hover:underline">
                          {batch.name}
                        </Link>
                        <span className="text-xs text-slate-500">ID: {batch.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="text-sm text-slate-800">{batch.originalFileName || '-'}</div>
                      <div className="text-xs text-slate-500">Aba: {batch.worksheetName || '-'}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-800">{summary.total}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-800">{summary.applied}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-800">{summary.ready}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={statusBadgeClass(String(batch.status))}>
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-600">{formatDate(batch.createdAt)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/import-stock-movements/${batch.id}`}
                          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Ver lote
                        </Link>
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
