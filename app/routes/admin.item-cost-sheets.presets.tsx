import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData, useLocation, type ShouldRevalidateFunction } from "@remix-run/react";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const ITEM_UNIT_OPTIONS = ["UN", "L", "ML", "KG", "G", "H"];

export const shouldRevalidate: ShouldRevalidateFunction = ({ formMethod, currentUrl, nextUrl }) => {
  if (formMethod && formMethod !== "GET") return true;
  return currentUrl.pathname !== nextUrl.pathname;
};

export type ItemCostSheetPresetRecord = {
  id: string;
  key: string;
  type: string;
  variationId: string | null;
  variationLabel: string | null;
  variationCode: string | null;
  variationKind: string | null;
  name: string;
  unit: string | null;
  quantity: number;
  unitCostAmount: number;
  wastePerc: number;
  notes: string | null;
};

export type ItemCostSheetPresetVariationOption = {
  id: string;
  name: string;
  code: string;
  kind: string;
};

function normalizeUnit(value: FormDataEntryValue | string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeText(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "").trim();
}

function slugifyPresetPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getAvailableItemUnits() {
  const db = prismaClient as any;
  const staticUnits = ITEM_UNIT_OPTIONS;
  let dbUnits: Array<{ code?: string | null }> | undefined;
  const measurementUnitModel = db.measurementUnit;

  if (typeof measurementUnitModel?.findMany !== "function") {
    return [...staticUnits].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  try {
    dbUnits = await measurementUnitModel.findMany({
      where: { active: true },
      select: { code: true },
      orderBy: [{ code: "asc" }],
    });
  } catch {
    // fallback para ambientes sem tabela measurement_units
  }

  const merged = new Set<string>(staticUnits);
  for (const row of dbUnits || []) {
    const code = normalizeUnit(row?.code);
    if (code) merged.add(code);
  }

  return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function createUniquePresetKey(db: any, type: string, name: string) {
  const baseSlug = slugifyPresetPart(name) || "preset";
  let attempt = `${type}.${baseSlug}`;
  let suffix = 2;

  while (true) {
    const exists = await db.itemCostSheetComponentPreset.findUnique({
      where: { key: attempt },
      select: { id: true },
    });
    if (!exists) return attempt;
    attempt = `${type}.${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function listPresetRecords(db: any): Promise<ItemCostSheetPresetRecord[]> {
  const presets = await db.itemCostSheetComponentPreset.findMany({
    where: { active: true, type: { in: ["manual", "labor"] } },
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
      sortOrderIndex: true,
      Variation: { select: { id: true, name: true, code: true, kind: true } },
    },
    orderBy: [{ type: "asc" }, { sortOrderIndex: "asc" }, { name: "asc" }],
  });

  return (presets || []).map((preset: any) => ({
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
  }));
}

async function listPresetVariationOptions(db: any): Promise<ItemCostSheetPresetVariationOption[]> {
  const variations = await db.variation.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true, kind: true },
    orderBy: [{ kind: "asc" }, { sortOrderIndex: "asc" }, { name: "asc" }],
  });

  return (variations || []).map((variation: any) => ({
    id: String(variation.id || ""),
    name: String(variation.name || variation.code || "Variação"),
    code: String(variation.code || ""),
    kind: String(variation.kind || ""),
  }));
}

export async function loader(_: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const [presets, variations, unitOptions] = await Promise.all([
      listPresetRecords(db),
      listPresetVariationOptions(db),
      getAvailableItemUnits(),
    ]);

    return ok({
      presets,
      variations,
      unitOptions,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "").trim();
    const presetId = String(formData.get("presetId") || "").trim();
    const db = prismaClient as any;
    const availableUnits = await getAvailableItemUnits();

    if (_action === "item-cost-sheet-preset-delete") {
      if (!presetId) return badRequest("Preset inválido");

      const preset = await db.itemCostSheetComponentPreset.findFirst({
        where: { id: presetId, active: true, type: { in: ["manual", "labor"] } },
        select: { id: true },
      });
      if (!preset) return badRequest("Preset não encontrado");

      await db.itemCostSheetComponentPreset.delete({ where: { id: preset.id } });
      return redirect("/admin/item-cost-sheets/presets");
    }

    if (!["item-cost-sheet-preset-create", "item-cost-sheet-preset-update"].includes(_action)) {
      return badRequest("Ação inválida");
    }

    const type = String(formData.get("type") || "").trim();
    const name = normalizeText(formData.get("name"));
    const unit = normalizeUnit(formData.get("unit"));
    const quantity = Number(String(formData.get("quantity") || "1").replace(",", "."));
    const unitCostAmount = Number(String(formData.get("unitCostAmount") || "0").replace(",", "."));
    const wastePerc = Number(String(formData.get("wastePerc") || "0").replace(",", "."));
    const notes = normalizeText(formData.get("notes"));
    const variationId = String(formData.get("variationId") || "").trim() || null;

    if (!["manual", "labor"].includes(type)) return badRequest("Tipo de preset inválido");
    if (!name) return badRequest("Informe o nome do preset");
    if (!unit || !availableUnits.includes(unit)) return badRequest("Informe uma unidade válida para o preset");
    if (!(quantity > 0)) return badRequest("Informe uma quantidade válida para o preset");
    if (!(unitCostAmount >= 0)) return badRequest("Informe um custo unitário válido para o preset");

    if (variationId) {
      const variationRecord = await db.variation.findFirst({
        where: { id: variationId, deletedAt: null },
        select: { id: true },
      });
      if (!variationRecord) return badRequest("Variação do preset inválida");
    }

    if (_action === "item-cost-sheet-preset-create") {
      const key = await createUniquePresetKey(db, type, name);
      const lastPreset = await db.itemCostSheetComponentPreset.findFirst({
        where: { type, active: true },
        select: { sortOrderIndex: true },
        orderBy: [{ sortOrderIndex: "desc" }, { createdAt: "desc" }],
      });
      const created = await db.itemCostSheetComponentPreset.create({
        data: {
          key,
          type,
          name,
          unit,
          quantity,
          unitCostAmount,
          wastePerc,
          notes: notes || null,
          variationId,
          active: true,
          sortOrderIndex: Number(lastPreset?.sortOrderIndex || 0) + 10,
        },
        select: { id: true },
      });

      return redirect(`/admin/item-cost-sheets/presets/${created.id}`);
    }

    if (!presetId) return badRequest("Preset inválido");

    const existingPreset = await db.itemCostSheetComponentPreset.findFirst({
      where: { id: presetId, active: true, type: { in: ["manual", "labor"] } },
      select: { id: true },
    });
    if (!existingPreset) return badRequest("Preset não encontrado");

    await db.itemCostSheetComponentPreset.update({
      where: { id: presetId },
      data: {
        type,
        name,
        unit,
        quantity,
        unitCostAmount,
        wastePerc,
        notes: notes || null,
        variationId,
      },
    });

    return redirect(`/admin/item-cost-sheets/presets/${presetId}`);
  } catch (error) {
    return serverError(error);
  }
}

export type ItemCostSheetPresetsOutletContext = {
  presets: ItemCostSheetPresetRecord[];
  variations: ItemCostSheetPresetVariationOption[];
  unitOptions: string[];
  actionData: any;
};

export default function AdminItemCostSheetPresetsLayout() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const location = useLocation();
  const payload = loaderData?.payload || {};
  const presets = (payload.presets || []) as ItemCostSheetPresetRecord[];
  const variations = (payload.variations || []) as ItemCostSheetPresetVariationOption[];
  const unitOptions = (payload.unitOptions || ITEM_UNIT_OPTIONS) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-slate-50/60 p-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Presets operacionais</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Presets da ficha técnica</h2>
          <div className="mt-1 text-sm text-slate-500">
            Cadastre e edite custos recorrentes em rotas próprias, sem poluir a tela de composição da ficha.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/item-cost-sheets/presets"
            className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${location.pathname === "/admin/item-cost-sheets/presets" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Lista
          </Link>
          <Link
            to="/admin/item-cost-sheets/presets/new"
            className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${location.pathname.endsWith("/new") ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Novo preset
          </Link>
        </div>
      </div>

      {actionData?.status >= 400 ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionData.message}
        </div>
      ) : null}

      <Outlet
        context={{
          presets,
          variations,
          unitOptions,
          actionData,
        } satisfies ItemCostSheetPresetsOutletContext}
      />
    </div>
  );
}
