import { useOutletContext } from "@remix-run/react";
import { formatCompactMoney, type AdminItemCostSheetDetailOutletContext } from "./admin.item-cost-sheets.$id";

export default function AdminItemCostSheetOutrosTab() {
  const {
    selectedSheet,
    deletionGuard,
    selectedSheetDependencyCount,
    recipeReferenceCount,
    sheetReferenceCount,
    operationalCostCount,
    totalSheetCost,
  } = useOutletContext<AdminItemCostSheetDetailOutletContext>();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-950">Metadados da ficha</h3>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <div className="text-xs text-slate-400">Nome</div>
            <div className="mt-1 font-medium text-slate-900">{selectedSheet?.name || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Custo consolidado</div>
            <div className="mt-1 font-medium text-slate-900">{formatCompactMoney(totalSheetCost)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Dependencias</div>
            <div className="mt-1 font-medium text-slate-900">{selectedSheetDependencyCount}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-950">Resumo tecnico</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-xs text-slate-400">Receitas</div>
            <div className="mt-1 font-medium text-slate-900">{recipeReferenceCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Fichas referenciadas</div>
            <div className="mt-1 font-medium text-slate-900">{sheetReferenceCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Custos operacionais</div>
            <div className="mt-1 font-medium text-slate-900">{operationalCostCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Pode eliminar?</div>
            <div className="mt-1 font-medium text-slate-900">{deletionGuard.canDelete ? "Sim" : "Nao"}</div>
          </div>
        </div>

        {!deletionGuard.canDelete && deletionGuard.reason ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {deletionGuard.reason}
          </div>
        ) : null}
      </section>
    </div>
  );
}
