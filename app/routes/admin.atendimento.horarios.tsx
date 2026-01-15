import type { MetaFunction } from "@remix-run/node";
import { Outlet, useLocation, useNavigate } from "@remix-run/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "Horários de Atendimento | Admin" },
  { name: "robots", content: "noindex" },
];

export default function AtendimentoHorariosLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isOffHours = location.pathname.includes("/ausencia");
  const tabValue = isOffHours ? "offhours" : "hours";

  return (
    <div className="font-neue">
      <div className="mb-8 space-y-3 rounded-xl border bg-muted/40 p-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Atendimento
          </p>
          <h1 className="text-3xl font-semibold">Horários de atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Configure os horários de funcionamento e a mensagem de ausência para quando a loja estiver fechada.
          </p>
        </div>
      </div>

      <Tabs
        value={tabValue}
        onValueChange={(value) => {
          navigate(value === "offhours" ? "/admin/atendimento/horarios/ausencia" : "/admin/atendimento/horarios");
        }}
        className="w-full space-y-4"
      >
        <TabsList className="mb-0 rounded-lg border bg-background/80">
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="offhours">Mensagem de ausência</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className={cn("mt-4")}>
        <Outlet />
      </div>
    </div>
  );
}
