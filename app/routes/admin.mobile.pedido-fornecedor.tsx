import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useFetcher, useLoaderData, useNavigation } from '@remix-run/react';
import { Check, ChevronRight, Copy, Package, Search, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { itemPrismaEntity } from '~/domain/item/item.prisma.entity.server';
import { getSupplierNameFromMetadata } from '~/domain/item/item-cost-monitoring.server';
import { settingPrismaEntity } from '~/domain/setting/setting.prisma.entity.server';
import { sendTextMessage } from '~/domain/z-api/zapi.service.server';
import { normalizePhone } from '~/domain/z-api/zapi.service';
import { ok } from '~/utils/http-response.server';

export const meta: MetaFunction = () => [{ title: 'Admin Mobile | Pedido por fornecedor' }];

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
      select: { id: true, name: true, phoneNumber: true },
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

  let selectedSupplier: { id: string; name: string; phoneNumber: string | null } | null = null;

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

  return ok({
    suppliers,
    selectedSupplier,
    itemRows,
    supplierId,
    testPhone: testPhoneSetting?.value ?? null,
  });
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
      if (!normalized) {
        return json({ ok: false, error: 'Número de telefone inválido.' });
      }
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

export default function AdminMobilePedidoFornecedor() {
  const { payload } = useLoaderData<typeof loader>();
  const { suppliers, selectedSupplier, itemRows, supplierId, testPhone } = payload as any;
  const navigation = useNavigation();
  const isLoading = navigation.state !== 'idle';
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();

  const [filterQuery, setFilterQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Wizard state: 'idle' | 'quantities' | 'confirm'
  const [wizardStep, setWizardStep] = useState<'idle' | 'quantities' | 'confirm'>('idle');
  const [wizardItems, setWizardItems] = useState<OrderItem[]>([]);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [currentQty, setCurrentQty] = useState('');
  const [copied, setCopied] = useState(false);

  // Reset selection when supplier changes
  useEffect(() => {
    setSelectedIds(new Set());
    setWizardStep('idle');
  }, [supplierId]);

  const visibleSuppliers = filterQuery.trim()
    ? (suppliers as any[]).filter((s: any) =>
        s.name.toLowerCase().includes(filterQuery.trim().toLowerCase()),
      )
    : (suppliers as any[]);

  const visibleItems = itemQuery.trim()
    ? (itemRows as any[]).filter((r: any) =>
        r.itemName.toLowerCase().includes(itemQuery.trim().toLowerCase()),
      )
    : (itemRows as any[]);

  function toggleItem(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
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

  return (
    <div className="space-y-4 pb-8">

      {/* ── Supplier selector ────────────────────────────────────── */}
      {!supplierId ? (
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Fornecedor</span>
          <div className="mt-2 flex items-center gap-2 border-b border-slate-200 pb-3">
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar fornecedor..."
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-900 placeholder:text-slate-400"
              autoFocus
            />
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </span>
          </div>
        </label>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fornecedor</p>
            <p className="text-base font-semibold text-slate-900">{selectedSupplier?.name}</p>
            {selectedSupplier?.phoneNumber && (
              <p className="text-xs text-slate-500">{selectedSupplier.phoneNumber}</p>
            )}
          </div>
          <Link
            to="?"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            Trocar
          </Link>
        </div>
      )}

      {/* ── Supplier list ────────────────────────────────────────── */}
      {!supplierId && (
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {visibleSuppliers.length} fornecedor{visibleSuppliers.length !== 1 ? 'es' : ''}
          </p>
          <div className="space-y-1">
            {visibleSuppliers.map((s: any) => (
              <Link
                key={s.id}
                to={`?supplierId=${s.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-900">{s.name}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {supplierId && !isLoading && itemRows.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
          <Package size={32} strokeWidth={1.5} />
          <p className="text-sm">Nenhuma entrada encontrada para este fornecedor.</p>
        </div>
      )}

      {/* ── Items list ───────────────────────────────────────────── */}
      {supplierId && itemRows.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="Buscar item..."
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-slate-900 placeholder:text-slate-400"
            />
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-4 w-4" />
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'itens'}
            {itemQuery.trim() ? (
              <> para <span className="font-semibold text-slate-900">"{itemQuery}"</span></>
            ) : (
              <> de <span className="font-semibold text-slate-900">{selectedSupplier?.name}</span></>
            )}
          </p>

          <div className="space-y-2">
            {visibleItems.map((row: any) => {
              const isSelected = selectedIds.has(row.itemId);
              return (
                <article
                  key={row.itemId}
                  onClick={() => toggleItem(row.itemId)}
                  className={`rounded-xl border bg-white px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'border-green-500 bg-green-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {/* Checkbox visual */}
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                        <Link
                          to={`/admin/items/${row.itemId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-semibold leading-tight text-slate-900 underline-offset-2 hover:underline"
                        >
                          {row.itemName}
                        </Link>
                      </div>
                      <p className="mt-0.5 pl-7 text-[11px] text-slate-400">
                        Última compra: {fmtDate(row.lastMovementAt)}
                        {row.totalMovements > 1 && (
                          <span className="ml-2 text-slate-300">· {row.totalMovements}x</span>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold leading-none text-slate-900">
                        {fmtMoney(row.lastCost)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {row.consumptionUm || row.lastCostUnit || ''}
                      </p>
                      {row.otherSupplierCosts?.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {row.otherSupplierCosts.map((other: any) => (
                            <p key={other.supplierName} className="text-[11px] text-slate-400 leading-tight">
                              {fmtMoney(other.costAmount)}{' '}
                              <span className="text-slate-300">({other.supplierName})</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── Floating CTA ─────────────────────────────────────── */}
          {selectedIds.size > 0 && (
            <div className="sticky bottom-4 z-10 flex justify-center">
              <button
                type="button"
                onClick={startWizard}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-xl"
              >
                <Send className="h-4 w-4" />
                Criar pedido de compra ({selectedIds.size} {selectedIds.size === 1 ? 'item' : 'itens'})
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Wizard Modal ─────────────────────────────────────────── */}
      {wizardStep !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl">

            {/* Close button */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {wizardStep === 'quantities' ? `${wizardIndex + 1} / ${wizardItems.length}` : 'Pedido pronto'}
              </p>
              <button type="button" onClick={closeWizard} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Step: quantity per item ── */}
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
                    inputMode="decimal"
                    autoFocus
                    placeholder="Ex.: 10"
                    value={currentQty}
                    onChange={(e) => setCurrentQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && currentQty.trim()) advanceWizard(); }}
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 text-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={!currentQty.trim()}
                  onClick={advanceWizard}
                  className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {wizardIndex < wizardItems.length - 1 ? 'Avançar →' : 'Concluir'}
                </button>
              </div>
            )}

            {/* ── Step: confirm & send ── */}
            {wizardStep === 'confirm' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pedido para</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{selectedSupplier?.name}</p>
                </div>

                {/* Message preview */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans leading-relaxed">
                    {orderMessage}
                  </pre>
                </div>

                {/* Send result */}
                {sendResult && (
                  <p className={`text-sm font-medium ${sendResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {sendResult.ok ? '✅ Mensagem enviada!' : `❌ ${sendResult.error}`}
                  </p>
                )}

                <div className="space-y-2">
                  {/* Copy */}
                  <button
                    type="button"
                    onClick={copyMessage}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? 'Copiado!' : 'Copiar mensagem'}
                  </button>

                  {/* Send to supplier */}
                  <button
                    type="button"
                    disabled={isSending || !selectedSupplier?.phoneNumber}
                    onClick={() => sendOrder(selectedSupplier.phoneNumber, 'send-order')}
                    title={!selectedSupplier?.phoneNumber ? 'Fornecedor sem número cadastrado' : undefined}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {isSending ? 'Enviando...' : 'Enviar mensagem'}
                  </button>

                  {/* Send test */}
                  <button
                    type="button"
                    disabled={isSending || !testPhone}
                    onClick={() => sendOrder(testPhone, 'send-test')}
                    title={!testPhone ? 'Configure o número de teste nas configurações globais (pedido-compra.test-phone)' : `Enviar para ${testPhone}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-600 disabled:opacity-40"
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
