import type { MetaFunction } from "@remix-run/node";
import { NavLink, Outlet, useLocation } from "@remix-run/react";
import { cn } from "@/lib/utils";

export const meta: MetaFunction = () => [{ title: "CRM - Módulo" }];

const tabs = [
  { href: "/admin/crm", label: "Clientes" },
  { href: "/admin/crm/campaigns", label: "Campanhas" },
];

export default function AdminCrmLayout() {
  const location = useLocation();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 font-neue">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre clientes, acompanhe timeline de eventos e envios de campanhas.
        </p>
      </header>

      <div className="flex gap-4 border-b border-border text-sm">
        {tabs.map((tab) => {
          const isActive =
            location.pathname === tab.href ||
            (tab.href !== "/admin/crm" && location.pathname.startsWith(tab.href));
          return (
            <NavLink
              key={tab.href}
              to={tab.href}
              prefetch="intent"
              className={cn(
                "border-b-2 pb-2 transition",
                isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
