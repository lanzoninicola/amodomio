import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { DecimalInput } from "~/components/inputs/inputs";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { recipeEntity } from "~/domain/recipe/recipe.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok } from "~/utils/http-response.server";

const ITEM_CLASSIFICATIONS = [
  "insumo",
  "semi_acabado",
  "produto_final",
  "embalagem",
  "servico",
  "outro",
] as const;

const RECIPE_LINE_UNIT_FALLBACK_OPTIONS = ["UN", "L", "ML", "KG", "G"];

type RecipeVariationPolicy = "auto" | "hide" | "show";
type ItemRule = { shouldShowVariation: boolean };

function normalizeRecipeVariationPolicy(value: unknown): RecipeVariationPolicy {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (normalized === "hide" || normalized === "show" || normalized === "auto") return normalized;
  return "auto";
}

async function getRecipeLineUnitOptions(db: any) {
  const measurementUnitModel = db.measurementUnit;
  if (typeof measurementUnitModel?.findMany !== "function") return RECIPE_LINE_UNIT_FALLBACK_OPTIONS;

  try {
    const rows = await measurementUnitModel.findMany({
      where: { active: true },
      select: { code: true },
      orderBy: [{ code: "asc" }],
    });
    const merged = new Set<string>(RECIPE_LINE_UNIT_FALLBACK_OPTIONS);
    for (const row of rows || []) {
      const code = String(row?.code || "").trim().toUpperCase();
      if (code) merged.add(code);
    }
    return Array.from(merged);
  } catch {
    return RECIPE_LINE_UNIT_FALLBACK_OPTIONS;
  }
}

async function getItemRecipeVariationRule(db: any, itemId: string): Promise<ItemRule> {
  let itemPolicy: RecipeVariationPolicy = "auto";
  try {
    const item = await db.item.findUnique({
      where: { id: itemId },
      select: { recipeVariationPolicy: true },
    });
    itemPolicy = normalizeRecipeVariationPolicy(item?.recipeVariationPolicy);
  } catch {
    itemPolicy = "auto";
  }

  if (itemPolicy === "hide") return { shouldShowVariation: false };
  if (itemPolicy === "show") return { shouldShowVariation: true };

  const rows = await db.itemVariation.findMany({
    where: { itemId, deletedAt: null },
    select: {
      id: true,
      ItemCostVariation: { select: { costAmount: true, deletedAt: true } },
    },
  });
  const costs = new Set(
    (rows || [])
      .filter((r: any) => r.ItemCostVariation && !r.ItemCostVariation.deletedAt)
      .map((r: any) => Math.round(Number(r.ItemCostVariation.costAmount || 0) * 100))
  );
  const costedCount = (rows || []).filter((r: any) => r.ItemCostVariation && !r.ItemCostVariation.deletedAt).length;
  return { shouldShowVariation: costedCount > 1 && costs.size > 1 };
}

async function resolveRecipeLineCosts(db: any, itemId: string, variationId?: string | null) {
  if (!itemId) return { itemVariationId: null, lastUnitCostAmount: 0, avgUnitCostAmount: 0 };

  let itemVariation: any = null;
  if (variationId) {
    itemVariation = await itemVariationPrismaEntity.linkToItem({ itemId, variationId });
  } else {
    itemVariation = await db.itemVariation.findFirst({
      where: {
        itemId,
        deletedAt: null,
        Variation: { kind: "base", code: "base" },
      },
      include: { ItemCostVariation: true },
      orderBy: [{ createdAt: "asc" }],
    });
    if (!itemVariation) {
      itemVariation = await db.itemVariation.findFirst({
        where: { itemId, deletedAt: null },
        include: { ItemCostVariation: true },
        orderBy: [{ createdAt: "asc" }],
      });
    }
  }

  const itemVariationId = itemVariation?.id || null;
  const lastUnitCostAmount = Number(itemVariation?.ItemCostVariation?.costAmount || 0);
  let avgUnitCostAmount = lastUnitCostAmount;
  if (itemVariationId) {
    const historyRows = await db.itemCostVariationHistory.findMany({
      where: { itemVariationId },
      select: { costAmount: true },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    });
    if (historyRows.length > 0) {
      const sum = historyRows.reduce((acc: number, row: any) => acc + Number(row.costAmount || 0), 0);
      avgUnitCostAmount = sum / historyRows.length;
    }
  }
  return { itemVariationId, lastUnitCostAmount, avgUnitCostAmount };
}

function buildSnapshot(costInfo: { itemVariationId: string | null; lastUnitCostAmount: number; avgUnitCostAmount: number }, quantity: number) {
  return {
    itemVariationId: costInfo.itemVariationId,
    lastUnitCostAmount: Number(costInfo.lastUnitCostAmount || 0),
    avgUnitCostAmount: Number(costInfo.avgUnitCostAmount || 0),
    lastTotalCostAmount: Number(((costInfo.lastUnitCostAmount || 0) * quantity).toFixed(6)),
    avgTotalCostAmount: Number(((costInfo.avgUnitCostAmount || 0) * quantity).toFixed(6)),
  };
}

export async function loader({ params }: LoaderFunctionArgs) {
  const recipeId = String(params.id || "").trim();
  if (!recipeId) return badRequest("Receita inválida");

  const recipe = await recipeEntity.findById(recipeId);
  if (!recipe) return badRequest("Receita não encontrada");

  const db = prismaClient as any;
  const [items, categories, unitOptions, recipeLines] = await Promise.all([
    db.item.findMany({
      where: { active: true },
      select: { id: true, name: true, classification: true, categoryId: true, consumptionUm: true },
      orderBy: [{ name: "asc" }],
      take: 1000,
    }),
    db.category.findMany({
      where: { type: "item" },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
    getRecipeLineUnitOptions(db),
    typeof db.recipeLine?.findMany === "function"
      ? db.recipeLine.findMany({
        where: { recipeId },
        include: { Item: { select: { id: true, name: true } } },
        orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
        take: 50,
      })
      : [],
  ]);

  return ok({ recipe, items, categories, unitOptions, recipeLines });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const recipeId = String(params.id || "").trim();
  if (!recipeId) return badRequest("Receita inválida");

  const formData = await request.formData();
  const actionName = String(formData.get("_action") || "");
  if (actionName !== "recipe-lines-batch-add") return badRequest("Ação inválida");

  const payloadRaw = String(formData.get("linesPayload") || "[]");
  let lines: Array<{ itemId: string; unit: string; quantity: number }> = [];
  try {
    lines = JSON.parse(payloadRaw);
  } catch {
    return badRequest("Payload inválido");
  }

  const normalizedLines = (lines || [])
    .map((line) => ({
      itemId: String(line?.itemId || "").trim(),
      unit: String(line?.unit || "").trim().toUpperCase(),
      quantity: Number(line?.quantity || 0),
    }))
    .filter((line) => line.itemId && line.unit && Number.isFinite(line.quantity) && line.quantity > 0);

  if (normalizedLines.length === 0) return badRequest("Adicione ao menos uma linha válida");

  const db = prismaClient as any;
  if (typeof db.recipeLine?.create !== "function") {
    return badRequest("Tabela de composição da receita indisponível. Rode a migração Prisma.");
  }

  const baseIndex = await db.recipeLine.count({ where: { recipeId } });
  for (let i = 0; i < normalizedLines.length; i++) {
    const line = normalizedLines[i];
    const itemRule = await getItemRecipeVariationRule(db, line.itemId);
    const costInfo = await resolveRecipeLineCosts(db, line.itemId, itemRule.shouldShowVariation ? null : null);
    const snapshot = buildSnapshot(costInfo, line.quantity);
    await db.recipeLine.create({
      data: {
        recipeId,
        itemId: line.itemId,
        itemVariationId: snapshot.itemVariationId,
        unit: line.unit,
        quantity: line.quantity,
        lastUnitCostAmount: snapshot.lastUnitCostAmount,
        avgUnitCostAmount: snapshot.avgUnitCostAmount,
        lastTotalCostAmount: snapshot.lastTotalCostAmount,
        avgTotalCostAmount: snapshot.avgTotalCostAmount,
        sortOrderIndex: baseIndex + i,
      },
    });
  }

  return redirect(`/admin/recipes/${recipeId}/composition-builder`);
}

type DraftLine = { key: string; itemId: string; unit: string; quantity: number };

export default function RecipeCompositionBuilderRoute() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const navigation = useNavigation();
  const payload = loaderData?.payload || {};
  const recipe = payload.recipe;
  const items = (payload.items || []) as Array<{
    id: string;
    name: string;
    classification?: string | null;
    categoryId?: string | null;
    consumptionUm?: string | null;
  }>;
  const categories = (payload.categories || []) as Array<{ id: string; name: string }>;
  const unitOptions = (payload.unitOptions || RECIPE_LINE_UNIT_FALLBACK_OPTIONS) as string[];
  const recipeLines = (payload.recipeLines || []) as any[];

  const [q, setQ] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("__all__");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((item) => {
      if (classificationFilter !== "__all__" && item.classification !== classificationFilter) return false;
      if (categoryFilter !== "__all__" && item.categoryId !== categoryFilter) return false;
      if (!query) return true;
      return `${item.name || ""} ${item.classification || ""}`.toLowerCase().includes(query);
    });
  }, [items, q, classificationFilter, categoryFilter]);

  function toggleSelectItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  function addSelectedToDraft() {
    if (selectedIds.length === 0) return;
    setDraftLines((current) => {
      const existing = new Set(current.map((line) => line.itemId));
      const next = [...current];
      for (const itemId of selectedIds) {
        if (existing.has(itemId)) continue;
        const item = items.find((i) => i.id === itemId);
          next.push({
          key: `${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          itemId,
          unit: String(item?.consumptionUm || "").trim().toUpperCase(),
          quantity: 0,
        });
      }
      return next;
    });
    setSelectedIds([]);
  }

  function removeDraftLine(key: string) {
    setDraftLines((current) => current.filter((line) => line.key !== key));
  }

  function updateDraftLine(key: string, patch: Partial<DraftLine>) {
    setDraftLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const payloadLines = draftLines.map((line) => ({
    itemId: line.itemId,
    unit: line.unit,
    quantity: Number(line.quantity || 0),
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link to={`/admin/recipes/${recipe?.id}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
              <ChevronLeft className="h-3 w-3" />
              Voltar para receita
            </Link>
            <h1 className="mt-2 text-lg font-semibold text-slate-900">Montador de composição</h1>
            <p className="text-sm text-slate-600">{recipe?.name}</p>
          </div>
          <Link to={`/admin/recipes/${recipe?.id}`} className="text-sm underline">
            Tela completa da receita
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.45fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Itens</h2>
            <p className="text-xs text-slate-600">Filtre, selecione e envie para a composição.</p>
          </div>

          <div className="space-y-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item..." />
            <div className="grid grid-cols-2 gap-2">
              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger><SelectValue placeholder="Classificação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {ITEM_CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 h-[58vh] overflow-auto rounded-lg border border-slate-200">
            <div className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={checked}
                      onChange={() => toggleSelectItem(item.id)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name || "[sem nome]"}</p>
                      <p className="text-xs text-slate-500">
                        {item.classification || "sem classificação"}
                        {item.consumptionUm ? ` · UM ${String(item.consumptionUm).toUpperCase()}` : ""}
                      </p>
                    </div>
                  </label>
                );
              })}
              {filteredItems.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Nenhum item encontrado.</div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{selectedIds.length} selecionado(s)</p>
            <Button type="button" onClick={addSelectedToDraft} disabled={selectedIds.length === 0}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar selecionados
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Linhas para adicionar</h2>
              <p className="text-xs text-slate-600">Defina UM e quantidade. O custo será calculado ao salvar.</p>
            </div>
          </div>

          <Form method="post" className="space-y-3">
            <input type="hidden" name="_action" value="recipe-lines-batch-add" />
            <input type="hidden" name="linesPayload" value={JSON.stringify(payloadLines)} />

            <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">UM</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {draftLines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-500">
                        Selecione itens na coluna da esquerda.
                      </td>
                    </tr>
                  ) : (
                    draftLines.map((line) => {
                      const item = items.find((i) => i.id === line.itemId);
                      return (
                        <tr key={line.key} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">{item?.name || "[sem nome]"}</div>
                            <div className="text-xs text-slate-500">{item?.classification || "-"}</div>
                          </td>
                          <td className="px-3 py-2 min-w-[130px]">
                            <Select value={line.unit || "__empty__"} onValueChange={(v) => updateDraftLine(line.key, { unit: v === "__empty__" ? "" : v })}>
                              <SelectTrigger><SelectValue placeholder="UM" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Selecionar</SelectItem>
                                {unitOptions.map((u) => (
                                  <SelectItem key={`${line.key}-${u}`} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 min-w-[140px]">
                            <DecimalInput
                              defaultValue={line.quantity || 0}
                              fractionDigits={4}
                              className="w-full h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                              onValueChange={(value) => updateDraftLine(line.key, { quantity: Number(value || 0) })}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => removeDraftLine(line.key)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Já cadastrados na receita: <span className="font-semibold">{recipeLines.length}</span>
              </div>
              <Button type="submit" disabled={draftLines.length === 0 || navigation.state === "submitting"}>
                {navigation.state === "submitting" ? "Salvando..." : "Salvar linhas em lote"}
              </Button>
            </div>
          </Form>
        </section>
      </div>
    </div>
  );
}
