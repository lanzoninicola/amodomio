import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "~/lib/prisma/client.server";
import { useLoaderData } from "@remix-run/react";

type LoaderData = {
  sends: Array<{
    id: string;
    campaign_name: string;
    status: string | null;
    created_at: string;
  }>;
};

export async function loader({ params }: LoaderFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) throw new Response("not found", { status: 404 });

  const sends = await prisma.crmCampaignSend.findMany({
    where: { customer_id: customerId },
    include: { campaign: true },
    orderBy: { created_at: "desc" },
    take: 20,
  });

  return json<LoaderData>({
    sends: sends.map((s) => ({
      id: s.id,
      campaign_name: s.campaign?.name || "Campanha",
      status: s.status,
      created_at: s.created_at.toISOString(),
    })),
  });
}

export default function AdminCrmCustomerSends() {
  const { sends } = useLoaderData<typeof loader>();

  return (
    <Card className="font-neue">
      <CardHeader>
        <CardTitle>Envios de campanha</CardTitle>
        <CardDescription>Últimos 20 envios para este cliente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sends.length ? (
          sends.map((s) => (
            <div key={s.id} className="rounded border border-border px-3 py-2">
              <div className="text-sm font-medium">{s.campaign_name}</div>
              <div className="text-xs text-muted-foreground">
                {s.status || "status?"} • {new Date(s.created_at).toLocaleString()}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
        )}
      </CardContent>
    </Card>
  );
}

export const meta: MetaFunction = () => [{ title: "CRM - Envios" }];
