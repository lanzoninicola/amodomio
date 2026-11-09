import { NavLink, Outlet, useOutletContext } from "@remix-run/react";
import { cn } from "~/lib/utils";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";

const procedureTabs = [
  { label: "editar", to: "editar" },
  { label: "prévia pdf", to: "preview" },
];

export default function AdminRecipeProcedimentoLayout() {
  const context = useOutletContext<AdminRecipeOutletContext>();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Procedimento de produção
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Mantenha o passo a passo padronizado e revise a versão de impressão.
        </p>
      </div>

      <nav className="border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {procedureTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "border-b-2 pb-2 font-medium transition",
                  isActive
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet context={context} />
    </div>
  );
}
