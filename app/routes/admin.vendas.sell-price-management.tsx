import { Link, NavLink, Outlet } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import Container from "~/components/layout/container/container";

const tabs = [
  {
    to: "faixas-lucro",
    label: "Faixas de lucro",
    dotClassName: "bg-sky-500",
  },
  {
    to: "precos-por-canal",
    label: "Preços por canal",
    dotClassName: "bg-amber-300",
  },
  {
    to: "revisao-precos",
    label: "Revisão de preços",
    dotClassName: "bg-emerald-300",
  },
];

export default function AdminVendasSellPriceManagementLayout() {
  return (
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin/vendas/itens-vendidos"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">vendas</span>
            </div>

            <nav className="flex flex-wrap items-center gap-8 border-b border-slate-200">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    [
                      "inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition",
                      isActive
                        ? "border-sky-500 text-slate-950"
                        : "border-transparent text-slate-400 hover:text-slate-700",
                    ].join(" ")
                  }
                >
                  <span className={`size-2 rounded-full ${tab.dotClassName}`} />
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>


        </section>

        <Outlet />
      </div>
    </Container>
  );
}
