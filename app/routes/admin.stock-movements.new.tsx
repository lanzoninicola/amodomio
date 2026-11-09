import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { ChevronLeft, PlusCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getItemBaseUnit } from "~/components/admin/stock-movement-editor";
import { DecimalInput } from "~/components/inputs/inputs";
import Container from "~/components/layout/container/container";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "~/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { authenticator } from "~/domain/auth/google.server";
import { registerItemCostEvent } from "~/domain/costs/item-cost-event.server";
import { itemPrismaEntity } from "~/domain/item/item.prisma.entity.server";
import { itemVariationPrismaEntity } from "~/domain/item/item-variation.prisma.entity.server";
import { normalizeStockMovementDirection } from "~/domain/stock-movement/stock-movement-types";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [
  { title: "Admin | Novo movimento de estoque" },
];

type MovementLineDraft = {
  id: string;
  itemId: string;
  itemVariationId: string;
  unit: string;
  quantityAmount: string;
  unitCostAmount: string;
  costTotalAmount: string;
  manualConversionFactor: string;
};

function createMovementLineDraft(itemId = ""): MovementLineDraft {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    itemId,
    itemVariationId: "",
    unit: "",
    quantityAmount: "",
    unitCostAmount: "",
    costTotalAmount: "",
    manualConversionFactor: "",
  };
}

function lineFieldName(
  lineId: string,
  field: keyof Omit<MovementLineDraft, "id">
) {
  return `line:${lineId}:${field}`;
}

function str(value: FormDataEntryValue | string | null) {
  return String(value || "").trim();
}

function optionalSelectValue(value: FormDataEntryValue | null) {
  const normalized = str(value);
  return normalized && normalized !== "__none" ? normalized : null;
}

function normalizeUnit(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return normalized || null;
}

function getItemTargetUnit(item: any) {
  return normalizeUnit(item?.consumptionUm || item?.purchaseUm);
}

function parseDecimal(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function formatMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatFactor(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function findMeasurementConversion(
  measurementConversions: Array<{
    fromUnit: string;
    toUnit: string;
    factor: number;
  }>,
  fromUnit: string | null,
  toUnit: string | null
) {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return null;

  for (const row of measurementConversions) {
    const rowFrom = normalizeUnit(row?.fromUnit);
    const rowTo = normalizeUnit(row?.toUnit);
    const factor = Number(row?.factor ?? NaN);
    if (!rowFrom || !rowTo || !(factor > 0)) continue;
    if (rowFrom === fromUnit && rowTo === toUnit)
      return { factor, mode: "direct" as const };
    if (rowFrom === toUnit && rowTo === fromUnit)
      return { factor, mode: "reverse" as const };
  }

  return null;
}

function resolveConvertedCostPreview(params: {
  costAmount: number | null;
  movementUnit: string | null;
  selectedItem: any;
  manualConversionFactor: unknown;
  measurementConversions: Array<{
    fromUnit: string;
    toUnit: string;
    factor: number;
  }>;
}) {
  const costAmount = Number(params.costAmount);
  const movementUnit = normalizeUnit(params.movementUnit);
  const targetUnit = getItemTargetUnit(params.selectedItem);
  if (
    !Number.isFinite(costAmount) ||
    costAmount <= 0 ||
    !movementUnit ||
    !targetUnit
  )
    return null;

  if (movementUnit === targetUnit) {
    return {
      convertedCostAmount: costAmount,
      targetUnit,
      conversionSource: "same-unit",
      conversionFactorUsed: 1,
    };
  }

  const manualFactor = parseDecimal(params.manualConversionFactor);
  if (manualFactor > 0) {
    return {
      convertedCostAmount: costAmount / manualFactor,
      targetUnit,
      conversionSource: "manual",
      conversionFactorUsed: manualFactor,
    };
  }

  const itemConsumptionUm = normalizeUnit(params.selectedItem?.consumptionUm);
  const itemPurchaseUm = normalizeUnit(params.selectedItem?.purchaseUm);
  const itemConversions: Array<{
    purchaseUm?: string | null;
    factor?: number | null;
  }> = Array.isArray(params.selectedItem?.ItemPurchaseConversion)
    ? params.selectedItem.ItemPurchaseConversion
    : [];
  const matchedConversion = itemConversions.find(
    (conversion) => normalizeUnit(conversion?.purchaseUm) === movementUnit
  );
  const matchedFactor = Number(matchedConversion?.factor ?? NaN);

  if (
    matchedConversion &&
    itemConsumptionUm &&
    targetUnit === itemConsumptionUm &&
    matchedFactor > 0
  ) {
    return {
      convertedCostAmount: costAmount / matchedFactor,
      targetUnit,
      conversionSource: "item_purchase_factor",
      conversionFactorUsed: matchedFactor,
    };
  }

  const itemFactor = Number(
    params.selectedItem?.purchaseToConsumptionFactor ?? NaN
  );
  if (itemPurchaseUm && itemConsumptionUm && itemFactor > 0) {
    if (movementUnit === itemPurchaseUm && targetUnit === itemConsumptionUm) {
      return {
        convertedCostAmount: costAmount / itemFactor,
        targetUnit,
        conversionSource: "item_purchase_factor",
        conversionFactorUsed: itemFactor,
      };
    }
    if (movementUnit === itemConsumptionUm && targetUnit === itemPurchaseUm) {
      return {
        convertedCostAmount: costAmount * itemFactor,
        targetUnit,
        conversionSource: "item_purchase_factor_reverse",
        conversionFactorUsed: itemFactor,
      };
    }
  }

  const measured = findMeasurementConversion(
    params.measurementConversions,
    movementUnit,
    targetUnit
  );
  if (measured) {
    return {
      convertedCostAmount:
        measured.mode === "direct"
          ? costAmount / measured.factor
          : costAmount * measured.factor,
      targetUnit,
      conversionSource:
        measured.mode === "direct"
          ? "measurement_conversion_direct"
          : "measurement_conversion_reverse",
      conversionFactorUsed: measured.factor,
    };
  }

  return null;
}

function getLinkedItemUnits(item: any) {
  if (!item) return [];
  const seen = new Set<string>();
  const units: string[] = [];
  for (const unit of [item.consumptionUm, item.purchaseUm]) {
    const normalized = normalizeUnit(unit);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    units.push(normalized);
  }
  for (const conversion of item.ItemPurchaseConversion ?? []) {
    const normalized = normalizeUnit(conversion?.purchaseUm);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    units.push(normalized);
  }
  return units;
}

function getItemVariationLabel(itemVariation: any) {
  const name = String(
    itemVariation?.Variation?.name || itemVariation?.Variation?.code || ""
  ).trim();
  const label = name || "Base";
  return itemVariation?.isReference ? `${label} · referência` : label;
}

function getItemVariationOptions(item: any): SearchableSelectOption[] {
  const variations = Array.isArray(item?.ItemVariation)
    ? item.ItemVariation
    : [];
  return variations
    .slice()
    .sort((a: any, b: any) => {
      if (a?.isReference && !b?.isReference) return -1;
      if (!a?.isReference && b?.isReference) return 1;
      return String(getItemVariationLabel(a)).localeCompare(
        String(getItemVariationLabel(b)),
        "pt-BR"
      );
    })
    .map((itemVariation: any) => ({
      value: itemVariation.id,
      label: getItemVariationLabel(itemVariation),
      searchText: [
        itemVariation?.Variation?.name,
        itemVariation?.Variation?.code,
        itemVariation?.isReference ? "referencia referência base" : "",
      ]
        .filter(Boolean)
        .join(" "),
    }));
}

function getDefaultItemVariationId(item: any) {
  const variations = Array.isArray(item?.ItemVariation)
    ? item.ItemVariation
    : [];
  return (
    variations.find((row: any) => row?.isReference)?.id ||
    variations[0]?.id ||
    ""
  );
}

function ItemUnitsSummary({ item }: { item: any | null }) {
  const unitRows = useMemo(() => {
    if (!item) return [];
    const rows: Array<{
      unit: string;
      explanation: string;
      highlight?: boolean;
    }> = [];
    const seen = new Set<string>();
    const baseUnit = normalizeUnit(item.consumptionUm);

    if (baseUnit) {
      rows.push({
        unit: baseUnit,
        explanation: "base do estoque",
        highlight: true,
      });
      seen.add(baseUnit);
    }

    const purchaseUnit = normalizeUnit(item.purchaseUm);
    if (purchaseUnit && !seen.has(purchaseUnit)) {
      const factor = Number(item.purchaseToConsumptionFactor ?? NaN);
      rows.push({
        unit: purchaseUnit,
        explanation:
          factor > 0 && baseUnit
            ? `1 ${purchaseUnit} = ${formatFactor(factor)} ${baseUnit}`
            : "sem fator",
      });
      seen.add(purchaseUnit);
    }

    for (const conversion of item.ItemPurchaseConversion ?? []) {
      const unit = normalizeUnit(conversion?.purchaseUm);
      if (!unit || seen.has(unit)) continue;
      const factor = Number(conversion?.factor ?? NaN);
      rows.push({
        unit,
        explanation:
          factor > 0 && baseUnit
            ? `1 ${unit} = ${formatFactor(factor)} ${baseUnit}`
            : "sem fator",
      });
      seen.add(unit);
    }

    return rows;
  }, [item]);

  return (
    <div className="min-w-0">
      {unitRows.length > 0 ? (
        <div className="pt-0.5">
          {unitRows.map((row) => (
            <div
              key={row.unit}
              className={`grid grid-cols-[52px_minmax(0,1fr)] gap-2 py-0.5 text-[11px] leading-tight ${
                row.highlight
                  ? "font-semibold text-slate-800"
                  : "text-slate-600"
              }`}
            >
              <div className="truncate">{row.unit}</div>
              <div className="truncate text-slate-500">{row.explanation}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] leading-snug text-slate-500">
          {item
            ? "Item sem UM configurada."
            : "Selecione um item para ver as UMs disponíveis."}
        </div>
      )}
    </div>
  );
}

function MovementItemLine({
  line,
  lineNumber,
  items,
  itemOptions,
  measurementConversions,
  canRemove,
  onChange,
  onRemove,
}: {
  line: MovementLineDraft;
  lineNumber: number;
  items: any[];
  itemOptions: SearchableSelectOption[];
  measurementConversions: Array<{
    fromUnit: string;
    toUnit: string;
    factor: number;
  }>;
  canRemove: boolean;
  onChange: (next: MovementLineDraft) => void;
  onRemove: () => void;
}) {
  const selectedItem = useMemo(
    () => items.find((item) => item.id === line.itemId) || null,
    [items, line.itemId]
  );
  const linkedUnitOptions = useMemo(
    () => getLinkedItemUnits(selectedItem),
    [selectedItem]
  );
  const variationOptions = useMemo(
    () => getItemVariationOptions(selectedItem),
    [selectedItem]
  );
  const derivedUnitCost = useMemo(() => {
    const total = parseDecimal(line.costTotalAmount);
    const qty = parseDecimal(line.quantityAmount);
    if (Number.isFinite(total) && total > 0 && Number.isFinite(qty) && qty > 0)
      return total / qty;
    return null;
  }, [line.costTotalAmount, line.quantityAmount]);
  const conversionPreview = useMemo(
    () =>
      resolveConvertedCostPreview({
        costAmount: derivedUnitCost,
        movementUnit: line.unit,
        selectedItem,
        manualConversionFactor: line.manualConversionFactor,
        measurementConversions,
      }),
    [
      derivedUnitCost,
      line.manualConversionFactor,
      line.unit,
      measurementConversions,
      selectedItem,
    ]
  );

  useEffect(() => {
    const nextUnit =
      selectedItem && (!line.unit || !linkedUnitOptions.includes(line.unit))
        ? linkedUnitOptions[0] || ""
        : line.unit;
    const validVariationIds = new Set(
      variationOptions.map((option) => option.value)
    );
    const nextItemVariationId =
      selectedItem &&
      (!line.itemVariationId || !validVariationIds.has(line.itemVariationId))
        ? getDefaultItemVariationId(selectedItem)
        : line.itemVariationId;

    if (!selectedItem) {
      if (line.unit || line.itemVariationId)
        onChange({ ...line, unit: "", itemVariationId: "" });
      return;
    }
    if (line.unit === nextUnit && line.itemVariationId === nextItemVariationId)
      return;
    onChange({ ...line, unit: nextUnit, itemVariationId: nextItemVariationId });
  }, [line, linkedUnitOptions, onChange, selectedItem, variationOptions]);

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <input type="hidden" name="lineId" value={line.id} />
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Item {lineNumber}
        </h3>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-slate-500"
            onClick={onRemove}
          >
            <Trash2 size={14} />
            Remover
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(180px,0.9fr)_100px_110px_130px_130px_110px] xl:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Item
          </label>
          <input
            type="hidden"
            name={lineFieldName(line.id, "itemId")}
            value={line.itemId}
          />
          <SearchableSelect
            value={line.itemId}
            onValueChange={(itemId) =>
              onChange({ ...line, itemId, itemVariationId: "", unit: "" })
            }
            options={itemOptions}
            placeholder="Selecionar item"
            searchPlaceholder="Buscar item..."
            emptyText="Nenhum item encontrado."
            triggerClassName="h-10 w-full max-w-none text-sm"
            contentClassName="w-[520px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Variação
          </label>
          <input
            type="hidden"
            name={lineFieldName(line.id, "itemVariationId")}
            value={line.itemVariationId}
          />
          <SearchableSelect
            value={line.itemVariationId}
            onValueChange={(itemVariationId) =>
              onChange({ ...line, itemVariationId })
            }
            options={variationOptions}
            placeholder={
              selectedItem ? "Selecionar variação" : "Selecione item"
            }
            searchPlaceholder="Buscar variação..."
            emptyText={
              selectedItem
                ? "Nenhuma variação ativa."
                : "Selecione um item primeiro."
            }
            triggerClassName="h-10 w-full max-w-none text-sm"
            contentClassName="w-[320px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            UM
          </label>
          <Select
            name={lineFieldName(line.id, "unit")}
            value={line.unit}
            onValueChange={(unit) => onChange({ ...line, unit })}
            required
            disabled={!selectedItem}
          >
            <SelectTrigger className="h-10 bg-white">
              <SelectValue placeholder="UM" />
            </SelectTrigger>
            <SelectContent>
              {linkedUnitOptions.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Qtd.
          </label>
          <DecimalInput
            name={lineFieldName(line.id, "quantityAmount")}
            defaultValue={parseDecimal(line.quantityAmount) || 0}
            onValueChange={(value) =>
              onChange({ ...line, quantityAmount: String(value) })
            }
            fractionDigits={3}
            placeholder="ex. 10"
            className="h-10 w-full bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Custo total
          </label>
          <DecimalInput
            name={lineFieldName(line.id, "costTotalAmount")}
            defaultValue={parseDecimal(line.costTotalAmount) || 0}
            onValueChange={(value) =>
              onChange({ ...line, costTotalAmount: String(value) })
            }
            fractionDigits={2}
            placeholder="opcional"
            className="h-10 w-full bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Custo unit.
          </label>
          <DecimalInput
            name={lineFieldName(line.id, "unitCostAmount")}
            defaultValue={derivedUnitCost ?? 0}
            fractionDigits={6}
            readOnly
            className="h-10 w-full bg-slate-50 text-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Fator
          </label>
          <input
            type="hidden"
            name={lineFieldName(line.id, "manualConversionFactor")}
            value=""
          />
          <DecimalInput
            name={`${lineFieldName(line.id, "manualConversionFactor")}:preview`}
            defaultValue={conversionPreview?.conversionFactorUsed ?? 0}
            fractionDigits={4}
            readOnly
            className="h-10 w-full bg-slate-50 text-slate-500"
          />
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-200 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Tabela de UM
          </div>
          <ItemUnitsSummary item={selectedItem} />
        </div>
        <div className="text-[11px] leading-tight text-slate-500">
          <div className="font-medium text-slate-700">Custo convertido</div>
          <div className="mt-1">
            {conversionPreview
              ? `${formatMoney(conversionPreview.convertedCostAmount)} / ${
                  conversionPreview.targetUnit
                }`
              : "Preencha item, UM e custo."}
          </div>
          {conversionPreview?.conversionFactorUsed ? (
            <div className="mt-0.5">
              {conversionPreview.conversionSource} · fator{" "}
              {formatFactor(conversionPreview.conversionFactorUsed)}
            </div>
          ) : null}
          {derivedUnitCost != null ? (
            <div className="mt-0.5">
              movimento: {formatMoney(derivedUnitCost)} / {line.unit || "-"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function parseDateTimeLocal(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = str(value).replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function defaultDateTimeLocalValue() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const itemId = str(url.searchParams.get("itemId"));
    const db = itemPrismaEntity.client as any;
    const [items, suppliers, measurementConversionsRaw] = await Promise.all([
      db.item.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          classification: true,
          purchaseUm: true,
          consumptionUm: true,
          purchaseToConsumptionFactor: true,
          ItemPurchaseConversion: {
            select: { purchaseUm: true, factor: true },
          },
          ItemVariation: {
            where: { deletedAt: null },
            select: {
              id: true,
              isReference: true,
              variationId: true,
              Variation: { select: { id: true, name: true, code: true } },
            },
            orderBy: [{ createdAt: "asc" }],
          },
        },
        orderBy: [{ name: "asc" }],
        take: 2000,
      }),
      typeof db.supplier?.findMany === "function"
        ? db.supplier.findMany({
            select: { id: true, name: true, cnpj: true },
            orderBy: [{ name: "asc" }],
            take: 2000,
          })
        : [],
      typeof db.measurementUnitConversion?.findMany === "function"
        ? db.measurementUnitConversion.findMany({
            where: { active: true },
            select: {
              factor: true,
              FromUnit: { select: { code: true } },
              ToUnit: { select: { code: true } },
            },
          })
        : [],
    ]);
    const measurementConversions = (
      measurementConversionsRaw as Array<{
        factor: number;
        FromUnit?: { code?: string | null } | null;
        ToUnit?: { code?: string | null } | null;
      }>
    )
      .map((row) => ({
        fromUnit: String(row.FromUnit?.code || "").toUpperCase(),
        toUnit: String(row.ToUnit?.code || "").toUpperCase(),
        factor: Number(row.factor),
      }))
      .filter(
        (row) =>
          row.fromUnit &&
          row.toUnit &&
          Number.isFinite(row.factor) &&
          row.factor > 0
      );

    return ok({
      items,
      suppliers,
      measurementConversions,
      defaultItemId: itemId,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    if (!user) return badRequest("Não autenticado");

    const formData = await request.formData();
    const movementAtRaw = str(formData.get("movementAt"));
    const movementAt = movementAtRaw
      ? parseDateTimeLocal(movementAtRaw)
      : new Date();
    if (movementAtRaw && !movementAt)
      return badRequest("Data da movimentação inválida");

    const db = itemPrismaEntity.client as any;
    const measurementConversionsRaw =
      typeof db.measurementUnitConversion?.findMany === "function"
        ? await db.measurementUnitConversion.findMany({
            where: { active: true },
            select: {
              factor: true,
              FromUnit: { select: { code: true } },
              ToUnit: { select: { code: true } },
            },
          })
        : [];
    const measurementConversions = (
      measurementConversionsRaw as Array<{
        factor: number;
        FromUnit?: { code?: string | null } | null;
        ToUnit?: { code?: string | null } | null;
      }>
    )
      .map((row) => ({
        fromUnit: String(row.FromUnit?.code || "").toUpperCase(),
        toUnit: String(row.ToUnit?.code || "").toUpperCase(),
        factor: Number(row.factor),
      }))
      .filter(
        (row) =>
          row.fromUnit &&
          row.toUnit &&
          Number.isFinite(row.factor) &&
          row.factor > 0
      );

    const supplierId = optionalSelectValue(formData.get("supplierId"));
    const supplier =
      supplierId && typeof db.supplier?.findUnique === "function"
        ? await db.supplier.findUnique({
            where: { id: supplierId },
            select: { id: true, name: true, cnpj: true },
          })
        : null;
    const actor = String(
      (user as any)?.email || (user as any)?.name || "admin"
    );
    const lineIds = formData
      .getAll("lineId")
      .map((value) => str(value))
      .filter(Boolean);
    if (lineIds.length === 0)
      return badRequest("Adicione ao menos uma linha de item");

    const movementInputs: Parameters<typeof registerItemCostEvent>[0][] = [];
    for (const [index, lineId] of lineIds.entries()) {
      const lineNumber = index + 1;
      const itemId = str(formData.get(lineFieldName(lineId, "itemId")));
      if (!itemId)
        return badRequest(`Item é obrigatório na linha ${lineNumber}`);
      const requestedItemVariationId = str(
        formData.get(lineFieldName(lineId, "itemVariationId"))
      );

      const quantityAmount = optionalNumber(
        formData.get(lineFieldName(lineId, "quantityAmount"))
      );
      if (Number.isNaN(quantityAmount))
        return badRequest(`Quantidade inválida na linha ${lineNumber}`);

      const costTotalAmount = optionalNumber(
        formData.get(lineFieldName(lineId, "costTotalAmount"))
      );
      if (Number.isNaN(costTotalAmount))
        return badRequest(`Custo total inválido na linha ${lineNumber}`);

      const rawUnitCost = optionalNumber(
        formData.get(lineFieldName(lineId, "unitCostAmount"))
      );
      if (Number.isNaN(rawUnitCost))
        return badRequest(`Custo unitário inválido na linha ${lineNumber}`);

      const unitCostAmount =
        costTotalAmount != null &&
        quantityAmount != null &&
        Number.isFinite(Number(costTotalAmount)) &&
        Number.isFinite(Number(quantityAmount)) &&
        Number(quantityAmount) > 0
          ? Number(costTotalAmount) / Number(quantityAmount)
          : rawUnitCost;
      if (!Number.isFinite(unitCostAmount) || Number(unitCostAmount) <= 0) {
        return badRequest(
          `Informe custo unitário maior que zero ou quantidade com custo total na linha ${lineNumber}`
        );
      }

      const unit = normalizeUnit(formData.get(lineFieldName(lineId, "unit")));
      if (!unit)
        return badRequest(
          `UM da movimentação é obrigatória na linha ${lineNumber}`
        );

      const item = await db.item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          purchaseUm: true,
          consumptionUm: true,
          purchaseToConsumptionFactor: true,
          ItemPurchaseConversion: {
            select: { purchaseUm: true, factor: true },
          },
          ItemVariation: {
            where: { deletedAt: null },
            select: {
              id: true,
              itemId: true,
              isReference: true,
              variationId: true,
              Variation: { select: { id: true, name: true, code: true } },
            },
            orderBy: [{ createdAt: "asc" }],
          },
        },
      });
      if (!item) return badRequest(`Item inválido na linha ${lineNumber}`);
      const availableUnits = getLinkedItemUnits(item);
      if (!availableUnits.includes(unit))
        return badRequest(
          `UM da movimentação inválida para este item na linha ${lineNumber}`
        );

      let itemVariations = Array.isArray(item.ItemVariation)
        ? item.ItemVariation
        : [];
      if (itemVariations.length === 0) {
        const ensuredVariation =
          await itemVariationPrismaEntity.findPrimaryVariationForItem(itemId, {
            ensureBaseIfMissing: true,
          });
        itemVariations = ensuredVariation ? [ensuredVariation] : [];
      }
      const itemVariation = requestedItemVariationId
        ? itemVariations.find((row: any) => row.id === requestedItemVariationId)
        : itemVariations.length === 1
        ? itemVariations[0]
        : itemVariations.find((row: any) => row.isReference);
      if (requestedItemVariationId && !itemVariation)
        return badRequest(
          `Variação inválida para este item na linha ${lineNumber}`
        );
      if (!itemVariation?.id)
        return badRequest(
          `Nenhuma variação disponível para registrar o movimento na linha ${lineNumber}`
        );

      const manualConversionFactor = optionalNumber(
        formData.get(lineFieldName(lineId, "manualConversionFactor"))
      );
      if (Number.isNaN(manualConversionFactor))
        return badRequest(`Fator manual inválido na linha ${lineNumber}`);
      const conversion = resolveConvertedCostPreview({
        costAmount: Number(unitCostAmount),
        movementUnit: unit,
        selectedItem: item,
        manualConversionFactor,
        measurementConversions,
      });
      if (!conversion)
        return badRequest(
          `Sem conversão automática de ${unit} para ${
            getItemTargetUnit(item) || "UM do item"
          } na linha ${lineNumber}`
        );

      movementInputs.push({
        itemVariationId: itemVariation.id,
        costAmount: Number(conversion.convertedCostAmount),
        unit: conversion.targetUnit,
        source: "manual",
        movementType: "manual",
        direction: normalizeStockMovementDirection(formData.get("direction")),
        quantityAmount:
          Number.isFinite(Number(quantityAmount)) && Number(quantityAmount) > 0
            ? Number(quantityAmount)
            : null,
        quantityUnit: unit,
        movementUnit: unit,
        conversionSource: conversion.conversionSource,
        conversionFactorUsed: conversion.conversionFactorUsed,
        supplierId: supplier?.id || null,
        supplierName:
          supplier?.name || str(formData.get("supplierName")) || null,
        supplierCnpj: supplier?.cnpj || null,
        invoiceNumber: str(formData.get("invoiceNumber")) || null,
        movementAt,
        appliedBy: actor,
        validFrom: movementAt,
        originType: "stock-movement-manual-entry",
        originRefId: itemId,
        metadata: {
          notes: str(formData.get("notes")) || null,
          costTotalAmount:
            costTotalAmount != null && Number.isFinite(Number(costTotalAmount))
              ? Number(costTotalAmount)
              : null,
          movementUnitCostAmount: Number(unitCostAmount),
          movementUnit: unit,
          targetUnit: conversion.targetUnit,
          itemVariationId: itemVariation.id,
          variationName: itemVariation?.Variation?.name || null,
          variationCode: itemVariation?.Variation?.code || null,
          manualConversionFactor:
            manualConversionFactor != null &&
            Number.isFinite(Number(manualConversionFactor))
              ? Number(manualConversionFactor)
              : null,
          manualMovementLineNumber: lineNumber,
          manualMovementLineCount: lineIds.length,
          createdFromRoute: "/admin/stock-movements/new",
        },
      });
    }

    const createdMovements: Array<{ id: string }> = [];
    for (const input of movementInputs) {
      const movement = await registerItemCostEvent(input);
      createdMovements.push(movement);
    }

    const firstMovement = createdMovements[0];
    return redirect(
      firstMovement
        ? `/admin/stock-movements?movementId=${encodeURIComponent(
            firstMovement.id
          )}`
        : "/admin/stock-movements"
    );
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminStockMovementNewRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const payload = (loaderData as any)?.payload || {};
  const items = (payload.items || []) as any[];
  const suppliers = (payload.suppliers || []) as any[];
  const measurementConversions = (payload.measurementConversions ||
    []) as Array<{ fromUnit: string; toUnit: string; factor: number }>;
  const defaultItemId = String(payload.defaultItemId || "");
  const isSubmitting = navigation.state !== "idle";
  const [lines, setLines] = useState<MovementLineDraft[]>(() => [
    createMovementLineDraft(defaultItemId),
  ]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const itemOptions = useMemo<SearchableSelectOption[]>(
    () =>
      items.map((item) => ({
        value: item.id,
        label: `${item.name} (${getItemBaseUnit(item)})`,
        searchText: `${item.name} ${item.classification || ""} ${
          item.purchaseUm || ""
        } ${item.consumptionUm || ""}`,
      })),
    [items]
  );
  const supplierOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        value: "",
        label: "Sem vínculo",
        searchText: "sem vinculo sem fornecedor",
      },
      ...suppliers.map((supplier) => ({
        value: supplier.id,
        label: `${supplier.name}${supplier.cnpj ? ` - ${supplier.cnpj}` : ""}`,
        searchText: `${supplier.name} ${supplier.cnpj || ""}`,
      })),
    ],
    [suppliers]
  );
  const updateLine = useCallback((lineId: string, next: MovementLineDraft) => {
    setLines((current) =>
      current.map((line) => (line.id === lineId ? next : line))
    );
  }, []);
  const removeLine = useCallback((lineId: string) => {
    setLines((current) =>
      current.length > 1
        ? current.filter((line) => line.id !== lineId)
        : current
    );
  }, []);
  const addLine = useCallback(() => {
    setLines((current) => [...current, createMovementLineDraft()]);
  }, []);

  useEffect(() => {
    if (!defaultItemId) return;
    setLines((current) => {
      if (current.length !== 1 || current[0]?.itemId) return current;
      return [{ ...current[0], itemId: defaultItemId }];
    });
  }, [defaultItemId]);

  return (
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/admin/stock-movements"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
            >
              <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                <ChevronLeft size={12} />
              </span>
              movimentações
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">novo movimento</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Novo movimento
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Registra uma movimentação canônica e atualiza o custo atual do
              item usando o mesmo histórico dos lançamentos importados.
            </p>
          </div>
        </section>

        {actionData?.message ? (
          <div
            className={`border-l-2 px-3 py-2 text-sm ${
              actionData.status >= 400
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            {actionData.message}
          </div>
        ) : null}

        <section className="max-w-6xl">
          <Form method="post" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Movimento
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Direção
                  </label>
                  <Select name="direction" defaultValue="entry" required>
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue placeholder="Selecionar direção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entrada</SelectItem>
                      <SelectItem value="exit">Saída</SelectItem>
                      <SelectItem value="neutral">Evento de custo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Data
                  </label>
                  <Input
                    name="movementAt"
                    type="datetime-local"
                    defaultValue={defaultDateTimeLocalValue()}
                    className="h-10 bg-white"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Origem</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div className="xl:col-span-3">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Fornecedor
                  </label>
                  <input
                    type="hidden"
                    name="supplierId"
                    value={selectedSupplierId}
                  />
                  <SearchableSelect
                    value={selectedSupplierId}
                    onValueChange={setSelectedSupplierId}
                    options={supplierOptions}
                    placeholder="Sem vínculo"
                    searchPlaceholder="Buscar fornecedor..."
                    emptyText="Nenhum fornecedor encontrado."
                    triggerClassName="h-10 w-full max-w-none text-sm"
                    contentClassName="w-[420px]"
                  />
                </div>
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Fornecedor livre
                  </label>
                  <Input
                    name="supplierName"
                    placeholder="quando não houver cadastro"
                    className="h-10 bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Documento
                  </label>
                  <Input
                    name="invoiceNumber"
                    placeholder="NF, cupom, ajuste"
                    className="h-10 bg-white"
                  />
                </div>
                <div className="md:col-span-2 xl:col-span-6">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Observação
                  </label>
                  <Input
                    name="notes"
                    placeholder="motivo ou contexto do lançamento"
                    className="h-10 bg-white"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="min-w-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Itens e custos
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2"
                    onClick={addLine}
                  >
                    <PlusCircle size={14} />
                    Adicionar item
                  </Button>
                </div>
                <div className="mt-4 space-y-5">
                  {lines.map((line, index) => (
                    <MovementItemLine
                      key={line.id}
                      line={line}
                      lineNumber={index + 1}
                      items={items}
                      itemOptions={itemOptions}
                      measurementConversions={measurementConversions}
                      canRemove={lines.length > 1}
                      onChange={(next) => updateLine(line.id, next)}
                      onRemove={() => removeLine(line.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button
                type="submit"
                className="h-10 w-full md:w-auto"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Criando..." : "Criar movimento"}
              </Button>
            </div>
          </Form>
        </section>
      </div>
    </Container>
  );
}
