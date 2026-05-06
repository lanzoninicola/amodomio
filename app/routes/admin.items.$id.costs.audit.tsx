import { Link, useOutletContext } from "@remix-run/react";
import type { AdminItemOutletContext } from "./admin.items.$id";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const REASON_LABEL: Record<string, string> = {
  adjustment: "Ajuste",
  import: "Importação",
  import_rollback: "Reversão de importação",
  manual: "Manual",
  "item-cost-sheet": "Ficha de custo",
};

export default function AdminItemCostsAudit() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const auditRows: any[] = item._costAuditHistory || [];

  if (auditRows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center space-y-1">
        <div className="text-sm font-medium text-slate-500">Nenhuma alteração registrada</div>
        <div className="text-xs text-slate-400">
          Alterações em movimentos já importados aparecerão aqui com os valores antes e depois da correção.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-amber-800">O que é a auditoria?</div>
          <div className="text-xs text-amber-700">
            Cada vez que um movimento de estoque já importado é editado, o custo original é preservado aqui com o valor anterior e o novo valor.
            O histórico de custos mantém apenas 1 registro por movimento — limpo e sem duplicatas.
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Alterado em</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Custo antes</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Custo depois</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Variação</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 hidden sm:table-cell">Motivo</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 hidden sm:table-cell">Responsável</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Referência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditRows.map((row: any) => {
              const pct = row.costAmountBefore > 0
                ? ((row.costAmountAfter - row.costAmountBefore) / row.costAmountBefore) * 100
                : null;
              const pctLabel = pct != null
                ? `${pct >= 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                : null;
              const pctColor = pct == null ? "" : pct >= 0 ? "text-red-600" : "text-emerald-600";

              return (
                <tr key={row.id} className="align-top hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                    {new Date(row.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                    {BRL.format(row.costAmountBefore)}
                    {row.unitBefore ? <span className="ml-1 text-slate-400">{row.unitBefore}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-semibold text-slate-900">
                      {BRL.format(row.costAmountAfter)}
                      {row.unitAfter ? <span className="ml-1 font-normal text-slate-400">{row.unitAfter}</span> : null}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {pctLabel ? (
                      <span className={`font-semibold tabular-nums ${pctColor}`}>{pctLabel}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">
                    {REASON_LABEL[row.changeReason || ""] || row.changeReason || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">
                    {row.changedBy || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.referenceId && row.referenceType === "stock-movement" ? (
                      <Link
                        to={`/admin/stock-movements/${encodeURIComponent(row.referenceId)}?returnTo=${encodeURIComponent(`/admin/items/${item.id}/costs/audit`)}`}
                        className="text-blue-500 hover:underline"
                      >
                        ver movimento
                      </Link>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
