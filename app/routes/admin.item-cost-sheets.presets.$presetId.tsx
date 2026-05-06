import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useOutletContext, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { useMemo } from "react";
import type { SearchableSelectOption } from "~/components/ui/searchable-select";
import { ItemCostSheetPresetForm } from "~/components/admin/item-cost-sheet-preset-form";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import type { ItemCostSheetPresetsOutletContext } from "./admin.item-cost-sheets.presets";

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const presetId = String(params.presetId || "").trim();
    if (!presetId) return badRequest("Preset inválido");

    const db = prismaClient as any;
    const preset = await db.itemCostSheetComponentPreset.findFirst({
      where: { id: presetId, active: true, type: { in: ["manual", "labor"] } },
      select: {
        id: true,
        key: true,
        type: true,
        variationId: true,
        name: true,
        unit: true,
        quantity: true,
        unitCostAmount: true,
        wastePerc: true,
        notes: true,
        Variation: { select: { id: true, name: true, code: true, kind: true } },
      },
    });

    if (!preset) return badRequest("Preset não encontrado");

    return ok({
      preset: {
        id: String(preset.id || ""),
        key: String(preset.key || ""),
        type: String(preset.type || "manual"),
        variationId: preset.variationId ? String(preset.variationId) : null,
        variationLabel: preset.Variation?.name || null,
        variationCode: preset.Variation?.code || null,
        variationKind: preset.Variation?.kind || null,
        name: String(preset.name || ""),
        unit: preset.unit || null,
        quantity: Number(preset.quantity || 1),
        unitCostAmount: Number(preset.unitCostAmount || 0),
        wastePerc: Number(preset.wastePerc || 0),
        notes: preset.notes || null,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemCostSheetPresetDetail() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const { variations, unitOptions } = useOutletContext<ItemCostSheetPresetsOutletContext>();
  const preset = loaderData?.payload?.preset || null;

  const variationOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        value: "__all__",
        label: "Todas as variacoes da ficha",
        searchText: "todas variacoes ficha geral",
      },
      ...variations.map((variation) => ({
        value: variation.id,
        label: variation.name,
        searchText: [variation.name, variation.code, variation.kind].filter(Boolean).join(" "),
      })),
    ],
    [variations]
  );

  return (
    <ItemCostSheetPresetForm
      action="/admin/item-cost-sheets/presets"
      cancelHref="/admin/item-cost-sheets/presets"
      preset={preset}
      unitOptions={unitOptions}
      variationOptions={variationOptions}
      submitLabel="Atualizar"
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error.data?.message || error.statusText}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      Não foi possível carregar o preset.
    </div>
  );
}
