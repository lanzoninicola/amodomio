import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData, useLocation, useNavigate } from "@remix-run/react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { settingPrismaEntity } from "~/domain/setting/setting.prisma.entity.server";
import { STORE_OPENING_CONTEXT } from "~/domain/store-opening/store-opening-settings";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [
  { title: "Horários de Atendimento | Admin" },
  { name: "robots", content: "noindex" },
];

type LoaderData = {
  offHoursEnabled: boolean;
};

export async function loader({}: LoaderFunctionArgs) {
  const setting = await settingPrismaEntity.findByContextAndName(
    STORE_OPENING_CONTEXT,
    "off-hours-enabled"
  );
  const offHoursEnabled = (setting?.value ?? "true") === "true";
  return json<LoaderData>({ offHoursEnabled });
}

export default function AtendimentoHorariosLayout() {
  const { offHoursEnabled } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const isOffHours = location.pathname.includes("/ausencia");
  const tabValue = isOffHours ? "offhours" : "hours";

  return (
    <div className="font-neue">
      <div className="mb-8 space-y-3 rounded-xl border bg-muted/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Atendimento
            </p>
            <h1 className="text-3xl font-semibold">Horários de atendimento</h1>
            <p className="text-sm text-muted-foreground">
              Configure os horários de funcionamento e a mensagem de ausência para quando a loja estiver fechada.
            </p>
          </div>
          <Badge
            className={cn(
              "mt-1 text-xs uppercase tracking-[0.12em]",
              offHoursEnabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
            )}
          >
            {offHoursEnabled ? "Ausência ativa" : "Ausência inativa"}
          </Badge>
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
