import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, Link, useActionData, useLoaderData, useSearchParams } from '@remix-run/react';
import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { authenticator } from '~/domain/auth/google.server';
import {
  getStockNfImportBatchView,
  listStockNfImportBatches,
  reconcileStockNfImportBatchSuppliersFromFile,
} from '~/domain/stock-nf-import/stock-nf-import.server';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

export const meta: MetaFunction = () => [{ title: 'Admin | Conciliação de fornecedor' }];

function str(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function formatDate(value: any) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function supplierReconciliationLabel(line: any) {
  if (line?.supplierReconciliationStatus === 'manual') return 'conciliado manualmente';
  if (line?.supplierReconciliationStatus === 'matched' || line?.supplierId) return 'conciliado com cadastro';
  if (line?.supplierReconciliationStatus === 'unmatched') return 'pendente de conciliação';
  return 'sem conciliação iniciada';
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    pendingSupplier: Number(summary?.pendingSupplier || 0),
    readyToApply: Number(summary?.readyToApply || 0),
  };
}

function batchStatusBadgeClass(status: string) {
  switch (String(status || '').trim()) {
    case 'validated':
      return 'border-emerald-300 bg-emerald-100 text-emerald-900';
    case 'applied':
      return 'border-blue-200 bg-blue-100 text-blue-900';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function buildBatchHref(batchId: string) {
  return `/admin/supplier-reconciliation?batchId=${batchId}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const requestedBatchId = String(url.searchParams.get('batchId') || '').trim();
    const batches = await listStockNfImportBatches(100);

    const fallbackBatch =
      batches.find((batch: any) => Number(batch?.summary?.pendingSupplier || 0) > 0) ||
      batches[0] ||
      null;
    const selectedBatchId = requestedBatchId || String(fallbackBatch?.id || '').trim();
    const selected = selectedBatchId ? await getStockNfImportBatchView(selectedBatchId) : null;

    return ok({
      batches,
      selected,
      selectedBatchId,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await authenticator.isAuthenticated(request);

    const formData = await request.formData();
    const _action = str(formData.get('_action'));
    const batchId = str(formData.get('batchId'));

    if (_action !== 'batch-attach-supplier-json') return badRequest('Ação inválida');
    if (!batchId) return badRequest('Lote inválido');

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

    return redirect(buildBatchHref(batchId));
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminSupplierReconciliationRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const payload = (loaderData as any)?.payload || {};
  const batches = (payload.batches || []) as any[];
  const selected = payload.selected as any;
  const batch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const summary = summaryFromAny(selected?.summary || batch?.summary);
  const [selectedBatchId, setSelectedBatchId] = useState(String(searchParams.get('batchId') || payload.selectedBatchId || ''));
  const [filter, setFilter] = useState<'pending' | 'all' | 'matched'>('pending');

  const filteredLines = useMemo(() => {
    if (filter === 'all') return lines;
    if (filter === 'matched') {
      return lines.filter((line) => line?.supplierReconciliationStatus === 'matched' || line?.supplierReconciliationStatus === 'manual' || line?.supplierId);
    }
    return lines.filter((line) => {
      const status = String(line?.status || '');
      if (['invalid', 'ignored', 'skipped_duplicate'].includes(status)) return false;
      return !(line?.supplierReconciliationStatus === 'matched' || line?.supplierReconciliationStatus === 'manual' || line?.supplierId);
    });
  }, [filter, lines]);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex flex-col gap-2">
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">Conciliação de fornecedor</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Selecione um lote, anexe o JSON e revise as pendências.
            </p>
          </div>
          {batch ? (
            <Link
              to={`/admin/import-stock-movements/${batch.id}`}
              className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Abrir lote completo
            </Link>
          ) : null}
        </div>

        <Separator />

        {actionData?.message ? (
          <div className={`text-sm ${actionData.status >= 400 ? 'text-red-700' : 'text-green-700'}`}>
            {actionData.message}
          </div>
        ) : null}

        <Form method="get" className="max-w-2xl rounded-lg bg-slate-50 px-3 py-3">
          <div className="space-y-2">
            <Label htmlFor="batchId">Lote de importação</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input type="hidden" name="batchId" value={selectedBatchId} />
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                <SelectTrigger id="batchId" className="h-10 w-full bg-white sm:flex-1">
                  <SelectValue placeholder="Selecione um lote" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((item) => {
                    const batchSummary = summaryFromAny(item.summary);
                    return (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} {batchSummary.pendingSupplier > 0 ? `• ${batchSummary.pendingSupplier} pend.` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" className="h-10 w-fit whitespace-nowrap bg-white px-3" disabled={!selectedBatchId}>
                Abrir lote
              </Button>
            </div>
          </div>
        </Form>
      </section>

      {!batch ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Nenhum lote selecionado.
        </div>
      ) : (
        <>
          <Separator />

          <section className="space-y-5">
            <div className="space-y-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{batch.name}</h2>
                    <Badge variant="outline" className={batchStatusBadgeClass(String(batch.status))}>
                      {batch.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{batch.originalFileName || '-'}</p>
                  <p className="text-sm text-slate-500">JSON atual: {batch.supplierNotesFileName || 'não anexado'}</p>
                  <p className="text-sm text-slate-500">Período: {formatDate(batch.periodStart)} até {formatDate(batch.periodEnd)}</p>
                </div>

                <div className="grid grid-cols-3 gap-x-6 gap-y-3 lg:min-w-[360px] lg:justify-items-end">
                  <div className="space-y-1 lg:text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Pend. fornecedor</div>
                    <div className="text-2xl font-semibold text-slate-950">{summary.pendingSupplier}</div>
                  </div>
                  <div className="space-y-1 lg:text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Prontas p/ aplicar</div>
                    <div className="text-2xl font-semibold text-slate-950">{summary.readyToApply}</div>
                  </div>
                  <div className="space-y-1 lg:text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Total</div>
                    <div className="text-2xl font-semibold text-slate-950">{summary.total}</div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <Form method="post" encType="multipart/form-data" className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <input type="hidden" name="_action" value="batch-attach-supplier-json" />
              <input type="hidden" name="batchId" value={batch.id} />
              <a
                href="https://conta.saipos.com/#/app/store/provider-nfe"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-fit shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Saipos JSON
                <ExternalLink size={14} />
              </a>
              <div className="flex-1">
                <Label htmlFor="supplierNotesFile">Anexar JSON das notas para conciliar fornecedor</Label>
                <Input id="supplierNotesFile" name="supplierNotesFile" type="file" accept=".json,application/json" className="mt-1 bg-white" />
              </div>
              <Button type="submit" variant="outline">
                Reprocessar conciliação
              </Button>
            </Form>
          </section>

          <Separator />

          {summary.pendingSupplier <= 0 ? (
            <section className="space-y-3 rounded-lg bg-emerald-50 px-4 py-4">
              <div className="text-sm font-medium text-emerald-900">
                Conciliação de fornecedor concluída para este lote.
              </div>
              <p className="text-sm text-emerald-800">
                Volte para a página do lote para revisar o resultado final e concluir a importação das linhas conciliadas.
              </p>
              <div>
                <Link
                  to={`/admin/import-stock-movements/${batch.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
                >
                  Ir para o lote e finalizar importação
                </Link>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  ['pending', 'Pendentes'],
                  ['matched', 'Conciliadas'],
                  ['all', 'Todas'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value as 'pending' | 'all' | 'matched')}
                    className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium ${
                      filter === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-0 py-3">Linha</th>
                      <th className="px-4 py-3">Documento</th>
                      <th className="px-4 py-3">Fornecedor</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.map((line) => (
                      <tr key={line.id} className="border-t border-slate-100 align-top">
                        <td className="px-0 py-4">
                          <div className="font-medium text-slate-900">{line.ingredientName}</div>
                          <div className="text-xs text-slate-500">linha {line.rowNumber}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-slate-900">{line.invoiceNumber || '-'}</div>
                          <div className="text-xs text-slate-500">{formatDate(line.movementAt)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-slate-900">{line.supplierName || '-'}</div>
                          <div className="text-xs text-slate-500">{line.supplierCnpj || 'sem CNPJ'}</div>
                          <div className="text-xs text-slate-400">{line.supplierReconciliationSource || line.supplierMatchSource || '-'}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Badge variant="outline">{supplierReconciliationLabel(line)}</Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-0 py-10 text-center text-sm text-slate-500">
                          Nenhuma linha encontrada para este filtro.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
