import { NavLink, Outlet, useLocation } from "@remix-run/react";
import { BarChart3, Eye, MousePointerClick, Utensils } from "lucide-react";
import { cn } from "~/lib/utils";

const dashboardTabs = [
  {
    label: "Visitas",
    href: "/admin/gerenciamento/cardapio/dashboard/visitas",
    icon: Eye,
  },
  {
    label: "Navegação e filtros",
    href: "/admin/gerenciamento/cardapio/dashboard/navegacao",
    icon: MousePointerClick,
  },
  {
    label: "Interesse por sabor",
    href: "/admin/gerenciamento/cardapio/dashboard/tracking",
    icon: BarChart3,
  },
  {
    label: "Engenharia de menu",
    href: "/admin/gerenciamento/cardapio/dashboard/menu-engineering",
    icon: Utensils,
  },
];

export default function CardapioDashboardLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Análises do cardápio
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Desempenho e comportamento
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe tráfego, uso da navegação, interesse pelos sabores e
            resultado comercial.
          </p>
        </div>

        <nav
          aria-label="Relatórios do cardápio"
          className="-mx-1 overflow-x-auto px-1 pb-1"
        >
          <div className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {dashboardTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                location.pathname === tab.href ||
                location.pathname.startsWith(`${tab.href}/`);

              return (
                <NavLink
                  key={tab.href}
                  to={tab.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </header>

      <Outlet />
    </div>
  );
}
