import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Button } from "@/components/ui/button";
import prisma from "~/lib/prisma/client.server";

type ImportLogItem = {
  id: string;
  created_at: Date;
  payload: any;
  customer: { id: string; name: string | null; phone_e164: string } | null;
};

type LoaderData = {
  logs: ImportLogItem[];
};

export async function loader({}: LoaderFunctionArgs) {
  const logs = await prisma.crmCustomerEvent.findMany({
    where: { event_type: "WHATSAPP_IMPORT", source: "zapi-contacts" },
    orderBy: { created_at: "desc" },
    take: 100,
    select: {
      id: true,
      created_at: true,
      payload: true,
      customer: { select: { id: true, name: true, phone_e164: true } },
    },
  });

  return json<LoaderData>({ logs });
}

export default function AdminZapiImportLogsPage() {
  const { logs } = useLoaderData<typeof loader>();

  return (
    <div className="flex max-w-5xl flex-col gap-6 px-4 py-6 font-neue">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs de importação</h1>
          <p className="text-sm text-muted-foreground">
            Últimos eventos de importação do WhatsApp para o CRM.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/zapi/contacts">Voltar</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border/60">
        <div className="hidden grid-cols-[140px_120px_minmax(0,1fr)_120px] gap-4 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <span>Horário</span>
          <span>Status</span>
          <span>Contato</span>
          <span>Motivo</span>
        </div>
        <ul className="divide-y divide-border/60">
          {logs.length ? (
            logs.map((log) => {
              const payload = (log.payload || {}) as any;
              const status = payload.status || "-";
              const reason = payload.reason || "-";
              const displayName = log.customer?.name || payload.name || "Sem nome";
              const displayPhone = log.customer?.phone_e164 || payload.phone_e164 || "-";

              return (
                <li
                  key={log.id}
                  className="flex flex-col gap-2 px-4 py-3 text-xs md:grid md:grid-cols-[140px_120px_minmax(0,1fr)_120px] md:items-center md:gap-4"
                >
                  <div className="text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                  <div className="font-medium uppercase tracking-wide">{status}</div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{displayName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{displayPhone}</span>
                  </div>
                  <div className="text-muted-foreground">{reason}</div>
                </li>
              );
            })
          ) : (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum log encontrado.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
