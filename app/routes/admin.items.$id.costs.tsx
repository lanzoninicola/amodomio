import { Link, Outlet, useLocation, useOutletContext } from "@remix-run/react";
import type { AdminItemOutletContext } from "./admin.items.$id";

const COSTS_TABS = [
  { name: "Custos atuais", href: "" },
  { name: "Levantamento", href: "manual" },
  { name: "Histórico", href: "history" },
  { name: "Auditoria", href: "audit" },
] as const;

function getActiveTab(pathname: string): string {
  const segment = pathname.split("/costs")[1] ?? "";
  const clean = segment.replace(/^\//, "").split("/")[0];
  return clean || "";
}

export default function AdminItemCostsLayout() {
  const ctx = useOutletContext<AdminItemOutletContext>();
  const item = ctx.item;
  const { pathname } = useLocation();
  const activeTab = getActiveTab(pathname);
  const basePath = `/admin/items/${item.id}/costs`;

  return (
    <div className="space-y-5">
      <nav className="border-b border-slate-100">
        <div className="flex items-center gap-5 text-sm overflow-x-auto">
          {COSTS_TABS.map((tab) => {
            const isActive = activeTab === tab.href;
            return (
              <Link
                key={tab.href}
                to={tab.href === "" ? basePath : `${basePath}/${tab.href}`}
                className={`shrink-0 border-b-2 pb-2.5 font-medium transition ${
                  isActive
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </nav>

      <Outlet context={ctx} />
    </div>
  );
}
