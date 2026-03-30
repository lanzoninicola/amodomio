import { Link, useFetcher, useNavigate, useRevalidator } from '@remix-run/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { DecimalInput } from '~/components/inputs/inputs';
import { MoneyInput } from '~/components/money-input/MoneyInput';
import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Separator } from '~/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { cn } from '~/lib/utils';

function formatDateTimeLocalValue(value: unknown) {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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

function formatDecimal(value: unknown, fractionDigits = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function getItemBaseUnit(item: { purchaseUm?: string | null; consumptionUm?: string | null } | null | undefined) {
  return item?.consumptionUm || item?.purchaseUm || '-';
}

export function StockMovementEditor({
  row,
  items,
  suppliers,
  unitOptions,
  returnTo,
  actionPath = '/admin/stock-movements',
}: {
  row: any;
  items: any[];
  suppliers: any[];
  unitOptions: string[];
  returnTo: string;
  actionPath?: string;
}) {
  const fetcher = useFetcher<any>();
  const rollbackFetcher = useFetcher<any>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const handledRollbackMovementIdRef = useRef<string | null>(null);
  const isSaving = fetcher.state !== 'idle';
  const isRollingBack = rollbackFetcher.state !== 'idle';
  const rollbackAction = String(rollbackFetcher.formData?.get('_action') || '');
  const isSubmitting = isSaving || isRollingBack;
  const line = row?.Line || null;
  const updatedLineId = fetcher.data?.payload?.updatedLineId;
  const [hasRolledBackForEditing, setHasRolledBackForEditing] = useState(false);
  const rollbackSucceededForRow =
    hasRolledBackForEditing ||
    (
      rollbackFetcher.state === 'idle' &&
      rollbackFetcher.data?.status === 200 &&
      rollbackFetcher.data?.payload?.rolledBackMovementId === row?.id
    );
  const isActiveMovement = !isActiveMovementDeleted(row) && !rollbackSucceededForRow;
  const canRemapItem = !isActiveMovement;
  const supplierOptions = useMemo(() => suppliers || [], [suppliers]);
  const itemOptions = useMemo(() => items || [], [items]);
  const movementUnitInitial = String(line?.movementUnit || line?.unitEntry || line?.unitConsumption || row?.movementUnit || '').trim().toUpperCase();
  const resolvedUnitOptions = useMemo(() => {
    const merged = new Set<string>((unitOptions || []).filter(Boolean));
    if (movementUnitInitial) merged.add(movementUnitInitial);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [movementUnitInitial, unitOptions]);
  const [qtyEntryDraft, setQtyEntryDraft] = useState<number>(Number(line?.qtyEntry ?? 0));
  const [movementUnitDraft, setMovementUnitDraft] = useState(movementUnitInitial || '');
  const [costTotalAmountDraft, setCostTotalAmountDraft] = useState<number>(
    Number(
      line?.costTotalAmount ??
      (Number(line?.qtyEntry ?? 0) > 0 && Number(line?.costAmount ?? 0) > 0
        ? Number(line?.qtyEntry ?? 0) * Number(line?.costAmount ?? 0)
        : 0),
    ),
  );
  const [supplierIdDraft, setSupplierIdDraft] = useState(String(line?.supplierId || row?.supplierId || ''));
  const [mappedItemIdDraft, setMappedItemIdDraft] = useState(String(line?.mappedItemId || row?.itemId || ''));
  const [itemPickerOpen, setItemPickerOpen] = useState(false);

  useEffect(() => {
    setQtyEntryDraft(Number(line?.qtyEntry ?? 0));
    setMovementUnitDraft(movementUnitInitial || '');
    setCostTotalAmountDraft(
      Number(
        line?.costTotalAmount ??
        (Number(line?.qtyEntry ?? 0) > 0 && Number(line?.costAmount ?? 0) > 0
          ? Number(line?.qtyEntry ?? 0) * Number(line?.costAmount ?? 0)
          : 0),
      ),
    );
    setSupplierIdDraft(String(line?.supplierId || row?.supplierId || ''));
    setMappedItemIdDraft(String(line?.mappedItemId || row?.itemId || ''));
  }, [line?.costAmount, line?.costTotalAmount, line?.mappedItemId, line?.movementUnit, line?.qtyEntry, line?.supplierId, line?.unitConsumption, line?.unitEntry, movementUnitInitial, row?.itemId, row?.supplierId]);

  useEffect(() => {
    if (fetcher.state !== 'idle') return;
    if (fetcher.data?.status !== 200) return;
    if (updatedLineId !== row?.lineId) return;
    navigate(returnTo);
  }, [fetcher.data, fetcher.state, navigate, returnTo, row?.lineId, updatedLineId]);

  useEffect(() => {
    if (rollbackFetcher.state !== 'idle') return;
    if (rollbackFetcher.data?.status !== 200) return;
    const rolledBackMovementId = String(rollbackFetcher.data?.payload?.rolledBackMovementId || '');
    if (rolledBackMovementId !== String(row?.id || '')) return;
    if (handledRollbackMovementIdRef.current === rolledBackMovementId) return;
    handledRollbackMovementIdRef.current = rolledBackMovementId;
    setHasRolledBackForEditing(true);
    revalidator.revalidate();
  }, [revalidator, rollbackFetcher.data, rollbackFetcher.state, row?.id]);

  useEffect(() => {
    handledRollbackMovementIdRef.current = null;
    setHasRolledBackForEditing(false);
  }, [row?.id]);

  if (!row || !line) return null;

  const selectedSupplier = supplierOptions.find((supplier) => supplier.id === supplierIdDraft) || null;
  const selectedMappedItem = itemOptions.find((item) => item.id === mappedItemIdDraft) || null;
  const importedIngredientName = String(line.ingredientName || '').trim();
  const supplierNameHiddenValue = selectedSupplier?.name || row.supplierName || line.supplierName || '';
  const supplierCnpjHiddenValue = selectedSupplier?.cnpj || row.supplierCnpj || line.supplierCnpj || '';
  const itemButtonLabel = selectedMappedItem
    ? `${selectedMappedItem.name} [${selectedMappedItem.classification || '-'}] (${getItemBaseUnit(selectedMappedItem)})`
    : 'Buscar item do sistema';
  const computedUnitCost =
    Number.isFinite(qtyEntryDraft) && qtyEntryDraft > 0 && Number.isFinite(costTotalAmountDraft)
      ? costTotalAmountDraft / qtyEntryDraft
      : NaN;
  const hasValidPricing = Number.isFinite(costTotalAmountDraft) && costTotalAmountDraft > 0 && Number.isFinite(computedUnitCost) && computedUnitCost > 0;

  const importSnapshot = {
    qtyEntry: line.qtyEntry,
    unitEntry: line.unitEntry,
    qtyConsumption: line.qtyConsumption,
    unitConsumption: line.unitConsumption,
    movementUnit: line.movementUnit,
    costAmount: line.costAmount,
    costTotalAmount: line.costTotalAmount,
    convertedCostAmount: line.convertedCostAmount,
    targetUnit: line.targetUnit,
  };

  return (
    <div className="space-y-5">
      {isActiveMovement ? (
        <div className="rounded-xl bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
          Esta movimentação já foi lançada no estoque e ainda não foi revertida. Você pode corrigir dados como data, documento, quantidade, custo e fornecedor, e tudo fica registrado na auditoria.
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Esta movimentação já foi revertida. Agora você pode remapear o item e ajustar a linha de origem mantendo a rastreabilidade da importação.
        </div>
      )}

      {fetcher.data?.message || rollbackFetcher.data?.message ? (
        <div className={`rounded-xl px-3 py-2 text-sm ${
          (rollbackFetcher.data?.status ?? fetcher.data?.status) >= 400 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {rollbackFetcher.data?.message || fetcher.data.message}
        </div>
      ) : null}

      <fetcher.Form method="post" action={actionPath} className="space-y-5">
        <input type="hidden" name="movementId" value={row.id} />
        <input type="hidden" name="batchId" value={row.batchId} />
        <input type="hidden" name="lineId" value={row.lineId} />
        <input type="hidden" name="supplierId" value={supplierIdDraft} />
        <input type="hidden" name="supplierName" value={supplierNameHiddenValue} />
        <input type="hidden" name="supplierCnpj" value={supplierCnpjHiddenValue} />
        <input type="hidden" name="ingredientName" value={importedIngredientName} />
        <input type="hidden" name="mappedItemId" value={mappedItemIdDraft} />
        <input type="hidden" name="unitEntry" value={movementUnitDraft} />
        <input type="hidden" name="qtyConsumption" value={qtyEntryDraft.toFixed(4)} />
        <input type="hidden" name="unitConsumption" value={movementUnitDraft} />
        <input type="hidden" name="costAmount" value={hasValidPricing ? computedUnitCost.toFixed(6) : ''} />

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950">Dados do lançamento</h2>
                <p className="text-sm text-slate-500">Edite a identificação da nota e a origem textual do movimento.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="movementAt">Data da movimentação</Label>
                  <Input id="movementAt" name="movementAt" type="datetime-local" defaultValue={formatDateTimeLocalValue(line.movementAt || row.movementAt)} disabled={isSubmitting} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invoiceNumber">Documento</Label>
                  <Input id="invoiceNumber" name="invoiceNumber" defaultValue={line.invoiceNumber || row.invoiceNumber || ''} disabled={isSubmitting} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Ingrediente / item do sistema</Label>
                  {canRemapItem ? (
                    <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemPickerOpen}
                          disabled={isSubmitting}
                          className="h-10 w-full justify-between bg-white font-normal"
                        >
                          <span className="truncate text-left">{itemButtonLabel}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[min(520px,calc(100vw-2rem))] p-0"
                        align="start"
                        side="bottom"
                        collisionPadding={16}
                      >
                        <Command>
                          <CommandInput placeholder="Buscar item do sistema..." />
                          <CommandList className="max-h-[min(45vh,320px)]">
                            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                            <CommandItem
                              value="sem item mapeado"
                              onSelect={() => {
                                setMappedItemIdDraft('');
                                setItemPickerOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', mappedItemIdDraft ? 'opacity-0' : 'opacity-100')} />
                              <span className="truncate">Sem item mapeado</span>
                            </CommandItem>
                            {itemOptions.map((item) => (
                              <CommandItem
                                key={item.id}
                                value={`${item.name} ${item.classification || ''} ${item.purchaseUm || ''} ${item.consumptionUm || ''} ${item.id}`}
                                onSelect={() => {
                                  setMappedItemIdDraft(item.id);
                                  setItemPickerOpen(false);
                                }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', mappedItemIdDraft === item.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                  <span className="truncate">
                                    {item.name} [{item.classification || '-'}] ({getItemBaseUnit(item)})
                                  </span>
                                  <Link
                                    to={`/admin/items/${item.id}/main`}
                                    className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                  >
                                    Abrir
                                  </Link>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div className="flex min-h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                      <span className="truncate">{itemButtonLabel}</span>
                    </div>
                  )}
                  <div className="space-y-1 text-xs text-slate-500">
                    <p>Origem importada: <span className="font-medium text-slate-700">{importedIngredientName || '-'}</span></p>
                    <p>O texto importado continua salvo para rastreabilidade.</p>
                    {!canRemapItem ? (
                      <p className="text-amber-700">
                        Item em somente leitura neste estado. Reverta a movimentação para trocar o item.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="motivo">Motivo</Label>
                  <Input id="motivo" name="motivo" defaultValue={line.motivo || ''} disabled={isSubmitting} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="identification">Identificação</Label>
                  <Input id="identification" name="identification" defaultValue={line.identification || ''} disabled={isSubmitting} />
                </div>
              </div>
              <Separator />
            </section>

            <section className="space-y-4">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950">Quantidade e custo</h2>
                <p className="text-sm text-slate-500">Informe o custo total da nota. O custo unitário é recalculado automaticamente com base na quantidade digitada.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="qtyEntry">Quantidade</Label>
                  <DecimalInput id="qtyEntry" name="qtyEntry" defaultValue={qtyEntryDraft} fractionDigits={4} className="w-full" onValueChange={setQtyEntryDraft} disabled={isSubmitting} />
                </div>
                <div className="space-y-1.5">
                  <Label>UM do movimento</Label>
                  <Select name="movementUnit" value={movementUnitDraft || '__EMPTY__'} onValueChange={(value) => setMovementUnitDraft(value === '__EMPTY__' ? '' : value)} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__EMPTY__">Sem unidade</SelectItem>
                      {resolvedUnitOptions.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="costTotalAmount">Custo total</Label>
                  <MoneyInput id="costTotalAmount" name="costTotalAmount" defaultValue={costTotalAmountDraft} className="h-10 w-full" onValueChange={setCostTotalAmountDraft} disabled={isSubmitting} />
                </div>
                <div className="rounded-xl bg-slate-50/80 px-4 py-3 2xl:col-span-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Custo unitário calculado</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {hasValidPricing ? formatMoney(computedUnitCost) : '-'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {hasValidPricing ? `por ${movementUnitDraft || 'unidade'}` : 'Preencha quantidade e custo total'}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Quantidade digitada</div>
                  <div className="text-sm font-medium text-slate-900">
                    {formatDecimal(qtyEntryDraft)} {movementUnitDraft || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo total informado</div>
                  <div className="text-sm font-medium text-slate-900">{formatMoney(costTotalAmountDraft)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Quantidade importada</div>
                  <div className="text-sm font-medium text-slate-900">
                    {formatNumber(importSnapshot.qtyEntry)} {importSnapshot.movementUnit || '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo importado</div>
                  <div className="text-sm font-medium text-slate-900">
                    {formatMoney(importSnapshot.costAmount)} / {importSnapshot.movementUnit || '-'}
                  </div>
                </div>
              </div>
              <Separator />
            </section>

            <section className="space-y-4">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950">Vínculos e observações</h2>
                <p className="text-sm text-slate-500">Associe o fornecedor e o item do sistema usados no processamento do custo.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-6">
                <div className="space-y-1.5 md:col-span-4">
                  <Label>Fornecedor informado</Label>
                  <Select value={supplierIdDraft || '__EMPTY__'} onValueChange={(value) => setSupplierIdDraft(value === '__EMPTY__' ? '' : value)} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__EMPTY__">Sem vínculo</SelectItem>
                      {supplierOptions.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name} {supplier.cnpj ? `• ${supplier.cnpj}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="manualConversionFactor">Fator manual</Label>
                  <Input id="manualConversionFactor" name="manualConversionFactor" defaultValue={line.manualConversionFactor ?? ''} disabled={isSubmitting} />
                </div>
                <div className="space-y-1.5 md:col-span-4">
                  <Label htmlFor="observation">Observação</Label>
                  <Textarea id="observation" name="observation" defaultValue={line.observation || ''} disabled={isSubmitting} className="min-h-[120px]" />
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo atual</div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div>
                  <span className="font-medium text-slate-900">Status:</span> {isActiveMovement ? 'Lançada no estoque' : 'Revertida'}{line.status ? ` • ${line.status}` : ''}
                </div>
                <div>
                  <span className="font-medium text-slate-900">Conversão:</span> {line.conversionSource || '-'}
                  {line.conversionFactorUsed ? ` • fator ${Number(line.conversionFactorUsed).toFixed(6)}` : ''}
                </div>
                <div>
                  <span className="font-medium text-slate-900">Custo convertido:</span> {formatMoney(line.convertedCostAmount)} / {line.targetUnit || '-'}
                </div>
                <div>
                  <span className="font-medium text-slate-900">Lote:</span>{' '}
                  <Link to={`/admin/import-stock-movements/${row.batchId}`} className="underline underline-offset-2">
                    {row.Batch?.name || row.batchId}
                  </Link>
                </div>
              </div>
              {line.errorMessage ? (
                <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  {line.errorMessage}
                </div>
              ) : null}
              <Separator />
            </section>

            {isActiveMovement ? (
              <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Trocar item</div>
                <p className="text-sm text-amber-900">
                  Se você precisa remapear esta linha para outro item, reverta a movimentação agora. Depois disso, a tela recarrega já liberando a troca do item.
                </p>
                <p className="text-xs text-amber-800">
                  Se o item atual já recebeu atualizações de custo depois desta importação, o sistema preserva o custo mais recente durante a reversão.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  className="w-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                  onClick={() => {
                    const formData = new FormData();
                    formData.set('_action', 'movement-rollback-line');
                    formData.set('movementId', String(row.id || ''));
                    formData.set('batchId', String(row.batchId || ''));
                    formData.set('lineId', String(row.lineId || ''));
                    rollbackFetcher.submit(formData, { method: 'post', action: actionPath });
                  }}
                >
                  {isRollingBack && rollbackAction === 'movement-rollback-line' ? 'Revertendo...' : 'Reverter agora para trocar o item'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  className="w-full border-rose-300 bg-white text-rose-900 hover:bg-rose-100"
                  onClick={() => {
                    const formData = new FormData();
                    formData.set('_action', 'movement-rollback-and-ignore-line');
                    formData.set('movementId', String(row.id || ''));
                    formData.set('batchId', String(row.batchId || ''));
                    formData.set('lineId', String(row.lineId || ''));
                    rollbackFetcher.submit(formData, { method: 'post', action: actionPath });
                  }}
                >
                  {isRollingBack && rollbackAction === 'movement-rollback-and-ignore-line'
                    ? 'Revertendo e ignorando...'
                    : 'Reverter e ignorar esta linha'}
                </Button>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Origem importada</div>
              <div className="mt-4 divide-y divide-slate-200/80">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Quantidade</div>
                  <div className="mt-1 pb-3 text-sm font-medium text-slate-900">
                    {formatNumber(importSnapshot.qtyEntry)} {importSnapshot.movementUnit || '-'}
                  </div>
                </div>
                <div className="pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo unitário</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatMoney(importSnapshot.costAmount)} / {importSnapshot.movementUnit || '-'}
                  </div>
                </div>
                <div className="pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo total</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatMoney(
                      Number.isFinite(Number(importSnapshot.costTotalAmount))
                        ? importSnapshot.costTotalAmount
                        : Number(importSnapshot.qtyEntry ?? 0) * Number(importSnapshot.costAmount ?? 0),
                    )}
                  </div>
                </div>
                <div className="pt-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Custo convertido</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatMoney(importSnapshot.convertedCostAmount)} / {importSnapshot.targetUnit || '-'}
                  </div>
                </div>
              </div>
              <Separator />
            </section>

            <div className="flex flex-col gap-2">
              <Link to={returnTo} className="inline-flex h-10 items-center justify-center rounded-md bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200">
                Voltar
              </Link>
              <Button type="submit" name="_action" value="movement-edit-line" disabled={isSubmitting || !hasValidPricing}>
                {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </aside>
        </div>
      </fetcher.Form>
    </div>
  );
}

function isActiveMovementDeleted(row: any) {
  return Boolean(row?.deletedAt);
}
