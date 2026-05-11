import { FacebookPixelIntegrationMode } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
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

type ActionData =
  | {
      ok: false;
      message: string;
    }
  | {
      ok: true;
      message: string;
    };

export const meta: MetaFunction = () => [{ title: "Pixels do Facebook | Marketing" }];

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function summarizeIdentifiers(config: {
  mode: FacebookPixelIntegrationMode;
  pixelId: string | null;
  gtmContainerId: string | null;
}) {
  if (config.mode === FacebookPixelIntegrationMode.direct) {
    return config.pixelId || "-";
  }

  return config.gtmContainerId || "-";
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { listFacebookPixelConfigs } = await import("~/domain/cardapio/facebook-pixel.server");
  const configs = await listFacebookPixelConfigs();
  return json({ configs });
}

export async function action({ request }: ActionFunctionArgs) {
  const {
    createFacebookPixelConfig,
    isFacebookPixelUniqueError,
    validatePixelConfigInput,
  } = await import("~/domain/cardapio/facebook-pixel.server");
  const formData = await request.formData();
  const actionName = getString(formData, "_action");

  try {
    if (actionName !== "create-config") {
      return json<ActionData>({ ok: false, message: "Ação inválida." }, { status: 400 });
    }

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

    await createFacebookPixelConfig({
      name,
      routePath,
      enabled,
      mode,
      pixelId,
      gtmContainerId,
    });

    return json<ActionData>({ ok: true, message: "Configuração criada." });
  } catch (error) {
    if (isFacebookPixelUniqueError(error)) {
      return json<ActionData>(
        { ok: false, message: "Já existe uma configuração para esta rota." },
        { status: 400 }
      );
    }

    console.error("[admin.marketing.facebook-pixel] action error", error);
    return json<ActionData>({ ok: false, message: "Erro ao criar configuração." }, { status: 500 });
  }
}

export default function AdminMarketingFacebookPixelPage() {
  const { configs } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pixels do Facebook</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie múltiplos pixels por rota. Cada configuração define onde o script entra e quais eventos ela controla.
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
          <CardTitle>Configurações</CardTitle>
          <CardDescription>
            Cada linha representa um pixel aplicável a uma rota. A resolução no runtime usa a rota mais específica que casar com o pathname atual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Eventos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhuma configuração cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium text-slate-900">{config.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs">{config.routePath}</code>
                    </TableCell>
                    <TableCell>{config.mode === FacebookPixelIntegrationMode.direct ? "Direto" : "GTM"}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {summarizeIdentifiers(config)}
                    </TableCell>
                    <TableCell>{config.events.length}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          config.enabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }
                      >
                        {config.enabled ? "Habilitado" : "Desabilitado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/marketing/facebook-pixel/config/${config.id}`}>Editar</Link>
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
          <CardTitle>Nova configuração</CardTitle>
          <CardDescription>
            Use uma rota por configuração. Exemplo: `/cardapio`, `/landing/black-friday`, `/campanhas/pascoa`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-5">
            <input type="hidden" name="_action" value="create-config" />

            <div className="flex items-center gap-3">
              <input id="enabled" name="enabled" type="checkbox" defaultChecked className="h-4 w-4" />
              <Label htmlFor="enabled">Criar já habilitado</Label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="ex.: Cardápio Delivery" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="routePath">Rota</Label>
                <Input id="routePath" name="routePath" placeholder="ex.: /cardapio" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="mode">Modo</Label>
                <select
                  id="mode"
                  name="mode"
                  defaultValue={FacebookPixelIntegrationMode.direct}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={FacebookPixelIntegrationMode.direct}>Direto</option>
                  <option value={FacebookPixelIntegrationMode.gtm}>GTM</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pixelId">Pixel ID</Label>
                <Input id="pixelId" name="pixelId" placeholder="ex.: 123456789012345" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gtmContainerId">Container GTM</Label>
                <Input id="gtmContainerId" name="gtmContainerId" placeholder="ex.: GTM-ABCDE12" />
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-muted-foreground">
              Cada nova configuração já nasce com os eventos default `page_view` e `fazer_pedido_click`.
            </div>

            <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
              Criar configuração
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
