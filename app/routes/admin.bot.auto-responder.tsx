import { Outlet, useLocation, Link } from "@remix-run/react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function AutoResponderLayout() {
  const { pathname } = useLocation();
  const value = pathname.includes("/new")
    ? "new"
    : pathname.includes("/settings")
      ? "settings"
      : pathname.match(/\/[a-z0-9-]+\/edit$/i)
        ? "edit"
        : "list";

  const base = "/admin/bot/auto-responder";

  return (
    <div className="mx-auto max-w-6xl space-y-6 mb-12">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">WPP • Auto-responder</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie regras, horários e mensagens automáticas.
          </p>
        </div>
      </header>

      <Tabs value={value} className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-4 w-full">
          <TabsTrigger value="list" asChild>
            <Link to={base}>Regras</Link>
          </TabsTrigger>
          <TabsTrigger value="new" asChild>
            <Link to={`${base}/new`}>Nova</Link>
          </TabsTrigger>
          <TabsTrigger
            value="edit"
            className={cn(value === "edit" ? "opacity-100" : "pointer-events-none opacity-50")}
          >
            Editar
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link to={`${base}/settings`}>Configurações</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Separator />
      <Outlet />
    </div>
  );
}
