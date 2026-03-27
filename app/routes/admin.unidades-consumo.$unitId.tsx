import type { LoaderFunctionArgs } from "@remix-run/node";
import { ChevronLeft } from "lucide-react";
import { Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const db = prismaClient as any;
  const unit = await db.measurementUnit.findUnique({ where: { id: params.unitId } });
  if (!unit) throw new Response("Unidade não encontrada", { status: 404 });
  return ok({ unit });
}

export default function AdminUnidadesConsumoUnit() {
  const loaderData = useLoaderData<typeof loader>();
  const unit = (loaderData?.payload as any)?.unit;

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 pb-3 font-medium transition ${
      isActive
        ? "border-slate-950 text-slate-950"
        : "border-transparent text-slate-400 hover:text-slate-700"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-5 border-b border-slate-200/80 pb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <Link
              to="/admin/unidades-consumo"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Unidades de consumo
            </Link>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {unit?.code} — {unit?.name}
            </h2>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  unit?.scope === "restricted"
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-sky-200 bg-sky-50 text-sky-700"
                }
              >
                {unit?.scope === "restricted" ? "Restrita" : "Global"}
              </Badge>
              <Badge
                variant="outline"
                className={
                  unit?.active
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-400"
                }
              >
                {unit?.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <nav className="overflow-x-auto border-b border-slate-100">
          <div className="flex min-w-max items-center gap-6 text-sm">
            <NavLink
              to={`/admin/unidades-consumo/${unit?.id}`}
              end
              className={tabClass}
            >
              Editar
            </NavLink>
            <NavLink
              to={`/admin/unidades-consumo/${unit?.id}/items`}
              className={tabClass}
            >
              Itens vinculados
            </NavLink>
          </div>
        </nav>

        <Outlet context={{ unit }} />
      </div>
    </div>
  );
}
