import type { MetaFunction } from "@remix-run/node";
import { Link, NavLink, Outlet } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import Container from "~/components/layout/container/container";

export const meta: MetaFunction = () => [
  { title: "Vendas | Análise de cardápio da concorrência" },
  { name: "robots", content: "noindex" },
];

const tabs = [
  {
    to: "pesquisar",
    label: "Pesquisar",
    dotClassName: "bg-sky-500",
  },
  {
    to: "coletas",
    label: "Coletas",
    dotClassName: "bg-amber-300",
  },
];

export default function CompetitorMenuAnalysisLayout() {
  return (
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
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
                <span className="text-slate-300">/</span>
                <span className="font-medium text-slate-900">ferramentas</span>
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Análise de cardápio da concorrência
                </h1>
                <p className="text-sm text-slate-500">
                  Consulte produtos e preços dos concorrentes a partir dos snapshots do scraper aiqfome.
                </p>
              </div>
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
