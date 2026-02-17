import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import prismaClient from "~/lib/prisma/client.server";
import formatMoneyString from "~/utils/format-money-string";

export async function loader({}: LoaderFunctionArgs) {
  const settings = await prismaClient.financialDailyGoalSettings.findMany({
    orderBy: { id: "desc" },
    take: 20,
    select: {
      id: true,
      targetProfitPerc: true,
      salesDistributionPctDay01: true,
      salesDistributionPctDay02: true,
      salesDistributionPctDay03: true,
      salesDistributionPctDay04: true,
      salesDistributionPctDay05: true,
    },
  });

  return json({ settings });
}

function asPct(value: number) {
  return `${formatMoneyString(value ?? 0, 2)}%`;
}

function SettingsDaysGrid({ settings }: { settings: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
      <div className="rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Dia 1 (Quarta)</p>
        <p>{asPct(Number(settings.salesDistributionPctDay01 ?? 0))}</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Dia 2 (Quinta)</p>
        <p>{asPct(Number(settings.salesDistributionPctDay02 ?? 0))}</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Dia 3 (Sexta)</p>
        <p>{asPct(Number(settings.salesDistributionPctDay03 ?? 0))}</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Dia 4 (Sábado)</p>
        <p>{asPct(Number(settings.salesDistributionPctDay04 ?? 0))}</p>
      </div>
      <div className="rounded-md border p-3">
        <p className="text-xs text-muted-foreground">Dia 5 (Domingo)</p>
        <p>{asPct(Number(settings.salesDistributionPctDay05 ?? 0))}</p>
      </div>
    </div>
  );
}

export default function AdminFinanceiroMetasSettingsRoute() {
  const data = useLoaderData<typeof loader>();
  const current = data.settings[0] ?? null;
  const history = data.settings.slice(1);
  const totalDistribution = current
    ? Number(current.salesDistributionPctDay01) +
      Number(current.salesDistributionPctDay02) +
      Number(current.salesDistributionPctDay03) +
      Number(current.salesDistributionPctDay04) +
      Number(current.salesDistributionPctDay05)
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuração atual</CardTitle>
          <CardDescription>Último registro de FinancialDailyGoalSettings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!current ? (
            <p className="text-sm text-muted-foreground">Nenhuma configuração encontrada.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">% lucro desejado</p>
                  <p>{asPct(Number(current.targetProfitPerc ?? 0))}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Somatório da distribuição</p>
                  <p>{asPct(totalDistribution)}</p>
                </div>
              </div>

              <SettingsDaysGrid settings={current} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de configurações</CardTitle>
          <CardDescription>Registros anteriores (até 19 mais recentes).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!history.length ? (
            <p className="text-sm text-muted-foreground">Sem histórico de configurações.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="rounded-md border p-3 space-y-3">
                <p className="text-sm">% lucro desejado: {asPct(Number(item.targetProfitPerc ?? 0))}</p>
                <SettingsDaysGrid settings={item} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
