import { NavLink, Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";

export default function DashboardLayout() {
  return (
    <Container className="md:max-w-none">
      <div className="py-8 px-2 md:px-4 max-w-screen-xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Performance</h1>
        </div>

        <div className="mb-6 flex border-b border-slate-200">
          <NavLink
            to="/admin/dashboard/faturamento"
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`
            }
          >
            Faturamento
          </NavLink>
          <NavLink
            to="/admin/dashboard/custos"
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`
            }
          >
            Custos
          </NavLink>
        </div>

        <Outlet />
      </div>
    </Container>
  );
}
