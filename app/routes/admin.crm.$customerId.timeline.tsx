import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import prisma from "~/lib/prisma/client.server";

type LoaderData = {
  events: Array<{
    id: string;
    event_type: string;
    source: string | null;
    created_at: string;
    payload_raw: string | null;
  }>;
};

type Context = { customer: { id: string; name: string; phone_e164: string } };

export async function loader({ params }: LoaderFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) throw new Response("not found", { status: 404 });

  const events = await prisma.crmCustomerEvent.findMany({
    where: { customer_id: customerId },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return json<LoaderData>({
    events: events.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      source: e.source,
      created_at: e.created_at.toISOString(),
      payload_raw: e.payload_raw,
    })),
  });
}

type ActionData = { error?: string };

export const meta: MetaFunction = () => [{ title: "CRM - Timeline" }];

export async function action({ request, params }: ActionFunctionArgs) {
  const customerId = params.customerId;
  if (!customerId) return json({ error: "not_found" }, { status: 404 });

  const form = await request.formData();
  const type = String(form.get("event_type") || "").trim() || "NOTE";
  const payload_raw = String(form.get("payload_raw") || "").trim() || null;
  const source = "admin-ui";

  await prisma.crmCustomerEvent.create({
    data: {
      customer_id: customerId,
      event_type: type,
      source,
      payload: { action: "manual_event", source },
      payload_raw,
    },
  });

  return redirect(`/admin/crm/${customerId}/timeline`);
}

export default function AdminCrmCustomerTimeline() {
  const { events } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  useOutletContext<Context>(); // ensure context exists

  return (
    <Card className="font-neue">
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
        <CardDescription>Últimos eventos (50 mais recentes).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionData?.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionData.error}
          </div>
        )}
        <Form method="post" className="grid gap-2 md:grid-cols-3 md:items-end">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Input name="event_type" placeholder="NOTE / MESSAGE_RECEIVED / ISSUE" />
          </div>
          <div className="md:col-span-2 grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Payload (texto livre)</label>
            <Textarea name="payload_raw" placeholder="Ex: Mensagem recebida, anotação, etc." rows={2} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Registrar evento"}
            </Button>
          </div>
        </Form>

        <div className="space-y-2">
          {events.length ? (
            events.map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
                    {e.event_type}
                  </Badge>
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                  {e.source && <span>• {e.source}</span>}
                </div>
                {e.payload_raw && (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-foreground">
                    {e.payload_raw}
                  </pre>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
