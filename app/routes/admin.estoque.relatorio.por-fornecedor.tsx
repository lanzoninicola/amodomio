import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useFetcher, useLoaderData, useNavigate } from '@remix-run/react';
import { Check, Copy, Package, Send, ShoppingCart, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { SearchableSelect } from '~/components/ui/searchable-select';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getSupplierNameFromMetadata } from '~/domain/item/item-cost-monitoring.server';
import { settingPrismaEntity } from '~/domain/setting/setting.prisma.entity.server';
import { sendTextMessage } from '~/domain/z-api/zapi.service.server';
import { normalizePhone } from '~/domain/z-api/zapi.service';
import { ok } from '~/utils/http-response.server';

export const meta: MetaFunction = () => [{ title: 'Admin | Relatório por Fornecedor' }];

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function fmtMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? BRL.format(n) : '-';
}

function fmtDate(v: unknown) {
  if (!v) return '-';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function buildOrderMessage(supplierName: string, items: { name: string; qty: string; unit: string | null }[]) {
  const date = new Date().toLocaleDateString('pt-BR');
  const lines = items.map((item) => {
    const qty = item.qty.trim();
    const unit = item.unit ? ` ${item.unit}` : '';
    return `• ${item.name} — ${qty}${unit}`;
  });
  return `📦 *Pedido de compra - ${supplierName}*\nData: ${date}\n\n${lines.join('\n')}`;
}

// ─── Loader ─────────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const supplierId = url.searchParams.get('supplierId') || '';

  const db = itemPrismaEntity.client as any;

  const [suppliers, testPhoneSetting] = await Promise.all([
    db.supplier.findMany({
      select: { id: true, name: true, cnpj: true, contactName: true, email: true, phoneNumber: true },
      orderBy: [{ name: 'asc' }],
    }),
    settingPrismaEntity.findByOptionName('pedido-compra.test-phone'),
  ]);

  let itemRows: {
    itemId: string;
    itemName: string;
    consumptionUm: string | null;
    lastCost: number | null;
    lastCostUnit: string | null;
    lastMovementAt: Date | null;
    totalMovements: number;
    otherSupplierCosts: { supplierName: string; costAmount: number; unit: string | null }[];
  }[] = [];

  let selectedSupplier: (typeof suppliers)[0] | null = null;

  if (supplierId) {
    selectedSupplier = suppliers.find((s: any) => s.id === supplierId) ?? null;

    const movements = await db.stockMovement.findMany({
      where: { supplierId, direction: 'entry', deletedAt: null },
      select: {
        itemId: true,
        newCostAtImport: true,
        newCostUnitAtImport: true,
        movementAt: true,
        Item: { select: { id: true, name: true, consumptionUm: true } },
      },
      orderBy: { movementAt: 'desc' },
    });

    const itemMap = new Map<string, typeof itemRows[0]>();
    for (const m of movements) {
      if (!m.itemId) continue;
      if (!itemMap.has(m.itemId)) {
        itemMap.set(m.itemId, {
          itemId: m.itemId,
          itemName: m.Item?.name ?? m.itemId,
          consumptionUm: m.Item?.consumptionUm ?? null,
          lastCost: m.newCostAtImport ?? null,
          lastCostUnit: m.newCostUnitAtImport ?? null,
          lastMovementAt: m.movementAt ?? null,
          totalMovements: 1,
          otherSupplierCosts: [],
        });
      } else {
        itemMap.get(m.itemId)!.totalMovements++;
      }
    }

    const itemIds = Array.from(itemMap.keys());
    if (itemIds.length > 0) {
      const variations = await db.itemVariation.findMany({
        where: { itemId: { in: itemIds }, deletedAt: null },
        select: {
          itemId: true,
          ItemCostVariationHistory: {
            select: { costAmount: true, unit: true, validFrom: true, createdAt: true, metadata: true },
            orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
            take: 200,
          },
        },
      });

      const currentSupplierNameLower = selectedSupplier?.name?.trim().toLowerCase() ?? '';
      for (const variation of variations) {
        const suppliersForItem = new Map<string, { costAmount: number; unit: string | null; date: number }>();
        for (const row of variation.ItemCostVariationHistory) {
          const supplierName = getSupplierNameFromMetadata(row.metadata);
          if (!supplierName) continue;
          const rowDate = (row.validFrom ? new Date(row.validFrom) : row.createdAt ? new Date(row.createdAt) : new Date(0)).getTime();
          const existing = suppliersForItem.get(supplierName);
          if (!existing || rowDate > existing.date) {
            suppliersForItem.set(supplierName, { costAmount: Number(row.costAmount || 0), unit: row.unit ?? null, date: rowDate });
          }
        }
        const others = Array.from(suppliersForItem.entries())
          .filter(([name]) => name.trim().toLowerCase() !== currentSupplierNameLower)
          .map(([supplierName, { costAmount, unit }]) => ({ supplierName, costAmount, unit }))
          .sort((a, b) => a.costAmount - b.costAmount);
        const row = itemMap.get(variation.itemId);
        if (row) row.otherSupplierCosts = others;
      }
    }

    itemRows = Array.from(itemMap.values()).sort((a, b) =>
      a.itemName.localeCompare(b.itemName, 'pt-BR'),
    );
  }

  return ok({ suppliers, selectedSupplier, itemRows, supplierId, testPhone: testPhoneSetting?.value ?? null });
}

// ─── Action ─────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get('_intent') || '');
  const message = String(form.get('message') || '');
  const phone = String(form.get('phone') || '');

  try {
    if (intent === 'send-order' || intent === 'send-test') {
      const normalized = normalizePhone(phone);
      if (!normalized) return json({ ok: false, error: 'Número de telefone inválido.' });
      await sendTextMessage({ phone: normalized, message });
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Ação inválida.' });
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? 'Erro ao enviar mensagem.' });
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type OrderItem = { itemId: string; itemName: string; unit: string | null; qty: string };

// ─── Component ──────────────────────────────────────────────────────────────

export default function EstoqueRelatorioPorFornecedor() {
  const { payload } = useLoaderData<typeof loader>();
  const { suppliers, selectedSupplier, itemRows, supplierId, testPhone } = payload as any;
  const navigate = useNavigate();
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Wizard: 'idle' | 'quantities' | 'confirm'
  const [wizardStep, setWizardStep] = useState<'idle' | 'quantities' | 'confirm'>('idle');
  const [wizardItems, setWizardItems] = useState<OrderItem[]>([]);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [currentQty, setCurrentQty] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set());
    setWizardStep('idle');
  }, [supplierId]);

  const supplierOptions = (suppliers as any[]).map((s: any) => ({
    value: s.id,
    label: s.name,
    searchText: `${s.name} ${s.cnpj ?? ''}`,
  }));

  function toggleItem(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === (itemRows as any[]).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((itemRows as any[]).map((r: any) => r.itemId)));
    }
  }

  function startWizard() {
    const items: OrderItem[] = (itemRows as any[])
      .filter((r: any) => selectedIds.has(r.itemId))
      .map((r: any) => ({ itemId: r.itemId, itemName: r.itemName, unit: r.consumptionUm, qty: '' }));
    setWizardItems(items);
    setWizardIndex(0);
    setCurrentQty('');
    setWizardStep('quantities');
  }

  function advanceWizard() {
    const updated = wizardItems.map((item, i) =>
      i === wizardIndex ? { ...item, qty: currentQty } : item,
    );
    setWizardItems(updated);
    if (wizardIndex < wizardItems.length - 1) {
      setWizardIndex(wizardIndex + 1);
      setCurrentQty('');
    } else {
      setWizardStep('confirm');
    }
  }

  function closeWizard() {
    setWizardStep('idle');
    setWizardIndex(0);
    setCurrentQty('');
    setWizardItems([]);
  }

  const orderMessage = wizardStep === 'confirm'
    ? buildOrderMessage(selectedSupplier?.name ?? '', wizardItems)
    : '';

  function copyMessage() {
    navigator.clipboard.writeText(orderMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function sendOrder(phone: string, intent: string) {
    const formData = new FormData();
    formData.set('_intent', intent);
    formData.set('phone', phone);
    formData.set('message', orderMessage);
    fetcher.submit(formData, { method: 'post' });
  }

  const isSending = fetcher.state !== 'idle';
  const sendResult = fetcher.data;
  const allSelected = (itemRows as any[]).length > 0 && selectedIds.size === (itemRows as any[]).length;

  return (
    <div className="flex flex-col gap-6 py-6 px-4 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900">Análise de estoque por fornecedor</h1>
        <p className="text-sm text-slate-500">
          Selecione um fornecedor para ver os itens fornecidos e o último custo registrado.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Fornecedor</span>
        <SearchableSelect
          value={supplierId}
          onValueChange={(value) => navigate(`?supplierId=${value}`)}
          options={supplierOptions}
          placeholder="Selecionar fornecedor..."
          searchPlaceholder="Buscar fornecedor..."
          emptyText="Nenhum fornecedor encontrado."
          triggerClassName="min-w-[420px] max-w-[560px]"
        />
      </div>

      {/* Supplier info card */}
      {selectedSupplier && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 flex flex-wrap gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Fornecedor</div>
            <div className="text-sm font-semibold text-slate-900">{selectedSupplier.name}</div>
            {selectedSupplier.cnpj && (
              <div className="text-xs text-slate-500 mt-0.5">CNPJ: {selectedSupplier.cnpj}</div>
            )}
          </div>
          {selectedSupplier.contactName && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Contato</div>
              <div className="text-sm text-slate-700">{selectedSupplier.contactName}</div>
            </div>
          )}
          {selectedSupplier.phoneNumber && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Telefone</div>
              <div className="text-sm text-slate-700">{selectedSupplier.phoneNumber}</div>
            </div>
          )}
          {selectedSupplier.email && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">E-mail</div>
              <div className="text-sm text-slate-700">{selectedSupplier.email}</div>
            </div>
          )}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Itens fornecidos</div>
            <div className="text-sm font-semibold text-slate-900">{(itemRows as any[]).length}</div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {supplierId && (itemRows as any[]).length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
          <Package size={32} strokeWidth={1.5} />
          <span className="text-sm">Nenhuma movimentação de entrada encontrada para este fornecedor.</span>
        </div>
      )}

      {/* Items table */}
      {(itemRows as any[]).length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ShoppingCart size={15} />
              <span>
                {selectedIds.size > 0
                  ? `${selectedIds.size} ${selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}`
                  : 'Selecione itens para criar um pedido de compra.'}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={startWizard}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Send size={14} />
                Criar pedido de compra
              </button>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-8 text-center">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        allSelected ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white'
                      }`}
                      title={allSelected ? 'Desselecionar todos' : 'Selecionar todos'}
                    >
                      {allSelected && <Check size={11} />}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Item</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Unidade</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Último custo</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Outros fornecedores</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Última compra</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">Nº compras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(itemRows as any[]).map((row: any) => {
                  const isSelected = selectedIds.has(row.itemId);
                  return (
                    <TableRow
                      key={row.itemId}
                      onClick={() => toggleItem(row.itemId)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleItem(row.itemId)}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                            isSelected ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check size={11} />}
                        </button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={`/admin/items/${row.itemId}`}
                          className="font-medium text-sm text-slate-900 underline-offset-2 hover:underline"
                        >
                          {row.itemName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.consumptionUm ? (
                          <Badge variant="outline" className="text-xs font-normal border-slate-200 text-slate-600">
                            {row.consumptionUm}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.lastCost != null ? (
                          <span className="font-medium text-slate-900">
                            {fmtMoney(row.lastCost)}
                            {row.lastCostUnit && (
                              <span className="text-slate-400 font-normal ml-1">/ {row.lastCostUnit}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.otherSupplierCosts?.length > 0 ? (
                          <div className="space-y-0.5">
                            {row.otherSupplierCosts.map((other: any) => (
                              <p key={other.supplierName} className="text-xs text-slate-500 leading-tight">
                                {fmtMoney(other.costAmount)}{' '}
                                <span className="text-slate-400">({other.supplierName})</span>
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{fmtDate(row.lastMovementAt)}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">
                        {row.totalMovements}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Empty state — no supplier selected */}
      {!supplierId && (
        <div className="flex flex-col items-center gap-2 py-20 text-slate-400">
          <ShoppingCart size={36} strokeWidth={1.2} />
          <span className="text-sm">Selecione um fornecedor para ver os itens.</span>
        </div>
      )}

      {/* ── Wizard Modal ──────────────────────────────────────────── */}
      {wizardStep !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white px-6 py-5 shadow-2xl">

            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {wizardStep === 'quantities'
                  ? `Item ${wizardIndex + 1} de ${wizardItems.length}`
                  : 'Pedido pronto'}
              </p>
              <button type="button" onClick={closeWizard} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Step: quantity per item */}
            {wizardStep === 'quantities' && wizardItems[wizardIndex] && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Item</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{wizardItems[wizardIndex].itemName}</p>
                  {wizardItems[wizardIndex].unit && (
                    <p className="text-xs text-slate-400">Unidade: {wizardItems[wizardIndex].unit}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                    Quantidade
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ex.: 10"
                    value={currentQty}
                    onChange={(e) => setCurrentQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && currentQty.trim()) advanceWizard(); }}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={!currentQty.trim()}
                  onClick={advanceWizard}
                  className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-40 hover:bg-slate-800"
                >
                  {wizardIndex < wizardItems.length - 1 ? 'Avançar →' : 'Concluir'}
                </button>
              </div>
            )}

            {/* Step: confirm & send */}
            {wizardStep === 'confirm' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pedido para</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{selectedSupplier?.name}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans leading-relaxed">
                    {orderMessage}
                  </pre>
                </div>

                {sendResult && (
                  <p className={`text-sm font-medium ${sendResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {sendResult.ok ? '✅ Mensagem enviada!' : `❌ ${sendResult.error}`}
                  </p>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={copyMessage}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Copy size={14} />
                    {copied ? 'Copiado!' : 'Copiar mensagem'}
                  </button>

                  <button
                    type="button"
                    disabled={isSending || !selectedSupplier?.phoneNumber}
                    onClick={() => sendOrder(selectedSupplier.phoneNumber, 'send-order')}
                    title={!selectedSupplier?.phoneNumber ? 'Fornecedor sem número cadastrado' : undefined}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-green-700"
                  >
                    <Send size={14} />
                    {isSending ? 'Enviando...' : 'Enviar mensagem'}
                  </button>

                  <button
                    type="button"
                    disabled={isSending || !testPhone}
                    onClick={() => sendOrder(testPhone, 'send-test')}
                    title={!testPhone ? 'Configure o número de teste nas configurações globais (pedido-compra.test-phone)' : `Enviar para ${testPhone}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Enviar mensagem de teste
                    {testPhone && <span className="text-[11px] text-slate-400">({testPhone})</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
