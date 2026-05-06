import { Link, useFetcher, useOutletContext } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import { getItemCostSourceLabel, ITEM_COST_SOURCE_OPTIONS } from "~/domain/costs/item-cost-sources";
import type { AdminItemOutletContext } from "./admin.items.$id";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getSupplierNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>).supplierName;
  return String(v || "").trim() || null;
}

function isComparisonOnly(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const r = metadata as Record<string, unknown>;
  return r.comparisonOnly === true || r.excludeFromMetrics === true;
}

function isImportMovementEntry(entry: any) {
  const metadata =
    entry?.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
      ? (entry.metadata as Record<string, unknown>)
      : {};
  return String(metadata.originType || "").trim().toLowerCase() === "import-line";
}

function isEditableManualEntry(entry: any) {
  const metadata =
    entry?.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
      ? (entry.metadata as Record<string, unknown>)
      : {};
  const originType = String(metadata.originType || "").trim().toLowerCase();
  if (originType === "item-cost-manual-entry" || originType === "item-cost-manual-entry-mobile") return true;

  const source = String(entry?.source || "").trim().toLowerCase();
  const referenceType = String(entry?.referenceType || "").trim().toLowerCase();
  if (source !== "manual") return false;
  if (!referenceType) return true;
  if (referenceType !== "stock-movement") return false;
  return !isImportMovementEntry(entry);
}

function getNotesFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  return String((metadata as Record<string, unknown>).notes || "").trim();
}

function formatDateTimeLocal(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function InfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de custos — como funciona</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Cada compra ou ajuste gera <strong>um registro</strong> em <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">ItemCostVariationHistory</code>.
            Edições no mesmo movimento de estoque <strong>atualizam o registro existente</strong> e gravam a mudança na tabela de auditoria — o histórico fica sempre limpo.
          </p>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Origens possíveis</p>
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600">Tipo de referência</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Origem</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Quando é criado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { ref: "stock-movement", src: "import", desc: "Import de lote aplicado. referenceId aponta para o StockMovement." },
                    { ref: "stock-movement", src: "manual", desc: "Registro manual via aba Levantamento. Também gera movimento canônico para auditoria." },
                    { ref: "stock-movement", src: "item-cost-sheet", desc: "Snapshot de ficha de custo publicado como evento canônico." },
                    { ref: "stock-movement", src: "adjustment", desc: "Correção operacional sobre movimento já existente, preservando rastreabilidade." },
                  ].map((row, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{row.ref}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.src}</td>
                      <td className="px-3 py-2 text-slate-500">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Status do registro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <div className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              comparação
            </div>
            <p className="mt-2 leading-relaxed">
              Esse badge indica que o levantamento foi salvo apenas para conferência histórica.
            </p>
          </div>
          <p>
            Registros marcados como <strong>comparação</strong> não alteram o custo vigente do item.
          </p>
          <p>
            Eles também ficam fora das métricas e do gráfico, mas continuam visíveis no histórico para auditoria e consulta.
          </p>
          <p>
            Quando o registro não tem badge, ele faz parte do fluxo normal de custo do item.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminItemCostsHistory() {
  const { item, costMetrics, averageWindowDays } = useOutletContext<AdminItemOutletContext>();
  const recalculateFetcher = useFetcher<any>();
  const manualEntryFetcher = useFetcher<any>();
  const [showInfo, setShowInfo] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<any | null>(null);
  const [costAmountDraft, setCostAmountDraft] = useState(0);
  const [sourceDraft, setSourceDraft] = useState("manual");
  const [unitDraft, setUnitDraft] = useState(referenceUnitFromItem(item, costMetrics));
  const [supplierNameDraft, setSupplierNameDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [validFromDraft, setValidFromDraft] = useState("");

  const history: any[] = item._itemCostVariationHistory || [];
  const referenceUnit = item.consumptionUm || item.purchaseUm || costMetrics?.latestCost?.unit || "";
  const latestSupplierName =
    history.map((r: any) => getSupplierNameFromMetadata(r?.metadata)).find(Boolean) || "";
  const actionUrl = `/admin/items/${item.id}`;

  useEffect(() => {
    if (recalculateFetcher.data?.status === 200) {
      toast({ title: "Recálculo concluído", description: recalculateFetcher.data.message || "Custos recalculados." });
    }
    if (recalculateFetcher.data?.status && recalculateFetcher.data.status >= 400) {
      toast({ title: "Erro no recálculo", description: recalculateFetcher.data.message || "Erro ao recalcular.", variant: "destructive" });
    }
  }, [recalculateFetcher.data]);

  useEffect(() => {
    if (editingEntry) {
      setCostAmountDraft(Number(editingEntry.costAmount || 0));
      setSourceDraft(String(editingEntry.source || "manual") || "manual");
      setUnitDraft(String(editingEntry.unit || referenceUnit || "").trim().toUpperCase());
      setSupplierNameDraft(getSupplierNameFromMetadata(editingEntry.metadata) || "");
      setNotesDraft(getNotesFromMetadata(editingEntry.metadata));
      setValidFromDraft(formatDateTimeLocal(editingEntry.validFrom));
    }
  }, [editingEntry, referenceUnit]);

  useEffect(() => {
    if (manualEntryFetcher.data?.status === 200) {
      const action = manualEntryFetcher.data?.payload?.action;
      toast({
        title: action === "item-cost-manual-delete" ? "Levantamento eliminado" : "Levantamento atualizado",
        description: manualEntryFetcher.data?.message || manualEntryFetcher.data?.payload?.message || "Operação concluída.",
      });
      setEditingEntry(null);
      setDeletingEntry(null);
    }
    if (manualEntryFetcher.data?.status && manualEntryFetcher.data.status >= 400) {
      toast({
        title: "Erro ao salvar levantamento",
        description: manualEntryFetcher.data?.message || "Não foi possível concluir a operação.",
        variant: "destructive",
      });
    }
  }, [manualEntryFetcher.data]);

  const unitOptions = Array.from(
    new Set(
      [referenceUnit, costMetrics?.latestCost?.unit, item.consumptionUm, item.purchaseUm, editingEntry?.unit, unitDraft]
        .map((value) => String(value || "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  return (
    <div className="space-y-4">
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />
      <StatusInfoModal open={showStatusInfo} onClose={() => setShowStatusInfo(false)} />
      <Dialog open={Boolean(editingEntry)} onOpenChange={(open) => { if (!open) setEditingEntry(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar levantamento manual</DialogTitle>
          </DialogHeader>
          <manualEntryFetcher.Form method="post" action={actionUrl} className="space-y-4">
            <input type="hidden" name="_action" value="item-cost-manual-update" />
            <input type="hidden" name="historyId" value={editingEntry?.id || ""} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Valor</div>
                <MoneyInput name="costAmount" defaultValue={costAmountDraft} onValueChange={setCostAmountDraft} className="w-full" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Unidade</div>
                <Select value={unitDraft} onValueChange={setUnitDraft}>
                  <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="unit" value={unitDraft} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Origem</div>
                <Select value={sourceDraft} onValueChange={setSourceDraft}>
                  <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                  <SelectContent>
                    {ITEM_COST_SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="source" value={sourceDraft} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Data</div>
                <Input name="validFrom" type="datetime-local" value={validFromDraft} onChange={(e) => setValidFromDraft(e.currentTarget.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500">Fornecedor</div>
              <Input name="supplierName" value={supplierNameDraft} onChange={(e) => setSupplierNameDraft(e.currentTarget.value)} placeholder="Fornecedor ou loja" />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500">Observação</div>
              <Input name="notes" value={notesDraft} onChange={(e) => setNotesDraft(e.currentTarget.value)} placeholder="Observação do levantamento" />
            </div>

            {isComparisonOnly(editingEntry?.metadata) ? (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Este registro continua marcado como somente comparação e permanece fora das métricas.
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingEntry(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={manualEntryFetcher.state !== "idle"}>
                {manualEntryFetcher.state !== "idle" ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </manualEntryFetcher.Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingEntry)} onOpenChange={(open) => { if (!open) setDeletingEntry(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar levantamento manual?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro será ocultado do histórico. Se ele for o custo vigente do item, o sistema restaura o custo anterior disponível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <manualEntryFetcher.Form method="post" action={actionUrl}>
              <input type="hidden" name="_action" value="item-cost-manual-delete" />
              <input type="hidden" name="historyId" value={deletingEntry?.id || ""} />
              <AlertDialogAction asChild>
                <Button type="submit" variant="destructive" disabled={manualEntryFetcher.state !== "idle"}>
                  {manualEntryFetcher.state !== "idle" ? "Eliminando..." : "Eliminar"}
                </Button>
              </AlertDialogAction>
            </manualEntryFetcher.Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registros</span>
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-600 transition-colors"
            title="Como funciona o histórico"
          >
            ?
          </button>
        </div>
        <recalculateFetcher.Form method="post" action={actionUrl}>
          <input type="hidden" name="_action" value="item-cost-recalculate" />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={recalculateFetcher.state !== "idle"}
            className="h-7 px-3 text-xs bg-slate-900 text-white hover:bg-slate-700 border-0"
          >
            {recalculateFetcher.state !== "idle" ? "Recalculando..." : "Recalcular custos"}
          </Button>
        </recalculateFetcher.Form>
      </div>

      {/* Metrics summary */}
      <div className="grid grid-cols-3 gap-x-4 rounded-xl bg-slate-50 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Último custo</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {costMetrics?.latestCostPerConsumptionUnit != null
              ? `${BRL.format(Number(costMetrics.latestCostPerConsumptionUnit))} /${referenceUnit}`.trim()
              : <span className="font-normal text-slate-400">—</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Custo médio ({averageWindowDays}d)</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">
            {costMetrics?.averageCostPerConsumptionUnit != null
              ? `${BRL.format(Number(costMetrics.averageCostPerConsumptionUnit))} /${item.consumptionUm || ""}`.trim()
              : <span className="font-normal text-slate-400">—</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Último fornecedor</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
            {latestSupplierName || <span className="font-normal text-slate-400">—</span>}
          </div>
        </div>
      </div>

      {/* History table */}
      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          Nenhum custo registrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Custo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Data</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">Origem</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Fornecedor</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                  <button
                    type="button"
                    onClick={() => setShowStatusInfo(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    title="Como funciona o status"
                  >
                    <span>Status</span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-400">
                      ?
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                    {BRL.format(Number(c.costAmount || 0))}
                    {c.unit ? <span className="ml-1 font-normal text-slate-400 text-xs">{c.unit}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(c.validFrom).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                    {getItemCostSourceLabel(c.source)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 truncate max-w-[160px]">
                    {getSupplierNameFromMetadata(c.metadata) || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {isComparisonOnly(c.metadata) ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">comparação</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    <div className="flex justify-end gap-1.5">
                      {(c.referenceType === "stock-movement" || c.referenceType === "stock-movement-delete") && c.referenceId ? (
                        <Button asChild type="button" variant="outline" size="sm" className="h-8 w-8 p-0" title={c.referenceType === "stock-movement-delete" ? "Movimentação eliminada" : isImportMovementEntry(c) ? "Ver movimentação" : "Abrir movimentação"}>
                          <Link
                            to={
                              isImportMovementEntry(c)
                                ? `/admin/stock-movements/${encodeURIComponent(c.referenceId)}?returnTo=${encodeURIComponent(`/admin/items/${item.id}/costs/history`)}`
                                : `/admin/stock-movements?movementId=${encodeURIComponent(c.referenceId)}`
                            }
                          >
                            <ExternalLink size={14} />
                          </Link>
                        </Button>
                      ) : null}
                      {isEditableManualEntry(c) ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar levantamento manual"
                            onClick={() => setEditingEntry(c)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                            title="Eliminar levantamento manual"
                            onClick={() => setDeletingEntry(c)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </>
                      ) : null}
                      {!(isEditableManualEntry(c) || ((c.referenceType === "stock-movement" || c.referenceType === "stock-movement-delete") && c.referenceId)) ? (
                        <span className="inline-flex h-8 items-center px-2 text-slate-300">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function referenceUnitFromItem(item: any, costMetrics: any) {
  return String(item?.consumptionUm || item?.purchaseUm || costMetrics?.latestCost?.unit || "").trim().toUpperCase();
}
