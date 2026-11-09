import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import prismaClient from "~/lib/prisma/client.server";
import { ok, serverError } from "~/utils/http-response.server";

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

  // Seed standard conversions between units of the same kind
  const defaultConversions = [
    { fromCode: "KG", toCode: "G",  factor: 1000,   notes: "1 kg = 1000 g" },
    { fromCode: "G",  toCode: "KG", factor: 0.001,  notes: "1 g = 0,001 kg" },
    { fromCode: "L",  toCode: "ML", factor: 1000,   notes: "1 L = 1000 mL" },
    { fromCode: "ML", toCode: "L",  factor: 0.001,  notes: "1 mL = 0,001 L" },
  ];

  const unitMap = new Map<string, string>();
  for (const { fromCode, toCode } of defaultConversions) {
    for (const code of [fromCode, toCode]) {
      if (!unitMap.has(code)) {
        const unit = await db.measurementUnit.findFirst({ where: { code } });
        if (unit) unitMap.set(code, unit.id);
      }
    }
  }

  for (const { fromCode, toCode, factor, notes } of defaultConversions) {
    const fromId = unitMap.get(fromCode);
    const toId = unitMap.get(toCode);
    if (!fromId || !toId) continue;
    const existing = await db.measurementUnitConversion.findFirst({
      where: { fromUnitId: fromId, toUnitId: toId },
    });
    if (!existing) {
      await db.measurementUnitConversion.create({
        data: { fromUnitId: fromId, toUnitId: toId, factor, notes },
      });
    }
  }
}

export async function loader({}: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    await seedDefaultMeasurementUnits();
    const units = await db.measurementUnit.findMany({
      orderBy: [{ active: "desc" }, { code: "asc" }],
    });
    return ok({ units });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminUnidadesConsumoIndex() {
  const loaderData = useLoaderData<typeof loader>();
  const units = (loaderData?.payload as any)?.units || [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{units.length} unidade(s)</span>
        </div>
        <Link to="/admin/unidades-consumo/new">
          <Button size="sm" className="h-8 bg-slate-900 hover:bg-slate-700 text-xs">+ Nova unidade</Button>
        </Link>
      </div>

      <div className="overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Código</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Nome</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Tipo</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Visibilidade</TableHead>
              <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">Status</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-medium text-slate-500"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit: any) => (
              <TableRow key={unit.id} className="border-slate-100 hover:bg-slate-50/50">
                <TableCell className="px-4 py-3 font-medium text-slate-900">{unit.code}</TableCell>
                <TableCell className="px-4 py-3 text-sm text-slate-700">{unit.name}</TableCell>
                <TableCell className="px-4 py-3">
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                    {unit.kind || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={unit.scope === "restricted"
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-sky-200 bg-sky-50 text-sky-700"}
                  >
                    {unit.scope === "restricted" ? "Restrita" : "Global"}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={unit.active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-400"}
                  >
                    {unit.active ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {unit.scope === "restricted" && (
                      <Link to={`/admin/unidades-consumo/${unit.id}/items`}>
                        <Button variant="ghost" className="h-7 text-xs text-violet-600 hover:text-violet-800">
                          Itens
                        </Button>
                      </Link>
                    )}
                    <Link to={`/admin/unidades-consumo/${unit.id}`}>
                      <Button variant="ghost" className="h-7 text-xs text-slate-600 hover:text-slate-900">
                        Editar
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {units.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  Nenhuma unidade cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
