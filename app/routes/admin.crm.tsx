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

      </header>



      <Outlet />
    </div>
  );
}
