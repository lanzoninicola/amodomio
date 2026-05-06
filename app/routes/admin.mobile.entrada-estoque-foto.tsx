import type { MetaFunction } from "@remix-run/node";
import { NavLink, Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Admin Mobile | Entrada de estoque por foto" },
];

export default function AdminMobileEntradaEstoqueFotoLayout() {
  return (
    <div className="space-y-4 pb-8">
      <nav className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <NavLink
          to="unica"
          end
          className={({ isActive }) =>
            `flex-1 rounded-lg py-2 text-center text-sm font-medium transition ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          1 cupom
        </NavLink>
        <NavLink
          to="multipla"
          className={({ isActive }) =>
            `flex-1 rounded-lg py-2 text-center text-sm font-medium transition ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`
          }
        >
          Múltiplos cupons
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
