import { NavLink, Outlet } from "@remix-run/react";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, Settings2, Target } from "lucide-react";

function linkClass(isActive: boolean) {
  return isActive
    ? "text-base font-semibold underline"
    : "text-base font-medium text-muted-foreground hover:underline";
}

export default function AdminFinanceiroMetasLayout() {
  return (
    <div className="space-y-4 mb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Metas Financeiras</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Estrutura inicial em layout/outlet. Vamos evoluir essa tela por partes.
      </p>

      <div className="flex items-center gap-5">
        <NavLink to="/admin/financeiro/metas" end className={({ isActive }) => linkClass(isActive)}>
          <span className="inline-flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            Metas
          </span>
        </NavLink>
        <Separator orientation="vertical" className="h-5" />
        <NavLink to="/admin/financeiro/metas/create" className={({ isActive }) => linkClass(isActive)}>
          <span className="inline-flex items-center gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Nova meta
          </span>
        </NavLink>
        <Separator orientation="vertical" className="h-5" />
        <NavLink to="/admin/financeiro/metas/settings" className={({ isActive }) => linkClass(isActive)}>
          <span className="inline-flex items-center gap-1.5">
            <Settings2 className="h-4 w-4" />
            Configuração
          </span>
        </NavLink>
      </div>

      <Separator />

      <Outlet />
    </div>
  );
}
