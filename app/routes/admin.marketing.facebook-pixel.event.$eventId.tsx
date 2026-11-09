import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import prismaClient from "~/lib/prisma/client.server";

type ActionData =
  | {
      ok: false;
      message: string;
    }
  | {
      ok: true;
      message: string;
    };

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.event ? `${data.event.eventKey} | Pixel do Facebook` : "Editar evento | Pixel do Facebook" },
];

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function loader({ params }: LoaderFunctionArgs) {
  const eventId = String(params.eventId || "").trim();
  if (!eventId) {
    throw new Response("Evento não informado.", { status: 404 });
  }

  const event = await prismaClient.cardapioFacebookPixelEvent.findUnique({
    where: { id: eventId },
    include: {
      config: true,
    },
  });

  if (!event) {
    throw new Response("Evento não encontrado.", { status: 404 });
  }

  return json({ event });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const {
    deleteFacebookPixelEvent,
    isFacebookPixelUniqueError,
    updateFacebookPixelEvent,
    validatePixelEventInput,
  } = await import("~/domain/cardapio/facebook-pixel.server");
  const eventId = String(params.eventId || "").trim();
  if (!eventId) {
    return json<ActionData>({ ok: false, message: "Evento inválido." }, { status: 400 });
  }

  const formData = await request.formData();
  const actionName = getString(formData, "_action");

  try {
    if (actionName === "update-event") {
      const eventKey = getString(formData, "eventKey");
      const eventName = getString(formData, "eventName");
      const trigger = getString(formData, "trigger");
      const payloadJson = getString(formData, "payloadJson");
      const enabled = getBoolean(formData, "enabled");

      const validationError = validatePixelEventInput({
        eventKey,
        eventName,
        trigger,
        payloadJson,
      });

      if (validationError) {
        return json<ActionData>({ ok: false, message: validationError }, { status: 400 });
      }

      await updateFacebookPixelEvent({
        id: eventId,
        eventKey,
        eventName,
        trigger,
        enabled,
        payloadJson,
      });

      return json<ActionData>({ ok: true, message: "Evento atualizado." });
    }

    if (actionName === "delete-event") {
      const currentEvent = await prismaClient.cardapioFacebookPixelEvent.findUnique({
        where: { id: eventId },
        select: { configId: true },
      });

      await deleteFacebookPixelEvent(eventId);

      if (currentEvent?.configId) {
        return redirect(`/admin/marketing/facebook-pixel/config/${currentEvent.configId}`);
      }

      return redirect("/admin/marketing/facebook-pixel");
    }

    return json<ActionData>({ ok: false, message: "Ação inválida." }, { status: 400 });
  } catch (error) {
    if (isFacebookPixelUniqueError(error)) {
      return json<ActionData>(
        { ok: false, message: "Já existe um evento com essa chave interna." },
        { status: 400 }
      );
    }

    console.error("[admin.marketing.facebook-pixel.event.$eventId] action error", error);
    return json<ActionData>({ ok: false, message: "Erro ao salvar evento." }, { status: 500 });
  }
}

export default function AdminMarketingFacebookPixelEventPage() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <div className="text-sm text-slate-500">
          <Link to="/admin/marketing/facebook-pixel" className="hover:underline">
            Pixels do Facebook
          </Link>
          {" / "}
          <Link
            to={`/admin/marketing/facebook-pixel/config/${event.configId}`}
            className="hover:underline"
          >
            {event.config.name}
          </Link>
          {" / "}
          <span>Editar evento</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{event.eventKey}</h1>
        <p className="text-sm text-muted-foreground">
          Edite este evento em uma página dedicada. Ele continuará vinculado apenas à configuração da rota acima.
        </p>
      </div>

      {actionData ? (
        <Alert variant={actionData.ok ? "default" : "destructive"}>
          <AlertTitle>{actionData.ok ? "Ok" : "Erro"}</AlertTitle>
          <AlertDescription>{actionData.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Evento</CardTitle>
          <CardDescription>
            Ajuste a chave interna, o nome enviado ao Meta, o trigger escutado no frontend e o payload padrão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-5">
            <input type="hidden" name="_action" value="update-event" />

            <div className="flex items-center gap-3">
              <input id="enabled" name="enabled" type="checkbox" defaultChecked={event.enabled} className="h-4 w-4" />
              <Label htmlFor="enabled">Evento habilitado</Label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="eventKey">Chave interna</Label>
                <Input id="eventKey" name="eventKey" defaultValue={event.eventKey} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eventName">Nome do evento</Label>
                <Input id="eventName" name="eventName" defaultValue={event.eventName} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trigger">Trigger</Label>
                <Input id="trigger" name="trigger" defaultValue={event.trigger} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payloadJson">Payload JSON padrão</Label>
              <Textarea
                id="payloadJson"
                name="payloadJson"
                rows={8}
                defaultValue={event.payloadJson ?? ""}
                placeholder='{"source":"cardapio"}'
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
                Salvar evento
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to={`/admin/marketing/facebook-pixel/config/${event.configId}`}>Voltar</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-rose-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-700">Remover evento</CardTitle>
          <CardDescription>
            Esta ação elimina o evento apenas desta configuração de rota.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post">
            <input type="hidden" name="_action" value="delete-event" />
            <Button type="submit" variant="destructive">
              Remover evento
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
