import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { toast } from "~/components/ui/use-toast";
import {
  addComponentToItemCostSheets,
  getItemCostSheetBatchToolOptions,
  type BatchComponentType,
  type BatchSheetOption,
} from "~/domain/costs/item-cost-sheet-batch-tool.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export async function loader({ request: _request }: LoaderFunctionArgs) {
  const options = await getItemCostSheetBatchToolOptions();
  return ok({ options });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const rootSheetIds = formData
      .getAll("rootSheetIds")
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const componentType = String(formData.get("componentType") || "manual") as BatchComponentType;
    const result = await addComponentToItemCostSheets({
      rootSheetIds,
      componentType,
      recipeId: String(formData.get("recipeId") || "").trim(),
      refSheetId: String(formData.get("refSheetId") || "").trim(),
      presetId: String(formData.get("presetId") || "").trim(),
      name: String(formData.get("name") || "").trim(),
      unit: String(formData.get("unit") || "").trim(),
      quantity: formData.get("quantity"),
      unitCostAmount: formData.get("unitCostAmount"),
      wastePerc: formData.get("wastePerc"),
      notes: String(formData.get("notes") || "").trim(),
    });

    return ok({
      result,
      message: `${result.changed} ficha(s) atualizada(s), ${result.skipped} ignorada(s), ${result.errors} erro(s)`,
    });
  } catch (error) {
    if (error instanceof Error) return badRequest(error.message);
    return serverError(error);
  }
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function AdminItemCostSheetsBatchAddPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { options } = loaderData.payload;
  const submitting = navigation.state === "submitting";

  const [sheetFilter, setSheetFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [activeFilter, setActiveFilter] = useState("__all__");
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>([]);
  const [componentType, setComponentType] = useState<BatchComponentType>("manual");
  const [presetId, setPresetId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [refSheetId, setRefSheetId] = useState("");
  const [unit, setUnit] = useState(options.unitOptions[0] || "UN");

  useEffect(() => {
    if (!actionData?.status) return;
    toast({
      title: actionData.status >= 400 ? "Erro" : "Sucesso",
      description: actionData.message,
    });
  }, [actionData]);

  const itemOptions = useMemo(
    () =>
      options.items.map((item: { id: string; name: string; categoryName: string | null }) => ({
        value: item.id,
        label: item.name,
        searchText: `${item.name} ${item.categoryName || ""}`,
      })),
    [options.items]
  );
  const sheetOptions = useMemo(
    () =>
      options.rootSheets.map((sheet: BatchSheetOption) => ({
        value: sheet.id,
        label: `${sheet.itemName} · ${sheet.name}`,
        searchText: `${sheet.itemName} ${sheet.name} ${sheet.categoryName || ""}`,
      })),
    [options.rootSheets]
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(options.rootSheets.map((sheet: BatchSheetOption) => sheet.categoryName).filter(Boolean))
      )
        .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"))
        .map((category) => ({
          value: String(category),
          label: String(category),
        })),
    [options.rootSheets]
  );
  const recipeOptions = useMemo(
    () =>
      options.recipes.map((recipe: { id: string; name: string; itemName: string | null }) => ({
        value: recipe.id,
        label: recipe.name,
        searchText: `${recipe.name} ${recipe.itemName || ""}`,
      })),
    [options.recipes]
  );
  const referenceSheetOptions = useMemo(
    () =>
      options.referenceSheets
        .filter((sheet: BatchSheetOption) => !selectedSheetIds.includes(sheet.id))
        .map((sheet: BatchSheetOption) => ({
          value: sheet.id,
          label: `${sheet.itemName} · ${sheet.name}`,
          searchText: `${sheet.itemName} ${sheet.name}`,
        })),
    [options.referenceSheets, selectedSheetIds]
  );
  const presetOptions = useMemo(
    () =>
      options.presets
        .filter((preset: { type: BatchComponentType }) => preset.type === componentType)
        .map((preset: { id: string; name: string; unit: string | null }) => ({
          value: preset.id,
          label: preset.name,
          searchText: `${preset.name} ${preset.unit || ""}`,
        })),
    [componentType, options.presets]
  );
  const filteredSheets = useMemo(
    () =>
      options.rootSheets.filter((sheet: BatchSheetOption) => {
        if (sheetFilter && sheet.id !== sheetFilter) return false;
        if (itemFilter && sheet.itemId !== itemFilter) return false;
        if (categoryFilter !== "__all__" && (sheet.categoryName || "") !== categoryFilter) return false;
        if (activeFilter === "__active__" && !sheet.isActive) return false;
        if (activeFilter === "__inactive__" && sheet.isActive) return false;
        return true;
      }),
    [activeFilter, categoryFilter, itemFilter, options.rootSheets, sheetFilter]
  );
  const allFilteredSelected =
    filteredSheets.length > 0 &&
    filteredSheets.every((sheet: BatchSheetOption) => selectedSheetIds.includes(sheet.id));
  const result = actionData?.payload?.result || null;

  useEffect(() => {
    setSelectedSheetIds((current) =>
      current.filter((id) => filteredSheets.some((sheet: BatchSheetOption) => sheet.id === id))
    );
  }, [filteredSheets]);

  function toggleSheet(sheetId: string, checked: boolean) {
    setSelectedSheetIds((current) => {
      if (checked) return current.includes(sheetId) ? current : [...current, sheetId];
      return current.filter((id) => id !== sheetId);
    });
  }

  function toggleAllFiltered(checked: boolean) {
    setSelectedSheetIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredSheets.map((sheet: BatchSheetOption) => sheet.id)]));
      }
      return current.filter((id) => !filteredSheets.some((sheet: BatchSheetOption) => sheet.id === id));
    });
  }

  return (
    <div className="space-y-6">
      <Form method="post" className="space-y-5 ">
        {selectedSheetIds.map((sheetId) => (
          <input key={sheetId} type="hidden" name="rootSheetIds" value={sheetId} />
        ))}
        <input type="hidden" name="componentType" value={componentType} />

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de componente</label>
            <Select
              value={componentType}
              onValueChange={(value) => {
                setComponentType(value as BatchComponentType);
                setPresetId("");
                setRecipeId("");
                setRefSheetId("");
              }}
            >
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Custo manual</SelectItem>
                <SelectItem value="labor">Mão de obra</SelectItem>
                <SelectItem value="recipe">Receita</SelectItem>
                <SelectItem value="recipeSheet">Ficha de custo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {componentType === "recipe" ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Receita</label>
              <SearchableSelect
                value={recipeId}
                onValueChange={setRecipeId}
                options={recipeOptions}
                placeholder="Selecionar receita"
                triggerClassName="w-[340px]"
                contentClassName="w-[440px]"
              />
              <input type="hidden" name="recipeId" value={recipeId} />
            </div>
          ) : null}

          {componentType === "recipeSheet" ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha referenciada</label>
              <SearchableSelect
                value={refSheetId}
                onValueChange={setRefSheetId}
                options={referenceSheetOptions}
                placeholder="Selecionar ficha"
                triggerClassName="w-[380px]"
                contentClassName="w-[520px]"
              />
              <input type="hidden" name="refSheetId" value={refSheetId} />
            </div>
          ) : null}

          {componentType === "manual" || componentType === "labor" ? (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Preset</label>
                <SearchableSelect
                  value={presetId}
                  onValueChange={setPresetId}
                  options={presetOptions}
                  placeholder="Personalizado"
                  triggerClassName="w-[260px]"
                  contentClassName="w-[360px]"
                />
                <input type="hidden" name="presetId" value={presetId} />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</label>
                <input
                  name="name"
                  className="h-9 w-[260px] rounded-md border border-slate-200 px-3 text-sm"
                  placeholder={componentType === "labor" ? "Mão de obra" : "Ex.: embalagem"}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Unidade</label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.unitOptions.map((unitOption: string) => (
                      <SelectItem key={unitOption} value={unitOption}>
                        {unitOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="unit" value={unit} />
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Qtd.</label>
            <input
              name="quantity"
              defaultValue="1"
              className="h-9 w-[100px] rounded-md border border-slate-200 px-3 text-sm"
              inputMode="decimal"
            />
          </div>
          {componentType === "manual" || componentType === "labor" ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Custo un.</label>
              <input
                name="unitCostAmount"
                defaultValue="0"
                className="h-9 w-[120px] rounded-md border border-slate-200 px-3 text-sm"
                inputMode="decimal"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Perda %</label>
            <input
              name="wastePerc"
              defaultValue="0"
              className="h-9 w-[100px] rounded-md border border-slate-200 px-3 text-sm"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Observação</label>
          <textarea name="notes" rows={2} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={selectedSheetIds.length === 0 || submitting} className="gap-2">
            <Plus className="h-4 w-4" />
            {submitting ? "Aplicando..." : `Adicionar em ${selectedSheetIds.length} ficha(s)`}
          </Button>
          <span className="text-sm text-slate-500">Duplicidades são ignoradas por ficha.</span>
        </div>
      </Form>

      <section className="space-y-4 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha</label>
            <SearchableSelect
              value={sheetFilter}
              onValueChange={setSheetFilter}
              options={sheetOptions}
              placeholder="Todas as fichas"
              searchPlaceholder="Buscar ficha..."
              triggerClassName="w-[340px] max-w-[calc(100vw-2rem)]"
              contentClassName="w-[480px]"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Item vinculado</label>
            <SearchableSelect
              value={itemFilter}
              onValueChange={setItemFilter}
              options={itemOptions}
              placeholder="Todos os itens"
              searchPlaceholder="Buscar item..."
              triggerClassName="w-[320px] max-w-[calc(100vw-2rem)]"
              contentClassName="w-[420px]"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria do item</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ficha ativa</label>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                <SelectItem value="__active__">Ativas</SelectItem>
                <SelectItem value="__inactive__">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSheetFilter("");
              setItemFilter("");
              setCategoryFilter("__all__");
              setActiveFilter("__all__");
            }}
          >
            Limpar filtros
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
            {selectedSheetIds.length} ficha(s) selecionada(s)
          </Badge>
          <span className="text-sm text-slate-500">
            A lista fica fixa abaixo do formulário para revisão do lote selecionado.
          </span>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="max-h-[420px] overflow-auto">
            <Table className="min-w-[860px]">
              <TableHeader className="sticky top-0 z-10 bg-slate-50">
                <TableRow>
                  <TableHead className="w-[52px]">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={(checked) => toggleAllFiltered(checked === true)}
                      aria-label="Selecionar fichas filtradas"
                    />
                  </TableHead>
                  <TableHead>Ficha</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead>Variações</TableHead>
                  <TableHead>Componentes</TableHead>
                  <TableHead>Atualizada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">
                      Nenhuma ficha encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSheets.map((sheet: BatchSheetOption) => (
                    <TableRow key={sheet.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSheetIds.includes(sheet.id)}
                          onCheckedChange={(checked) => toggleSheet(sheet.id, checked === true)}
                          aria-label={`Selecionar ${sheet.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/item-cost-sheets/${sheet.id}/custos`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {sheet.name}
                        </Link>
                        <div className="text-xs text-slate-500">{sheet.id}</div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-800">{sheet.itemName}</TableCell>
                      <TableCell className="text-sm text-slate-600">{sheet.categoryName || "Sem categoria"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sheet.isActive ? "Ativa" : "Inativa"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sheet.variationCount} variação(ões)</Badge>
                      </TableCell>
                      <TableCell>{sheet.componentCount}</TableCell>
                      <TableCell className="text-sm text-slate-600">{formatDate(sheet.updatedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {result ? (
        <section className="space-y-3 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{result.changed} atualizada(s)</span>
            <span>·</span>
            <span>{result.skipped} ignorada(s)</span>
            <span>·</span>
            <span>{result.errors} erro(s)</span>
          </div>
          <div className="overflow-hidden border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ficha</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row: { rootSheetId: string; sheetName: string; itemName: string; status: string; message: string }) => (
                  <TableRow key={row.rootSheetId}>
                    <TableCell>{row.sheetName}</TableCell>
                    <TableCell>{row.itemName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
