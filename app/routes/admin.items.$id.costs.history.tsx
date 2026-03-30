import { Link, useFetcher, useOutletContext } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { toast } from "~/components/ui/use-toast";
import { getItemCostSourceLabel } from "~/domain/costs/item-cost-sources";
import type { AdminItemOutletContext } from "./admin.items.$id";
import { useEffect } from "react";

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

export default function AdminItemCostsHistory() {
  const { item, costMetrics, averageWindowDays } = useOutletContext<AdminItemOutletContext>();
  const recalculateFetcher = useFetcher<any>();
  const [showInfo, setShowInfo] = useState(false);

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

  return (
    <div className="space-y-4">
      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />

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
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500"></th>
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
                    ) : (c.referenceType === "stock-movement" || c.referenceType === "stock-movement-delete") && c.referenceId ? (
                      <Link
                        to={
                          isImportMovementEntry(c)
                            ? `/admin/stock-movements/${encodeURIComponent(c.referenceId)}?returnTo=${encodeURIComponent(`/admin/items/${item.id}/costs/history`)}`
                            : `/admin/stock-movements?movementId=${encodeURIComponent(c.referenceId)}`
                        }
                        className="text-blue-500 hover:underline"
                      >
                        {c.referenceType === "stock-movement-delete" ? "eliminado" : isImportMovementEntry(c) ? "ver movimento" : "abrir movimento"}
                      </Link>
                    ) : null}
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
