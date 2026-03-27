import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useOutletContext } from "@remix-run/react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

const KIND_OPTIONS = ["weight", "volume", "count", "custom"] as const;

export async function loader({ params }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const [activeUnits, conversions] = await Promise.all([
    db.measurementUnit.findMany({
      where: { active: true },
      orderBy: [{ code: "asc" }],
    }),
    db.measurementUnitConversion.findMany({
      where: {
        OR: [{ fromUnitId: params.unitId }, { toUnitId: params.unitId }],
      },
      include: {
        FromUnit: { select: { id: true, code: true, name: true } },
        ToUnit: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    }),
  ]);
  return ok({ activeUnits, conversions });
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const db = prismaClient as any;
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "").trim();

    if (_action === "unit-update") {
      const name = String(formData.get("name") || "").trim();
      const kind = String(formData.get("kind") || "custom");
      const scope = String(formData.get("scope") || "global") === "restricted" ? "restricted" : "global";

      if (!name) return badRequest("Informe o nome");
      if (!KIND_OPTIONS.includes(kind as any)) return badRequest("Tipo inválido");

      await db.measurementUnit.update({
        where: { id: params.unitId },
        data: { name, kind, scope },
      });
      return ok("Unidade atualizada");
    }

    if (_action === "unit-toggle-active") {
      const unit = await db.measurementUnit.findUnique({ where: { id: params.unitId } });
      if (!unit) return badRequest("Unidade não encontrada");
      await db.measurementUnit.update({ where: { id: params.unitId }, data: { active: !unit.active } });
      return ok(unit.active ? "Unidade desativada" : "Unidade ativada");
    }

    if (_action === "conversion-upsert") {
      const fromUnitId = String(formData.get("fromUnitId") || "").trim();
      const toUnitId = String(formData.get("toUnitId") || "").trim();
      const factor = Number(formData.get("factor") || 0);
      const notes = String(formData.get("notes") || "").trim();
      const active = formData.get("active") === "on" || formData.get("active") === "true";

      if (!fromUnitId || !toUnitId) return badRequest("Selecione origem e destino");
      if (fromUnitId === toUnitId) return badRequest("Origem e destino devem ser diferentes");
      if (!(factor > 0)) return badRequest("Informe um fator maior que zero");

      const [fromUnit, toUnit] = await Promise.all([
        db.measurementUnit.findUnique({ where: { id: fromUnitId } }),
        db.measurementUnit.findUnique({ where: { id: toUnitId } }),
      ]);
      if (!fromUnit || !toUnit) return badRequest("Unidade inválida");

      await db.measurementUnitConversion.upsert({
        where: { fromUnitId_toUnitId: { fromUnitId, toUnitId } },
        create: { fromUnitId, toUnitId, factor, notes: notes || null, active },
        update: { factor, notes: notes || null, active },
      });
      return ok("Conversão salva");
    }

    return badRequest("Ação inválida");
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminUnidadesConsumoEdit() {
  const { unit } = useOutletContext<{ unit: any }>();
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const activeUnits: any[] = (loaderData?.payload as any)?.activeUnits || [];
  const conversions: any[] = (loaderData?.payload as any)?.conversions || [];

  const [kind, setKind] = useState(unit?.kind || "custom");
  const [scope, setScope] = useState(unit?.scope || "global");
  const [toUnitId, setToUnitId] = useState("");

  const availableToUnits = activeUnits.filter((u) => u.id !== unit?.id);

  const errorClass = "border-red-200 bg-red-50 text-red-700";
  const successClass = "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left column — unit fields + status */}
      <div className="space-y-4">
        {actionData?.message ? (
          <div className={`rounded-md border px-3 py-2 text-sm ${actionData.status >= 400 ? errorClass : successClass}`}>
            {actionData.message}
          </div>
        ) : null}

        {/* Edit form */}
        <Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="unit-update" />
          <div>
            <Label>Código</Label>
            <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              {unit?.code}
            </div>
            <p className="mt-1 text-xs text-slate-400">O código não pode ser alterado após a criação.</p>
          </div>
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={unit?.name} required className="mt-1" />
          </div>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="scope" value={scope} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibilidade</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global — todos os itens</SelectItem>
                  <SelectItem value="restricted">Restrita — só itens vinculados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700">Salvar alterações</Button>
        </Form>

        {/* Status toggle */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm text-slate-700">
            Unidade está <strong>{unit?.active ? "ativa" : "inativa"}</strong>
          </span>
          <Form method="post">
            <input type="hidden" name="_action" value="unit-toggle-active" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className={unit?.active ? "border-red-200 text-red-600 hover:bg-red-50" : ""}
            >
              {unit?.active ? "Desativar" : "Ativar"}
            </Button>
          </Form>
        </div>
      </div>

      {/* Right column — conversions */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversões base</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Define quantas unidades de destino existem em 1 unidade de origem.
          </p>
        </div>

        {/* Existing conversions table */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {conversions.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma conversão configurada.</p>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/90">
                <TableRow className="hover:bg-slate-50/90">
                  <TableHead className="h-9 px-4 text-xs font-medium text-slate-500">Conversão</TableHead>
                  <TableHead className="h-9 px-4 text-xs font-medium text-slate-500">Status</TableHead>
                  <TableHead className="h-9 px-4 text-xs font-medium text-slate-500">Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.map((conv: any) => (
                  <TableRow key={conv.id} className="border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="px-4 py-3 text-sm font-medium text-slate-900">
                      1 {conv.FromUnit?.code} = {Number(conv.factor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {conv.ToUnit?.code}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={conv.active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-400"}
                      >
                        {conv.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-slate-500">{conv.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Add conversion form */}
        <Form method="post" className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="_action" value="conversion-upsert" />
          <input type="hidden" name="fromUnitId" value={unit?.id || ""} />
          <input type="hidden" name="toUnitId" value={toUnitId} />
          <p className="text-xs font-medium text-slate-500">
            Nova conversão — origem: <strong>{unit?.code}</strong>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Destino</Label>
              <Select value={toUnitId} onValueChange={setToUnitId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {availableToUnits.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.code} — {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="factor">
                Fator (1 {unit?.code} = ? {availableToUnits.find((u: any) => u.id === toUnitId)?.code || "destino"})
              </Label>
              <Input
                id="factor"
                name="factor"
                type="number"
                min="0"
                step="0.000001"
                placeholder="ex: 1000"
                required
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="notes">Observação</Label>
              <Input id="notes" name="notes" placeholder="opcional" className="mt-1" />
            </div>
            <div className="flex items-center gap-1.5 pt-6">
              <input id="conv-active" type="checkbox" name="active" defaultChecked className="h-4 w-4" />
              <Label htmlFor="conv-active">Ativa</Label>
            </div>
          </div>
          <Button type="submit" variant="outline" size="sm">Salvar conversão</Button>
        </Form>
      </div>
    </div>
  );
}
