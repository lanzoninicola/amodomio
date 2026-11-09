import { Link, NavLink, Outlet } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";

const tabs = [
  { to: "/admin/item-cost-sheets-batch/adicionar", label: "Adicionar componente" },
  { to: "/admin/item-cost-sheets-batch/editar", label: "Editar componente" },
];

export default function AdminItemCostSheetsBatchPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-5 ">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/admin/item-cost-sheets"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
            >
              <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                <ChevronLeft size={12} />
              </span>
              voltar
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">edição em lote</span>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">
            Edição em lote de fichas de custo
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Liste todas as fichas, filtre o lote desejado e depois aplique a operação em massa.
          </p>
        </div>

        <nav className="flex flex-wrap ">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-medium transition ${isActive
                  ? "border-b-2 border-slate-950 text-slate-950"
                  : "text-slate-500 hover:text-slate-900"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </section>

      <Outlet />
    </div>
  );
}
