import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useActionData, useLoaderData, useSearchParams } from '@remix-run/react';
import { redirect } from '@remix-run/node';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { authenticator } from '~/domain/auth/google.server';
import {
  applyStockNfImportBatch,
  archiveStockNfImportBatch,
  createStockNfImportBatchFromFile,
  getStockNfImportBatchView,
  listStockNfImportBatches,
  mapBatchLinesToItem,
  rollbackStockNfImportBatch,
  setBatchLineManualConversion,
} from '~/domain/stock-nf-import/stock-nf-import.server';
import { badRequest, ok, serverError } from '~/utils/http-response.server';

function str(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function num(value: FormDataEntryValue | null) {
  const n = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function formatDate(value: any) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatMoney(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    ready: Number(summary?.ready || 0),
    invalid: Number(summary?.invalid || 0),
    pendingMapping: Number(summary?.pendingMapping || 0),
    pendingConversion: Number(summary?.pendingConversion || 0),
    applied: Number(summary?.applied || 0),
    skippedDuplicate: Number(summary?.skippedDuplicate || 0),
    error: Number(summary?.error || 0),
  };
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'applied':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'pending_mapping':
    case 'pending_conversion':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'invalid':
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'skipped_duplicate':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const batchId = url.searchParams.get('batchId') || '';

    const [batches, selected] = await Promise.all([
      listStockNfImportBatches(40),
      batchId ? getStockNfImportBatchView(batchId) : Promise.resolve(null),
    ]);

    return ok({ batches, selected, batchId });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    const actor = (user as any)?.email || (user as any)?.displayName || (user as any)?.name || null;

    const formData = await request.formData();
    const _action = str(formData.get('_action'));
    const batchId = str(formData.get('batchId'));

    if (_action === 'batch-upload') {
      const batchName = str(formData.get('batchName'));
      const file = formData.get('file');
      if (!(file instanceof File)) return badRequest('Selecione um arquivo .xlsx');
      if (!file.name.toLowerCase().endsWith('.xlsx')) return badRequest('Arquivo inválido. Envie .xlsx');

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await createStockNfImportBatchFromFile({
        fileName: file.name,
        fileBuffer: buffer,
        batchName,
        uploadedBy: actor,
      });

      return redirect(`/admin/items/import-stock-nf?batchId=${result.batchId}`);
    }

    if (_action === 'batch-map-item') {
      const itemId = str(formData.get('itemId'));
      const lineId = str(formData.get('lineId')) || null;
      const ingredientNameNormalized = str(formData.get('ingredientNameNormalized')) || null;
      const applyToAllSameIngredient = str(formData.get('applyToAllSameIngredient')) === 'on';
      const saveAlias = str(formData.get('saveAlias')) === 'on';
      if (!batchId) return badRequest('Lote inválido');
      if (!itemId) return badRequest('Selecione um item');

      await mapBatchLinesToItem({
        batchId,
        lineId,
        ingredientNameNormalized,
        itemId,
        applyToAllSameIngredient,
        saveAlias,
        actor,
      });

      return redirect(`/admin/items/import-stock-nf?batchId=${batchId}`);
    }

    if (_action === 'batch-set-manual-conversion') {
      const lineId = str(formData.get('lineId'));
      const factor = num(formData.get('factor'));
      if (!batchId || !lineId) return badRequest('Linha inválida');
      if (!(factor > 0)) return badRequest('Informe um fator maior que zero');
      await setBatchLineManualConversion({ batchId, lineId, factor });
      return redirect(`/admin/items/import-stock-nf?batchId=${batchId}`);
    }

    if (_action === 'batch-apply') {
      if (!batchId) return badRequest('Lote inválido');
      await applyStockNfImportBatch({ batchId, actor });
      return redirect(`/admin/items/import-stock-nf?batchId=${batchId}`);
    }

    if (_action === 'batch-rollback') {
      if (!batchId) return badRequest('Lote inválido');
      await rollbackStockNfImportBatch({ batchId, actor });
      return redirect(`/admin/items/import-stock-nf?batchId=${batchId}`);
    }

    if (_action === 'batch-archive') {
      if (!batchId) return badRequest('Lote inválido');
      await archiveStockNfImportBatch(batchId);
      return redirect('/admin/items/import-stock-nf');
    }

    return badRequest('Ação inválida');
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemsImportStockNfRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const payload = (loaderData as any)?.payload || {};
  const batches = (payload.batches || []) as any[];
  const selected = payload.selected as any;
  const selectedBatch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const pendingMappingGroups = (selected?.pendingMappingGroups || []) as any[];
  const items = (selected?.items || []) as any[];
  const appliedChanges = (selected?.appliedChanges || []) as any[];
  const summary = summaryFromAny(selected?.summary || selectedBatch?.summary);
  const [searchParams] = useSearchParams();

  return (
    <div className="flex flex-col gap-4 p-4">
      {actionData?.message ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${actionData.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {actionData.message}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Importação de Movimentação NF (SAIPOS)</h1>
            <p className="text-sm text-slate-600">
              Faz upload do Excel, valida linhas, permite mapear itens/conversões e aplica custo com rastreabilidade e rollback.
            </p>
          </div>
          <Link to="/admin/items" className="text-sm underline text-slate-700">
            Voltar para Itens
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Form method="post" encType="multipart/form-data" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <input type="hidden" name="_action" value="batch-upload" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Novo lote</h2>
            <div>
              <Label htmlFor="batchName">Nome da importação</Label>
              <Input id="batchName" name="batchName" placeholder="ex: NF SAIPOS Fev/2026 - Semana 1" />
            </div>
            <div>
              <Label htmlFor="file">Arquivo .xlsx</Label>
              <Input id="file" name="file" type="file" accept=".xlsx" required />
            </div>
            <Button type="submit" className="bg-slate-900 hover:bg-slate-700 w-full">Upload e validar</Button>
          </Form>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lotes recentes</h2>
            <div className="mt-3 space-y-2">
              {batches.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum lote cadastrado.</p>
              ) : (
                batches.map((batch) => {
                  const isActive = String(batch.id) === String(searchParams.get('batchId') || '');
                  const batchSummary = summaryFromAny(batch.summary);
                  return (
                    <Link
                      key={batch.id}
                      to={`?batchId=${batch.id}`}
                      className={`block rounded-lg border p-3 ${isActive ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm text-slate-900 truncate">{batch.name}</div>
                        <Badge variant="outline" className={statusBadgeClass(String(batch.status))}>{batch.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 truncate">{batch.originalFileName || '-'} • {formatDate(batch.createdAt)}</div>
                      <div className="mt-2 text-xs text-slate-600">
                        {batchSummary.total} linhas • {batchSummary.applied} aplicadas • {batchSummary.ready} prontas
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {!selectedBatch ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Selecione um lote à esquerda ou faça upload de um novo arquivo para começar.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{selectedBatch.name}</h2>
                      <Badge variant="outline" className={statusBadgeClass(String(selectedBatch.status))}>{selectedBatch.status}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">ID: {selectedBatch.id}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Arquivo: {selectedBatch.originalFileName || '-'} • Aba: {selectedBatch.worksheetName || '-'}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Período: {formatDate(selectedBatch.periodStart)} até {formatDate(selectedBatch.periodEnd)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Form method="post">
                      <input type="hidden" name="_action" value="batch-apply" />
                      <input type="hidden" name="batchId" value={selectedBatch.id} />
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={summary.ready <= 0}>
                        Aplicar prontas ({summary.ready})
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="_action" value="batch-rollback" />
                      <input type="hidden" name="batchId" value={selectedBatch.id} />
                      <Button type="submit" variant="outline" disabled={appliedChanges.length <= 0}>
                        Rollback
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="_action" value="batch-archive" />
                      <input type="hidden" name="batchId" value={selectedBatch.id} />
                      <Button type="submit" variant="outline">Arquivar</Button>
                    </Form>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                  {[
                    ['Total', summary.total],
                    ['Prontas', summary.ready],
                    ['Aplicadas', summary.applied],
                    ['Pend. vínculo', summary.pendingMapping],
                    ['Pend. conversão', summary.pendingConversion],
                    ['Duplicadas', summary.skippedDuplicate],
                    ['Inválidas', summary.invalid],
                    ['Erros', summary.error],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
                      <div className="text-lg font-semibold text-slate-900">{value as any}</div>
                    </div>
                  ))}
                </div>
              </div>

              {pendingMappingGroups.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Pendências de vínculo</h3>
                  <p className="text-xs text-amber-700 mt-1">Mapeie ingredientes para itens do sistema. Você pode aplicar o vínculo em massa e salvar alias.</p>
                  <div className="mt-3 space-y-3">
                    {pendingMappingGroups.map((group) => (
                      <Form key={group.ingredientNameNormalized} method="post" className="rounded-lg border border-amber-200 bg-white p-3">
                        <input type="hidden" name="_action" value="batch-map-item" />
                        <input type="hidden" name="batchId" value={selectedBatch.id} />
                        <input type="hidden" name="ingredientNameNormalized" value={group.ingredientNameNormalized} />
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 truncate">{group.ingredientName}</div>
                            <div className="text-xs text-slate-500">{group.count} linha(s) pendentes</div>
                            {group.suggestions?.length ? (
                              <div className="mt-1 text-xs text-slate-600 truncate">
                                Sugestões: {group.suggestions.map((s: any) => s.name).join(' • ')}
                              </div>
                            ) : null}
                          </div>
                          <div className="w-full lg:w-[320px]">
                            <Label className="text-xs">Item do sistema</Label>
                            <select
                              name="itemId"
                              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              required
                              defaultValue={group.suggestions?.[0]?.id || ''}
                            >
                              <option value="">Selecionar...</option>
                              {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.purchaseUm || item.consumptionUm || '-'})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1 text-xs text-slate-700">
                            <label className="inline-flex items-center gap-2"><input type="checkbox" name="applyToAllSameIngredient" defaultChecked /> Aplicar para todas iguais</label>
                            <label className="inline-flex items-center gap-2"><input type="checkbox" name="saveAlias" defaultChecked /> Salvar alias</label>
                          </div>
                          <Button type="submit" variant="outline">Vincular</Button>
                        </div>
                      </Form>
                    ))}
                  </div>
                </div>
              ) : null}

              {lines.some((line) => line.status === 'pending_conversion') ? (
                <div className="rounded-xl border border-amber-200 bg-white p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Pendências de conversão de UM</h3>
                  <div className="mt-3 space-y-2">
                    {lines.filter((line) => line.status === 'pending_conversion').slice(0, 50).map((line) => (
                      <Form key={line.id} method="post" className="grid gap-2 rounded-lg border border-slate-200 p-3 lg:grid-cols-[minmax(0,1fr)_140px_auto] lg:items-end">
                        <input type="hidden" name="_action" value="batch-set-manual-conversion" />
                        <input type="hidden" name="batchId" value={selectedBatch.id} />
                        <input type="hidden" name="lineId" value={line.id} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">Linha {line.rowNumber} • {line.ingredientName}</div>
                          <div className="text-xs text-slate-600">
                            {formatMoney(line.costAmount)} / {line.movementUnit || '-'} → {line.targetUnit || '-'}
                            {line.errorMessage ? ` • ${line.errorMessage}` : ''}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Fator (destino por 1 origem)</Label>
                          <Input name="factor" type="number" min="0" step="0.000001" placeholder="ex: 1000" />
                        </div>
                        <Button type="submit" variant="outline">Salvar fator</Button>
                      </Form>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Linhas do lote</h3>
                  <div className="text-xs text-slate-500">{lines.length} linha(s)</div>
                </div>
                <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50/90">
                      <TableRow className="hover:bg-slate-50/90">
                        <TableHead className="px-3 py-2 text-xs">Linha</TableHead>
                        <TableHead className="px-3 py-2 text-xs">Data/NF</TableHead>
                        <TableHead className="px-3 py-2 text-xs">Ingrediente</TableHead>
                        <TableHead className="px-3 py-2 text-xs">Mov.</TableHead>
                        <TableHead className="px-3 py-2 text-xs">Custo</TableHead>
                        <TableHead className="px-3 py-2 text-xs">Mapeamento</TableHead>
                        <TableHead className="px-3 py-2 text-xs">Conversão</TableHead>
                        <TableHead className="px-3 py-2 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line) => (
                        <TableRow key={line.id} className="border-slate-100 align-top">
                          <TableCell className="px-3 py-2 text-xs text-slate-600">{line.rowNumber}</TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-700">
                            <div>{formatDate(line.movementAt)}</div>
                            <div className="text-slate-500">NF {line.invoiceNumber || '-'}</div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs">
                            <div className="font-medium text-slate-900">{line.ingredientName}</div>
                            <div className="text-slate-500">{line.motivo || '-'}</div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-700">
                            <div>{line.qtyEntry ?? '-'} {line.unitEntry || ''}</div>
                            <div className="text-slate-500">cons: {line.qtyConsumption ?? '-'} {line.unitConsumption || ''}</div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-700">
                            <div>{formatMoney(line.costAmount)} / {line.movementUnit || '-'}</div>
                            <div className="text-slate-500">total: {formatMoney(line.costTotalAmount)}</div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-700">
                            <div>{line.mappedItemName || '-'}</div>
                            <div className="text-slate-500">{line.mappingSource || '-'}</div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-700">
                            <div>
                              {line.convertedCostAmount != null ? `${formatMoney(line.convertedCostAmount)} / ${line.targetUnit || '-'}` : '-'}
                            </div>
                            <div className="text-slate-500">
                              {line.conversionSource || '-'}{line.conversionFactorUsed ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}` : ''}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs">
                            <Badge variant="outline" className={statusBadgeClass(String(line.status))}>{line.status}</Badge>
                            {line.errorMessage ? <div className="mt-1 text-[11px] text-red-700 max-w-[220px]">{line.errorMessage}</div> : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {appliedChanges.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Alterações aplicadas (snapshot para rollback)</h3>
                  <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50/90">
                        <TableRow className="hover:bg-slate-50/90">
                          <TableHead className="px-3 py-2 text-xs">Aplicado em</TableHead>
                          <TableHead className="px-3 py-2 text-xs">Item</TableHead>
                          <TableHead className="px-3 py-2 text-xs">Antes</TableHead>
                          <TableHead className="px-3 py-2 text-xs">Depois</TableHead>
                          <TableHead className="px-3 py-2 text-xs">Rollback</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appliedChanges.map((c) => (
                          <TableRow key={c.id} className="border-slate-100">
                            <TableCell className="px-3 py-2 text-xs">{formatDate(c.appliedAt)}</TableCell>
                            <TableCell className="px-3 py-2 text-xs">{c.itemId}</TableCell>
                            <TableCell className="px-3 py-2 text-xs">{formatMoney(c.previousCostAmount)} / {c.previousCostUnit || '-'}</TableCell>
                            <TableCell className="px-3 py-2 text-xs">{formatMoney(c.newCostAmount)} / {c.newCostUnit || '-'}</TableCell>
                            <TableCell className="px-3 py-2 text-xs">
                              {c.rolledBackAt ? (
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">revertido</Badge>
                              ) : c.rollbackStatus ? (
                                <Badge variant="outline" className={statusBadgeClass(c.rollbackStatus)}>{c.rollbackStatus}</Badge>
                              ) : (
                                <span className="text-slate-500">pendente</span>
                              )}
                              {c.rollbackMessage ? <div className="mt-1 text-[11px] text-red-700">{c.rollbackMessage}</div> : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
