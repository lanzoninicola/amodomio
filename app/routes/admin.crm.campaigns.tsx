import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "~/lib/prisma/client.server";
import { useLoaderData } from "@remix-run/react";

type LoaderData = {
  campaigns: Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    sends: number;
  }>;
};

export async function loader({ }: LoaderFunctionArgs) {
  const campaigns = await prisma.crmCampaign.findMany({
    orderBy: { created_at: "desc" },
    include: { _count: { select: { sends: true } } },
    take: 50,
  });

  return json<LoaderData>({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      created_at: c.created_at.toISOString(),
      sends: c._count.sends,
    })),
  });
}

export const meta: MetaFunction = () => [{ title: "CRM - Campanhas" }];

export default function AdminCrmCampaigns() {
  const { campaigns } = useLoaderData<typeof loader>();

  return (
    <div className="font-neue space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Campanhas</h2>
        <p className="text-sm text-muted-foreground">Visualização simples das campanhas registradas.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {campaigns.length ? (
          campaigns.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <CardDescription>
                  {c.description || "Sem descrição"} • {new Date(c.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Envios registrados: {c.sends}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Nenhuma campanha cadastrada.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
