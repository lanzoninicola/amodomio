import { FacebookPixelIntegrationMode } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";

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
  { title: data?.config ? `${data.config.name} | Pixel do Facebook` : "Configuração de pixel" },
];

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function formatPayloadPreview(payloadJson: string | null) {
  if (!payloadJson?.trim()) return "-";
  return payloadJson.length > 80 ? `${payloadJson.slice(0, 80)}...` : payloadJson;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { getFacebookPixelConfigById } = await import("~/domain/cardapio/facebook-pixel.server");
  const configId = String(params.configId || "").trim();
  if (!configId) throw new Response("Configuração não informada.", { status: 404 });

  const config = await getFacebookPixelConfigById(configId);
  if (!config) throw new Response("Configuração não encontrada.", { status: 404 });

  return json({ config });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const {
    createFacebookPixelEvent,
    isFacebookPixelUniqueError,
    updateFacebookPixelConfig,
    validatePixelConfigInput,
    validatePixelEventInput,
  } = await import("~/domain/cardapio/facebook-pixel.server");
  const configId = String(params.configId || "").trim();
  if (!configId) {
    return json<ActionData>({ ok: false, message: "Configuração inválida." }, { status: 400 });
  }

  const formData = await request.formData();
  const actionName = getString(formData, "_action");

  try {
    if (actionName === "save-config") {
      const name = getString(formData, "name");
      const routePath = getString(formData, "routePath");
      const enabled = getBoolean(formData, "enabled");
      const mode =
        getString(formData, "mode") === FacebookPixelIntegrationMode.gtm
          ? FacebookPixelIntegrationMode.gtm
          : FacebookPixelIntegrationMode.direct;
      const pixelId = getString(formData, "pixelId");
      const gtmContainerId = getString(formData, "gtmContainerId");

      const validationError = validatePixelConfigInput({
        name,
        routePath,
        enabled,
        mode,
        pixelId,
        gtmContainerId,
      });

      if (validationError) {
        return json<ActionData>({ ok: false, message: validationError }, { status: 400 });
      }

      await updateFacebookPixelConfig({
        id: configId,
        name,
        routePath,
        enabled,
        mode,
        pixelId,
        gtmContainerId,
      });

      return json<ActionData>({ ok: true, message: "Configuração atualizada." });
    }

    if (actionName === "create-event") {
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

      await createFacebookPixelEvent({
        configId,
        eventKey,
        eventName,
        trigger,
        enabled,
        payloadJson,
      });

      return redirect(`/admin/marketing/facebook-pixel/config/${configId}`);
    }

    return json<ActionData>({ ok: false, message: "Ação inválida." }, { status: 400 });
  } catch (error) {
    if (isFacebookPixelUniqueError(error)) {
      return json<ActionData>(
        { ok: false, message: "Já existe uma configuração para esta rota ou uma chave de evento duplicada." },
        { status: 400 }
      );
    }

    console.error("[admin.marketing.facebook-pixel.config.$configId] action error", error);
    return json<ActionData>({ ok: false, message: "Erro ao salvar configuração." }, { status: 500 });
  }
}

export default function AdminMarketingFacebookPixelConfigPage() {
  const { config } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <div className="text-sm text-slate-500">
          <Link to="/admin/marketing/facebook-pixel" className="hover:underline">
            Pixels do Facebook
          </Link>
          {" / "}
          <span>{config.name}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{config.name}</h1>
        <p className="text-sm text-muted-foreground">
          Edite a configuração principal desta rota e gerencie os eventos vinculados.
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
          <CardTitle>Integração</CardTitle>
          <CardDescription>
            Defina em qual rota este pixel entra e qual modo de integração deve ser usado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-5">
            <input type="hidden" name="_action" value="save-config" />

            <div className="flex items-center gap-3">
              <input id="enabled" name="enabled" type="checkbox" defaultChecked={config.enabled} className="h-4 w-4" />
              <Label htmlFor="enabled">Integração habilitada</Label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" defaultValue={config.name} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="routePath">Rota</Label>
                <Input id="routePath" name="routePath" defaultValue={config.routePath} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="mode">Modo</Label>
                <select
                  id="mode"
                  name="mode"
                  defaultValue={config.mode}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={FacebookPixelIntegrationMode.direct}>Direto</option>
                  <option value={FacebookPixelIntegrationMode.gtm}>GTM</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pixelId">Pixel ID</Label>
                <Input id="pixelId" name="pixelId" defaultValue={config.pixelId ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gtmContainerId">Container GTM</Label>
                <Input id="gtmContainerId" name="gtmContainerId" defaultValue={config.gtmContainerId ?? ""} />
              </div>
            </div>

            <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
              Salvar configuração
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>
            Eventos vinculados a esta configuração. A edição continua em uma página dedicada por evento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Evento Meta</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payload</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Nenhum evento cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                config.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium text-slate-900">{event.eventKey}</TableCell>
                    <TableCell>{event.eventName}</TableCell>
                    <TableCell>
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs">{event.trigger}</code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          event.enabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }
                      >
                        {event.enabled ? "Habilitado" : "Desabilitado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate font-mono text-xs text-slate-600">
                      {formatPayloadPreview(event.payloadJson)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/marketing/facebook-pixel/event/${event.id}`}>Editar</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Novo evento</CardTitle>
          <CardDescription>
            Novos eventos ficam vinculados apenas a esta configuração.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="_action" value="create-event" />

            <div className="flex items-center gap-3">
              <input id="create-enabled" name="enabled" type="checkbox" defaultChecked className="h-4 w-4" />
              <Label htmlFor="create-enabled">Criar já habilitado</Label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="create-event-key">Chave interna</Label>
                <Input id="create-event-key" name="eventKey" placeholder="ex.: item_view" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-event-name">Nome do evento</Label>
                <Input id="create-event-name" name="eventName" placeholder="ex.: ViewContent" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-trigger">Trigger</Label>
                <Input id="create-trigger" name="trigger" placeholder="ex.: item_view" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-payload">Payload JSON padrão</Label>
              <Textarea id="create-payload" name="payloadJson" rows={4} placeholder='{"source":"cardapio"}' />
            </div>

            <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
              Adicionar evento
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
