import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function toUpper(value: FormDataEntryValue | null) {
  return str(value).toUpperCase();
}

function toBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

const KIND_OPTIONS = ["weight", "volume", "count", "custom"] as const;

async function seedDefaultMeasurementUnits() {
  const db = prismaClient as any;
  const defaults = [
    { code: "UN", name: "Unidade", kind: "count" },
    { code: "KG", name: "Quilograma", kind: "weight" },
    { code: "G", name: "Grama", kind: "weight" },
    { code: "L", name: "Litro", kind: "volume" },
    { code: "ML", name: "Mililitro", kind: "volume" },
  ];

  for (const unit of defaults) {
    const existing = await db.measurementUnit.findFirst({ where: { code: unit.code } });
    if (!existing) {
      await db.measurementUnit.create({ data: unit });
    }
  }
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    await seedDefaultMeasurementUnits();

    const [units, conversions] = await Promise.all([
      db.measurementUnit.findMany({
        orderBy: [{ active: "desc" }, { code: "asc" }],
      }),
      db.measurementUnitConversion.findMany({
        include: {
          FromUnit: { select: { id: true, code: true, name: true } },
          ToUnit: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      }),
    ]);

    return ok({ units, conversions });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const _action = str(formData.get("_action"));

    if (_action === "unit-create") {
      const code = toUpper(formData.get("code"));
      const name = str(formData.get("name"));
      const kind = str(formData.get("kind")) || "custom";

      if (!code) return badRequest("Informe o código da unidade");
      if (!name) return badRequest("Informe o nome da unidade");
      if (!/^[A-Z0-9_]+$/.test(code)) {
        return badRequest("Código inválido. Use letras maiúsculas, números e _");
      }
      if (!KIND_OPTIONS.includes(kind as any)) {
        return badRequest("Tipo de unidade inválido");
      }

      const existing = await db.measurementUnit.findFirst({ where: { code } });
      if (existing) return badRequest("Já existe uma unidade com esse código");

      await db.measurementUnit.create({
        data: {
          code,
          name,
          kind,
          active: true,
        },
      });

      return ok("Unidade criada com sucesso");
    }

    if (_action === "unit-toggle-active") {
      const id = str(formData.get("id"));
      if (!id) return badRequest("Unidade inválida");
      const unit = await db.measurementUnit.findUnique({ where: { id } });
      if (!unit) return badRequest("Unidade não encontrada");

      await db.measurementUnit.update({
        where: { id },
        data: { active: !unit.active },
      });

      return ok("Unidade atualizada");
    }

    if (_action === "conversion-upsert") {
      const fromUnitId = str(formData.get("fromUnitId"));
      const toUnitId = str(formData.get("toUnitId"));
      const factor = Number(formData.get("factor") || 0);
      const notes = str(formData.get("notes"));
      const active = toBool(formData.get("active"));

      if (!fromUnitId || !toUnitId) return badRequest("Selecione origem e destino");
      if (fromUnitId === toUnitId) return badRequest("Origem e destino devem ser diferentes");
      if (!(factor > 0)) return badRequest("Informe um fator maior que zero");

      const [fromUnit, toUnit] = await Promise.all([
        db.measurementUnit.findUnique({ where: { id: fromUnitId } }),
        db.measurementUnit.findUnique({ where: { id: toUnitId } }),
      ]);

      if (!fromUnit || !toUnit) return badRequest("Unidade inválida");

      await db.measurementUnitConversion.upsert({
        where: {
          fromUnitId_toUnitId: {
            fromUnitId,
            toUnitId,
          },
        },
        create: {
          fromUnitId,
          toUnitId,
          factor,
          notes: notes || null,
          active,
        },
        update: {
          factor,
          notes: notes || null,
          active,
        },
      });

      return ok("Conversão salva com sucesso");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminUnidadesConsumoIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const payload = loaderData?.payload as any;

  const units = payload?.units || [];
  const conversions = payload?.conversions || [];

  const activeUnits = useMemo(() => units.filter((u: any) => u.active), [units]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {actionData?.message ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${actionData.status >= 400 ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {actionData.message}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">Unidades de consumo</h1>
        <p className="text-sm text-slate-600">
          Cadastre unidades (ex.: MAÇO, BANDEJA) e conversões-base entre unidades (ex.: 1 KG = 1000 G).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <input type="hidden" name="_action" value="unit-create" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nova unidade</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" placeholder="ex: MACO" required />
            </div>
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" placeholder="ex: Maço" required />
            </div>
          </div>
          <div>
            <Label htmlFor="kind">Tipo</Label>
            <select
              id="kind"
              name="kind"
              defaultValue="custom"
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
            Criar unidade
          </Button>
        </Form>

        <Form method="post" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <input type="hidden" name="_action" value="conversion-upsert" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversão base</h2>
          <p className="text-xs text-slate-500">
            Define quantas unidades de destino existem em 1 unidade de origem.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="fromUnitId">Origem (1x)</Label>
              <select
                id="fromUnitId"
                name="fromUnitId"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Selecionar...</option>
                {activeUnits.map((unit: any) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="toUnitId">Destino</Label>
              <select
                id="toUnitId"
                name="toUnitId"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Selecionar...</option>
                {activeUnits.map((unit: any) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="factor">Fator</Label>
              <Input id="factor" name="factor" type="number" min="0" step="0.000001" placeholder="ex: 1000" required />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input id="active" type="checkbox" name="active" defaultChecked className="h-4 w-4" />
              <Label htmlFor="active">Ativa</Label>
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Observação</Label>
            <Input id="notes" name="notes" placeholder="ex: conversão padrão de peso" />
          </div>
          <Button type="submit" variant="outline">
            Salvar conversão
          </Button>
        </Form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Unidades cadastradas</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            {units.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">Nenhuma unidade cadastrada.</p>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/90">
                  <TableRow className="hover:bg-slate-50/90">
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Unidade</TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                    <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit: any) => (
                    <TableRow key={unit.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-4 py-3">
                        <div className="font-medium text-slate-900">{unit.code} - {unit.name}</div>
                        <div className="text-xs text-slate-500">ID: {unit.id}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                          {unit.kind || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={unit.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}
                        >
                          {unit.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Form method="post">
                          <input type="hidden" name="_action" value="unit-toggle-active" />
                          <input type="hidden" name="id" value={unit.id} />
                          <Button type="submit" variant="outline" className="h-8 text-xs">
                            {unit.active ? "Desativar" : "Ativar"}
                          </Button>
                        </Form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversões base</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            {conversions.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">Nenhuma conversão cadastrada.</p>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/90">
                  <TableRow className="hover:bg-slate-50/90">
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Conversão</TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversions.map((conv: any) => (
                    <TableRow key={conv.id} className="border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-4 py-3 font-medium text-slate-900">
                        1 {conv.FromUnit?.code} = {Number(conv.factor || 0).toFixed(6)} {conv.ToUnit?.code}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={conv.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}
                        >
                          {conv.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-slate-700">{conv.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
