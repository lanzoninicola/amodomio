import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData, useSubmit } from "@remix-run/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import prismaClient from "~/lib/prisma/client.server";
import {
  ENGAGEMENT_SETTINGS_CONTEXT,
  LIKE_SETTING_NAME,
  SHARE_SETTING_NAME,
} from "~/domain/cardapio/engagement-settings.server";

const SETTING_TYPES = ["string", "boolean", "float", "int", "json"] as const;

export const meta: MetaFunction = () => ([{ title: "Configurações globais" }]);

function isUUID(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function str(value: FormDataEntryValue | null) {
  return (value == null ? "" : String(value)).trim();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const context = url.searchParams.get("context")?.trim() ?? "";

  const filters = [];
  if (q) {
    filters.push({
      OR: [
        { context: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { value: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (context) {
    filters.push({ context });
  }

  const where = filters.length ? { AND: filters } : {};

  const [likesSetting, sharesSetting] = await Promise.all([
    prismaClient.setting.findFirst({
      where: { context: ENGAGEMENT_SETTINGS_CONTEXT, name: LIKE_SETTING_NAME },
      orderBy: [{ createdAt: "desc" }],
    }),
    prismaClient.setting.findFirst({
      where: { context: ENGAGEMENT_SETTINGS_CONTEXT, name: SHARE_SETTING_NAME },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  if (!likesSetting) {
    await prismaClient.setting.create({
      data: {
        context: ENGAGEMENT_SETTINGS_CONTEXT,
        name: LIKE_SETTING_NAME,
        type: "boolean",
        value: "true",
        createdAt: new Date(),
      },
    });
  }

  if (!sharesSetting) {
    await prismaClient.setting.create({
      data: {
        context: ENGAGEMENT_SETTINGS_CONTEXT,
        name: SHARE_SETTING_NAME,
        type: "boolean",
        value: "true",
        createdAt: new Date(),
      },
    });
  }

  const settings = await prismaClient.setting.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
  });

  const contextsRows = await prismaClient.setting.findMany({
    distinct: ["context"],
    select: { context: true },
  });
  const contexts = contextsRows
    .map((row) => row.context)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return json({ settings, q, context, contexts });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = String(formData.get("_action") || "");

  try {
    switch (action) {
      case "create": {
        const context = str(formData.get("context"));
        const name = str(formData.get("name"));
        const type = str(formData.get("type"));
        const value = str(formData.get("value"));

        const fieldError: Record<string, string> = {};
        if (!context) fieldError.context = "Obrigatorio";
        if (!name) fieldError.name = "Obrigatorio";
        if (!type) fieldError.type = "Obrigatorio";

        if (Object.keys(fieldError).length) {
          return json({ fieldError }, { status: 400 });
        }

        const exists = await prismaClient.setting.findFirst({
          where: { context, name },
        });
        if (exists) {
          return json({ fieldError: { name: "Ja existe uma configuracao com esse contexto e nome" } }, { status: 400 });
        }

        await prismaClient.setting.create({
          data: {
            context,
            name,
            type,
            value,
            createdAt: new Date(),
          },
        });

        return redirect("/admin/administracao/settings");
      }

      case "update": {
        const id = str(formData.get("id"));
        const context = str(formData.get("context"));
        const name = str(formData.get("name"));
        const type = str(formData.get("type"));
        const value = str(formData.get("value"));

        const fieldError: Record<string, string> = {};
        if (!isUUID(id)) fieldError.id = "ID invalido";
        if (!context) fieldError.context = "Obrigatorio";
        if (!name) fieldError.name = "Obrigatorio";
        if (!type) fieldError.type = "Obrigatorio";

        if (Object.keys(fieldError).length) {
          return json({ fieldError }, { status: 400 });
        }

        const duplicate = await prismaClient.setting.findFirst({
          where: {
            context,
            name,
            NOT: { id },
          },
        });
        if (duplicate) {
          return json({ fieldError: { name: "Outro registro ja usa esse contexto e nome" } }, { status: 400 });
        }

        await prismaClient.setting.update({
          where: { id },
          data: { context, name, type, value },
        });

        return json({ ok: true });
      }

      case "delete": {
        const id = str(formData.get("id"));
        if (!isUUID(id)) return json({ fieldError: { id: "ID invalido" } }, { status: 400 });
        await prismaClient.setting.delete({ where: { id } });
        return json({ ok: true });
      }
      default:
        return json({ error: "Acao invalida" }, { status: 400 });
    }
  } catch (err: any) {
    console.error(err);
    return json({ error: err?.message ?? "Erro inesperado" }, { status: 500 });
  }
}

export default function AdminSettingsPage() {
  const { settings, q, context, contexts } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Configuracoes globais</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as configuracoes globais da aplicacao (contexto, nome, tipo e valor).
          </p>
        </div>

        <CreateDialog contexts={contexts} defaultError={actionData as any} />
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <CardTitle className="text-lg">Lista</CardTitle>
          <Form method="get" className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto" onChange={(e) => submit(e.currentTarget)}>
            <div className="grid gap-2 w-full md:w-auto">
              <Label htmlFor="q" className="sr-only">Buscar</Label>
              <Input id="q" name="q" placeholder="Buscar por contexto, nome, tipo ou valor" defaultValue={q ?? ""} className="w-full md:w-72" />
            </div>
            <div className="grid gap-2 w-full md:w-auto">
              <Label htmlFor="context-filter" className="sr-only">Contexto</Label>
              <select
                id="context-filter"
                name="context"
                defaultValue={context ?? ""}
                className="h-10 w-full md:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os contextos</option>
                {contexts.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">Buscar</Button>
          </Form>
        </CardHeader>
        <Separator />
        <CardContent>
          <Table>
            <TableCaption>
              {settings.length === 0 ? (
                <span className="text-muted-foreground">Nenhum registro encontrado</span>
              ) : (
                <span>{settings.length} registro(s)</span>
              )}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Contexto</TableHead>
                <TableHead className="w-[220px]">Nome</TableHead>
                <TableHead className="w-[140px]">Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="w-[180px]">Criado</TableHead>
                <TableHead className="w-[160px] text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((setting) => (
                <RowItem key={setting.id} setting={setting} contexts={contexts} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateDialog({ contexts, defaultError }: { contexts: string[]; defaultError?: any }) {
  const fetcher = useFetcher<typeof action>();
  const isBusy = fetcher.state !== "idle";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="text-sm uppercase tracking-wide">Nova configuracao</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Criar configuracao</DialogTitle>
          <DialogDescription>Crie uma configuracao global com contexto, nome, tipo e valor.</DialogDescription>
        </DialogHeader>

        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="create" />

          <div className="grid gap-2">
            <Label htmlFor="context">Contexto</Label>
            <Input id="context" name="context" list="context-options" required placeholder="ex.: store-opening" />
            <datalist id="context-options">
              {contexts.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            {((defaultError as any)?.fieldError?.context || (fetcher.data as any)?.fieldError?.context) && (
              <p className="text-xs text-destructive">
                {((defaultError as any)?.fieldError?.context || (fetcher.data as any)?.fieldError?.context) as string}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required placeholder="ex.: maxTimeDeliveryMinutes" />
            {((defaultError as any)?.fieldError?.name || (fetcher.data as any)?.fieldError?.name) && (
              <p className="text-xs text-destructive">
                {((defaultError as any)?.fieldError?.name || (fetcher.data as any)?.fieldError?.name) as string}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Tipo</Label>
            <select
              id="type"
              name="type"
              defaultValue=""
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="" disabled>Selecione um tipo</option>
              {SETTING_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {((defaultError as any)?.fieldError?.type || (fetcher.data as any)?.fieldError?.type) && (
              <p className="text-xs text-destructive">
                {((defaultError as any)?.fieldError?.type || (fetcher.data as any)?.fieldError?.type) as string}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="value">Valor</Label>
            <Textarea id="value" name="value" placeholder='ex.: true, 120, {"foo": "bar"}' />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isBusy}>{isBusy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function RowItem({ setting, contexts }: { setting: any; contexts: string[] }) {
  const fetcher = useFetcher<typeof action>();
  const isBusy = fetcher.state !== "idle";

  return (
    <TableRow className="align-top">
      <TableCell>
        <div className="text-sm break-words">{setting.context}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm break-words">{setting.name}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{setting.type}</div>
      </TableCell>
      <TableCell>
        <pre className="whitespace-pre-wrap text-sm max-w-[60ch] break-words font-sans">{setting.value}</pre>
      </TableCell>
      <TableCell>
        <span>{new Date(setting.createdAt).toLocaleString()}</span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <EditDialog setting={setting} contexts={contexts} />

          <fetcher.Form method="post">
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={setting.id} />
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isBusy}
              onClick={(event) => {
                if (!confirm(`Excluir "${setting.name}"?`)) event.preventDefault();
              }}
            >
              Excluir
            </Button>
          </fetcher.Form>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditDialog({ setting, contexts }: { setting: any; contexts: string[] }) {
  const fetcher = useFetcher<typeof action>();
  const isBusy = fetcher.state !== "idle";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Editar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar configuracao</DialogTitle>
          <DialogDescription>Atualize os campos abaixo e salve.</DialogDescription>
        </DialogHeader>

        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="update" />
          <input type="hidden" name="id" value={setting.id} />

          <div className="grid gap-2">
            <Label htmlFor={`context-${setting.id}`}>Contexto</Label>
            <Input id={`context-${setting.id}`} name="context" list={`context-options-${setting.id}`} required defaultValue={setting.context} />
            <datalist id={`context-options-${setting.id}`}>
              {contexts.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            {(fetcher.data as any)?.fieldError?.context && (
              <p className="text-xs text-destructive">{(fetcher.data as any)?.fieldError?.context as string}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`name-${setting.id}`}>Nome</Label>
            <Input id={`name-${setting.id}`} name="name" required defaultValue={setting.name} />
            {(fetcher.data as any)?.fieldError?.name && (
              <p className="text-xs text-destructive">{(fetcher.data as any)?.fieldError?.name as string}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`type-${setting.id}`}>Tipo</Label>
            <select
              id={`type-${setting.id}`}
              name="type"
              defaultValue={setting.type ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="" disabled>Selecione um tipo</option>
              {SETTING_TYPES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {(fetcher.data as any)?.fieldError?.type && (
              <p className="text-xs text-destructive">{(fetcher.data as any)?.fieldError?.type as string}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`value-${setting.id}`}>Valor</Label>
            <Textarea id={`value-${setting.id}`} name="value" defaultValue={setting.value ?? ""} />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={isBusy}>{isBusy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
