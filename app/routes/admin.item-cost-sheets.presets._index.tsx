import { Link, useOutletContext } from "@remix-run/react";
import type { ItemCostSheetPresetsOutletContext } from "./admin.item-cost-sheets.presets";

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function presetVariationText(preset: {
  variationLabel?: string | null;
  variationCode?: string | null;
  variationKind?: string | null;
}) {
  if (!preset.variationLabel) return "Todas as variacoes da ficha";
  return [preset.variationLabel, preset.variationCode, preset.variationKind].filter(Boolean).join(" · ");
}

export default function AdminItemCostSheetPresetsIndex() {
  const { presets } = useOutletContext<ItemCostSheetPresetsOutletContext>();

  return (
    <div className="space-y-3">
      {presets.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
          Nenhum preset cadastrado.
        </div>
      ) : (
        presets.map((preset) => (
          <Link
            key={preset.id}
            to={`/admin/item-cost-sheets/presets/${preset.id}`}
            className="block rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:bg-slate-50/60"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-semibold text-slate-950">{preset.name}</div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {preset.type === "labor" ? "Mao de obra" : "Custo manual"}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-mono">{preset.key}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {presetVariationText(preset)}
                </div>
              </div>
              <div className="grid gap-1 text-right text-sm">
                <div className="font-mono font-semibold text-slate-900">{formatMoney(preset.unitCostAmount)}</div>
                <div className="text-slate-500">
                  {preset.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {preset.unit || ""}
                </div>
                <div className="text-slate-500">Perda {preset.wastePerc.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%</div>
              </div>
            </div>
            {preset.notes ? (
              <div className="mt-3 text-sm text-slate-500">{preset.notes}</div>
            ) : null}
          </Link>
        ))
      )}
    </div>
  );
}
