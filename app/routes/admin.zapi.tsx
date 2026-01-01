import { NavLink, Outlet, useLocation } from "@remix-run/react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/zapi/playground", label: "Playground" },
  { href: "/admin/zapi/contacts", label: "Contatos" },
  { href: "/admin/zapi/logs", label: "Webhook Logs" },
];

export default function AdminZapiLayout() {
  const location = useLocation();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Z-API</h1>
        <p className="text-sm text-muted-foreground">
          Integração Z-API: playground e contatos.
        </p>
      </header>

      <div className="flex gap-3 border-b border-border">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.href;
          return (
            <NavLink
              key={tab.href}
              to={tab.href}
              prefetch="intent"
              className={cn(
                "border-b-2 pb-2 text-sm font-medium",
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
