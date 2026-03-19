import { Link, useOutletContext } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import type { AdminItemOutletContext } from "./admin.items.$id";

export default function AdminItemCostSheetsTab() {
  const { item } = useOutletContext<AdminItemOutletContext>();
  const rawSheets = item.ItemCostSheet || [];
  const groupedSheets = Array.from(
    rawSheets.reduce((map: Map<string, any[]>, sheet: any) => {
      const key = String(sheet.baseItemCostSheetId || sheet.id || "");
      if (!key) return map;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(sheet);
      return map;
    }, new Map<string, any[]>()).values()
  ).map((sheetGroup: any[]) => {
    const rootSheet =
      sheetGroup.find((sheet) => !sheet.baseItemCostSheetId) ||
      sheetGroup.find((sheet) => sheet.ItemVariation?.isReference && sheet.ItemVariation?.Variation?.code !== "base") ||
      sheetGroup[0];

    return {
      id: rootSheet.id,
      name: rootSheet.name,
      isActive: sheetGroup.some((sheet) => Boolean(sheet.isActive)),
      variationCount: sheetGroup.length,
      updatedAt: sheetGroup.reduce((latest, sheet) => {
        const current = new Date(sheet.updatedAt || 0);
        return current > latest ? current : latest;
      }, new Date(rootSheet.updatedAt || 0)),
    };
  });

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Fichas técnicas de custo</h2>
          <p className="text-sm text-slate-600">
            {groupedSheets.length} ficha(s) vinculada(s) a este item. Cada ficha agrupa os tamanhos ativos vinculados ao item.
          </p>
        </div>
        <Button asChild type="button" className="rounded-full bg-slate-900 text-white hover:bg-slate-800">
          <Link to={`/admin/item-cost-sheets/new?itemId=${item.id}`}>Criar ficha de custo</Link>
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {groupedSheets.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma ficha de custo vinculada a este item.</p>
        ) : (
          groupedSheets.map((sheet: any) => (
            <div key={sheet.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{sheet.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {sheet.variationCount} tamanho(s) nesta ficha
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    sheet.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {sheet.isActive ? "Ativa" : "Rascunho"}
                </span>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Atualizada em {new Date(sheet.updatedAt).toLocaleString("pt-BR")}
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  to={`/admin/item-cost-sheets/${sheet.id}`}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Abrir ficha
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
