// app/routes/admin.cardapio-settings._index.tsx
// Página CRUD para o modelo Prisma `CardapioSetting`
// - Lista com busca
// - Criar, Editar e Excluir com Dialog (shadcn/ui)
// - Validação sem Zod (checagens manuais)
// - Ações diferenciadas por _action
// OBS: ajuste os imports de shadcn conforme seu setup

import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useSearchParams, useSubmit, useFetcher } from "@remix-run/react";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import prismaClient from "~/lib/prisma/client.server";
import { parseBooleanSetting } from "~/utils/parse-boolean-setting";

const NOTIFICATIONS_SETTING_KEY = "cardapio.notificacoes.enabled";
const NOTIFICATIONS_SETTING_NAME = "Notificações do cardápio";

export const meta: MetaFunction = () => ([{ title: "Cardápio • Configurações" }]);

// ======== Util ========
function isUUID(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v));
}

function str(v: FormDataEntryValue | null) {
  return (v == null ? "" : String(v)).trim();
}

// ======== Loader ========
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const where = q
    ? {
      OR: [
        { key: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { value: { contains: q, mode: "insensitive" } }
      ]
    }
    : {};

  const settings = await prismaClient.cardapioSetting.findMany({
    where,
    orderBy: [{ createdAt: "desc" }]
  });

  const notificationsSetting = await prismaClient.cardapioSetting.findFirst({
    where: { key: NOTIFICATIONS_SETTING_KEY },
    orderBy: [{ createdAt: "desc" }],
  });

  return json({ settings, q, notificationsSetting });
}

// ======== Action (sem Zod) ========
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = String(formData.get("_action") || "");

  try {
    switch (action) {
      case "toggle-notifications": {
        const enabled = formData.get("notificationsEnabled") === "on";
        const existing = await prismaClient.cardapioSetting.findFirst({
          where: { key: NOTIFICATIONS_SETTING_KEY },
          orderBy: [{ createdAt: "desc" }],
        });

        if (existing) {
          await prismaClient.cardapioSetting.update({
            where: { id: existing.id },
            data: {
              key: NOTIFICATIONS_SETTING_KEY,
              name: NOTIFICATIONS_SETTING_NAME,
              value: enabled ? "true" : "false",
            },
          });
        } else {
          await prismaClient.cardapioSetting.create({
            data: {
              key: NOTIFICATIONS_SETTING_KEY,
              name: NOTIFICATIONS_SETTING_NAME,
              value: enabled ? "true" : "false",
              createdAt: new Date(),
            },
          });
        }

        return redirect("/admin/gerenciamento/cardapio-settings");
      }

      case "create": {
        const key = str(formData.get("key"));
        const name = str(formData.get("name"));
        const value = str(formData.get("value"));

        const fieldError: Record<string, string> = {};
        if (!key) fieldError.key = "Obrigatório";
        if (!name) fieldError.name = "Obrigatório";
        if (Object.keys(fieldError).length) {
          return json({ fieldError }, { status: 400 });
        }

        const exists = await prismaClient.cardapioSetting.findFirst({ where: { key } });
        if (exists) {
          return json({ fieldError: { key: "Já existe uma configuração com esta chave" } }, { status: 400 });
        }

        await prismaClient.cardapioSetting.create({ data: { key, name, value, createdAt: new Date() } });
        return redirect("/admin/gerenciamento/cardapio-settings");
      }

      case "update": {
        const id = str(formData.get("id"));
        const key = str(formData.get("key"));
        const name = str(formData.get("name"));
        const value = str(formData.get("value"));

        const fieldError: Record<string, string> = {};
        if (!isUUID(id)) fieldError.id = "ID inválido";
        if (!key) fieldError.key = "Obrigatório";
        if (!name) fieldError.name = "Obrigatório";
        if (Object.keys(fieldError).length) {
          return json({ fieldError }, { status: 400 });
        }

        const duplicate = await prismaClient.cardapioSetting.findFirst({ where: { key, NOT: { id } } });
        if (duplicate) {
          return json({ fieldError: { key: "Outra configuração já usa esta chave" } }, { status: 400 });
        }

        await prismaClient.cardapioSetting.update({ where: { id }, data: { key, name, value } });
        return json({ ok: true });
      }

      case "delete": {
        const id = str(formData.get("id"));
        if (!isUUID(id)) return json({ fieldError: { id: "ID inválido" } }, { status: 400 });
        await prismaClient.cardapioSetting.delete({ where: { id } });
        return json({ ok: true });
      }

      default:
        return json({ error: "Ação inválida" }, { status: 400 });
    }
  } catch (err: any) {
    console.error(err);
    return json({ error: err?.message ?? "Erro inesperado" }, { status: 500 });
  }
}

// ======== Component ========
export default function CardapioSettingsPage() {
  const { settings, q, notificationsSetting } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const actionData = useActionData<typeof action>();
  const notificationsEnabled = parseBooleanSetting(notificationsSetting?.value, true);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Configurações do Cardápio</h1>
          <p className="text-sm text-muted-foreground">Gerencie chaves de configuração (key → value) usadas pelo cardápio.</p>
        </div>

        <CreateDialog defaultError={actionData as any} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <CardTitle className="text-lg">Notificações</CardTitle>
          <p className="text-sm text-muted-foreground">Ativa ou desativa toda a UI e lógica de notificações do cardápio.</p>
        </CardHeader>
        <CardContent>
          <Form method="post" className="flex items-center justify-between gap-4" onChange={(e) => submit(e.currentTarget)}>
            <input type="hidden" name="_action" value="toggle-notifications" />
            <Label htmlFor="notificationsEnabled" className="font-medium">
              {notificationsEnabled ? "Ativo" : "Desativado"}
            </Label>
            <Switch id="notificationsEnabled" name="notificationsEnabled" defaultChecked={notificationsEnabled} disabled={isSubmitting} />
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <CardTitle className="text-lg">Lista</CardTitle>
          <Form method="get" className="flex items-center gap-2 w-full md:w-auto" onChange={(e) => submit(e.currentTarget)}>
            <Label htmlFor="q" className="sr-only">Buscar</Label>
            <Input id="q" name="q" placeholder="Buscar por key, name, value" defaultValue={q ?? ""} className="w-full md:w-80" />
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
                <TableHead className="w-[280px]">Key</TableHead>
                <TableHead className="w-[280px]">Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-[180px]">Criado</TableHead>
                <TableHead className="w-[160px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((s) => (
                <RowItem key={s.id} s={s} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ======== Subcomponents ========
function CreateDialog({ defaultError }: { defaultError?: any }) {
  const fetcher = useFetcher<typeof action>();
  const isBusy = fetcher.state !== "idle";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="text-sm uppercase tracking-wide">Nova configuração</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Criar configuração</DialogTitle>
          <DialogDescription>Defina uma chave única, um nome descritivo e um valor (texto livre).</DialogDescription>
        </DialogHeader>

        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="create" />
          <div className="grid gap-2">
            <Label htmlFor="key">Key</Label>
            <Input id="key" name="key" required placeholder="ex.: homepage.banner.enabled" />
            {((defaultError as any)?.fieldError?.key || (fetcher.data as any)?.fieldError?.key) && (
              <p className="text-xs text-destructive">{((defaultError as any)?.fieldError?.key || (fetcher.data as any)?.fieldError?.key) as string}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="ex.: Banner da Home habilitado" />
            {((defaultError as any)?.fieldError?.name || (fetcher.data as any)?.fieldError?.name) && (
              <p className="text-xs text-destructive">{((defaultError as any)?.fieldError?.name || (fetcher.data as any)?.fieldError?.name) as string}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="value">Value</Label>
            <Textarea id="value" name="value" placeholder="ex.: true, false, JSON ou texto" />
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

function RowItem({ s }: { s: any }) {
  const fetcher = useFetcher<typeof action>();
  const isBusy = fetcher.state !== "idle";

  return (
    <TableRow className="align-top">
      <TableCell>
        <div className="font-mono text-sm break-words">{s.key}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm break-words">{s.name}</div>
      </TableCell>
      <TableCell>
        <pre className="whitespace-pre-wrap text-sm max-w-[60ch] break-words font-sans">{s.value}</pre>
      </TableCell>
      <TableCell>
        <span>{new Date(s.createdAt).toLocaleString()}</span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <EditDialog s={s} />

          <fetcher.Form method="post">
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={s.id} />
            <Button type="submit" variant="destructive" size="sm" disabled={isBusy}
              onClick={(e) => {
                if (!confirm(`Excluir “${s.name}”?`)) e.preventDefault();
              }}
            >Excluir</Button>
          </fetcher.Form>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditDialog({ s }: { s: any }) {
  const fetcher = useFetcher<typeof action>();
  const isBusy = fetcher.state !== "idle";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Editar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar configuração</DialogTitle>
          <DialogDescription>Atualize os campos abaixo e salve.</DialogDescription>
        </DialogHeader>

        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="update" />
          <input type="hidden" name="id" value={s.id} />

          <div className="grid gap-2">
            <Label htmlFor={`key-${s.id}`}>Key</Label>
            <Input id={`key-${s.id}`} name="key" required defaultValue={s.key} />
            {(fetcher.data as any)?.fieldError?.key && (
              <p className="text-xs text-destructive">{(fetcher.data as any)?.fieldError?.key as string}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`name-${s.id}`}>Name</Label>
            <Input id={`name-${s.id}`} name="name" required defaultValue={s.name} />
            {(fetcher.data as any)?.fieldError?.name && (
              <p className="text-xs text-destructive">{(fetcher.data as any)?.fieldError?.name as string}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`value-${s.id}`}>Value</Label>
            <Textarea id={`value-${s.id}`} name="value" defaultValue={s.value ?? ""} />
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
