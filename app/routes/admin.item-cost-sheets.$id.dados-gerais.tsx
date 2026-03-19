import { Form, useOutletContext } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  formatCompactMoney,
  formatMoney,
  variationLabel,
  type AdminItemCostSheetDetailOutletContext,
} from "./admin.item-cost-sheets.$id";

export default function AdminItemCostSheetDadosGeraisTab() {
  const {
    item,
    variationSheets,
    selectedSheet,
    totalsByVariationId,
    selectedSheetDependencyCount,
    recipeReferenceCount,
    sheetReferenceCount,
    operationalCostCount,
    totalComponents,
    totalSheetCost,
    detailPath,
  } = useOutletContext<AdminItemCostSheetDetailOutletContext>();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-8">
        <Form method="post" action={detailPath} className="space-y-6 border-b border-slate-100 pb-6">
          <input type="hidden" name="itemCostSheetId" value={selectedSheet?.id} />
          <input type="hidden" name="redirectTo" value={`${detailPath}/dados-gerais`} />

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sheet-name">Nome da ficha</Label>
              <Input id="sheet-name" name="name" defaultValue={selectedSheet?.name || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-item">Item vinculado</Label>
              <Input id="sheet-item" value={item?.name || "-"} readOnly className="bg-slate-50 text-slate-600" />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sheet-description">Descricao</Label>
              <Textarea
                id="sheet-description"
                name="description"
                defaultValue={selectedSheet?.description || ""}
                className="min-h-[110px]"
                placeholder="Descreva o objetivo ou uso desta ficha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-notes">Observacoes internas</Label>
              <Textarea
                id="sheet-notes"
                name="notes"
                defaultValue={selectedSheet?.notes || ""}
                className="min-h-[110px]"
                placeholder="Anotacoes internas da ficha"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sheet-active" className="text-sm font-medium text-slate-900">Ficha ativa</Label>
                  <p className="text-xs text-slate-500">Ativa ou desativa todas as variacoes pertencentes a este grupo de ficha.</p>
                </div>
                <Switch id="sheet-active" name="isActive" defaultChecked={variationSheets.some((sheet: any) => sheet.isActive)} />
              </div>
            </div>
            <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-400">Status atual</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {variationSheets.some((sheet: any) => sheet.isActive) ? "Ativa" : "Rascunho"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Custo consolidado</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{formatCompactMoney(totalSheetCost)}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" name="_action" value="item-cost-sheet-meta-update" className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800">
              Salvar dados gerais
            </Button>
          </div>
        </Form>

        <div className="grid gap-6 border-b border-slate-100 pb-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Tamanhos ativos</div>
            <div className="text-sm font-medium text-slate-900">{variationSheets.length}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Componentes</div>
            <div className="text-sm font-medium text-slate-900">{totalComponents}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Receitas</div>
            <div className="text-sm font-medium text-slate-900">{recipeReferenceCount}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Fichas vinculadas</div>
            <div className="text-sm font-medium text-slate-900">{sheetReferenceCount}</div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Dependencias</div>
            <div className="text-sm font-medium text-slate-900">{selectedSheetDependencyCount}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Custos operacionais</div>
            <div className="text-sm font-medium text-slate-900">{operationalCostCount}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Modelo</div>
            <div className="text-sm font-medium text-slate-900">Ficha unica por item</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">Edicao</div>
            <div className="text-sm font-medium text-slate-900">Por coluna e componente</div>
          </div>
        </div>
      </div>

      <aside className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resumo por variacao</div>
        <div className="mt-5 space-y-4">
          {variationSheets.map((sheet: any) => (
            <div key={sheet.id} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm shadow-slate-100/40">
              <div className="text-xs font-medium text-slate-400">{variationLabel(sheet)}</div>
              <div className="mt-1 text-base font-semibold text-slate-950">
                {formatMoney(Number(totalsByVariationId[String(sheet.itemVariationId)] || 0))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
