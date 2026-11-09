import { Link, Outlet, useLocation, useOutletContext } from "@remix-run/react";
import type { AdminItemOutletContext } from "./admin.items.$id";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";

export const meta = buildAdminItemsMeta("Receitas");

export default function AdminItemRecipesTab() {
  const context = useOutletContext<AdminItemOutletContext>();
  const { item } = context;
  const location = useLocation();
  const tabs = [
    {
      label: "Receita vinculada",
      href: "vinculada",
      count: item.Recipe?.length || 0,
    },
    {
      label: "Uso como ingrediente",
      href: "uso-como-ingrediente",
      count: item._ingredientRecipeUsage?.length || 0,
    },
  ];

  return (
    <div className="overflow-hidden bg-white">
      <div className="flex items-end justify-between border-b border-slate-200 px-4">
        <div className="flex">
          {tabs.map((tab) => {
            const isActive = location.pathname.endsWith(`/recipes/${tab.href}`);
            return (
              <Link
                key={tab.href}
                to={tab.href}
                className={`relative flex flex-col items-start px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? "border-b-2 border-slate-900 text-slate-950"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <span
                  className={`inline-flex items-center gap-2 ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <Outlet context={context} />
    </div>
  );
}
