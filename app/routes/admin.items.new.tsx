import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const ITEM_CLASSIFICATIONS = [
  "insumo",
  "semi_acabado",
  "produto_final",
  "embalagem",
  "servico",
  "outro",
] as const;

const ITEM_UNIT_OPTIONS = ["UN", "L", "ML", "KG", "G"];

function toBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function normalizeUnit(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
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
  } catch (_error) {
    // fallback para ambientes sem tabela measurement_units
  }

  const merged = new Set<string>(staticUnits);
  for (const row of dbUnits || []) {
    const code = normalizeUnit(row?.code);
    if (code) merged.add(code);
  }

  return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const [categories, unitOptions] = await Promise.all([
      db.category.findMany({
        where: { type: "item" },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      getAvailableItemUnits(),
    ]);

    return ok({
      categories,
      unitOptions,
      classifications: ITEM_CLASSIFICATIONS,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "");
    if (_action !== "item-create") return badRequest("Ação inválida");

    const db = prismaClient as any;
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const classification = String(formData.get("classification") || "").trim();
    const categoryIdRaw = String(formData.get("categoryId") || "").trim();
    const categoryId = categoryIdRaw || null;
    const consumptionUm = normalizeUnit(formData.get("consumptionUm"));

    if (!name) return badRequest("Informe o nome do item");
    if (!ITEM_CLASSIFICATIONS.includes(classification as (typeof ITEM_CLASSIFICATIONS)[number])) {
      return badRequest("Informe uma classificação válida");
    }

    const availableUnits = await getAvailableItemUnits();
    if (consumptionUm && !availableUnits.includes(consumptionUm)) {
      return badRequest("Unidade de consumo inválida");
    }

    if (categoryId) {
      const categoryExists = await db.category.findUnique({
        where: { id: categoryId },
        select: { id: true, type: true },
      });

      if (!categoryExists || categoryExists.type !== "item") {
        return badRequest("Categoria inválida");
      }
    }

    const item = await db.item.create({
      data: {
        name,
        description: description || null,
        classification,
        categoryId,
        consumptionUm,
        active: toBool(formData.get("active")),
        canPurchase: toBool(formData.get("canPurchase")),
        canTransform: toBool(formData.get("canTransform")),
        canSell: toBool(formData.get("canSell")),
        canStock: toBool(formData.get("canStock")),
        canBeInMenu: toBool(formData.get("canBeInMenu")),
      },
      select: { id: true },
    });

    throw redirect(`/admin/items/${item.id}/main`);
  } catch (error) {
    if (error instanceof Response) throw error;
    return serverError(error);
  }
}

export default function AdminItemsNewPage() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const payload = loaderData?.payload as any;
  const categories = (payload?.categories || []) as Array<{ id: string; name: string }>;
  const unitOptions = (payload?.unitOptions || ITEM_UNIT_OPTIONS) as string[];
  const classifications = (payload?.classifications || ITEM_CLASSIFICATIONS) as string[];

  const [classificationValue, setClassificationValue] = useState(classifications[0] || "insumo");
  const [categoryIdValue, setCategoryIdValue] = useState("__EMPTY__");
  const [consumptionUmValue, setConsumptionUmValue] = useState("__EMPTY__");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Novo item</h1>
            <p className="text-sm text-slate-600">Preencha os dados para criar um novo item.</p>
          </div>
          <Link to="/admin/items" className="text-sm underline">
            Voltar
          </Link>
        </div>
      </div>

      <Form method="post" className="space-y-4">
        <input type="hidden" name="_action" value="item-create" />

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="classification">Classificação</Label>
              <input type="hidden" name="classification" value={classificationValue} />
              <Select value={classificationValue} onValueChange={setClassificationValue}>
                <SelectTrigger id="classification" className="mt-1">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {classifications.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="consumptionUm">Unidade de consumo</Label>
              <input type="hidden" name="consumptionUm" value={consumptionUmValue === "__EMPTY__" ? "" : consumptionUmValue} />
              <Select value={consumptionUmValue} onValueChange={setConsumptionUmValue}>
                <SelectTrigger id="consumptionUm" className="mt-1">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Selecionar...</SelectItem>
                  {unitOptions.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="categoryId">Categoria</Label>
              <input type="hidden" name="categoryId" value={categoryIdValue === "__EMPTY__" ? "" : categoryIdValue} />
              <Select value={categoryIdValue} onValueChange={setCategoryIdValue}>
                <SelectTrigger id="categoryId" className="mt-1">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__EMPTY__">Sem categoria</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Configurações do item</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="active" defaultChecked />
              Ativo
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="canPurchase" />
              Pode comprar
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="canTransform" defaultChecked />
              Pode transformar
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="canSell" />
              Pode vender
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="canStock" defaultChecked />
              Tem estoque
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="canBeInMenu" />
              Pode ir ao cardápio
            </label>
          </div>
        </div>

        {actionData?.status && actionData.status >= 400 ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {actionData.message}
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
            Criar item
          </Button>
        </div>
      </Form>
    </div>
  );
}
