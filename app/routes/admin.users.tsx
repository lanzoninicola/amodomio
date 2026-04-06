import type { AdminUserRole } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createOrUpdateManagedUser,
  getEffectiveRoles,
  getLegacyWhitelistedEmails,
  hasAnyRole,
  normalizeAdminUserRoles,
  normalizeUserEmail,
  normalizeUsername,
} from "~/domain/auth/admin-user-access.server";
import { authenticator } from "~/domain/auth/google.server";
import prismaClient from "~/lib/prisma/client.server";

type ActionData = {
  error?: string;
  success?: string;
};

type ManagedUserRow = {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  mobilePhone: string | null;
  roles: AdminUserRole[];
  isActive: boolean;
  allowGoogleLogin: boolean;
  allowPasswordLogin: boolean;
  source: string;
  lastLoginAt: string | null;
};

type AuditRow = {
  id: string;
  username: string | null;
  email: string | null;
  provider: string;
  eventType: string;
  success: boolean;
  createdAt: string;
};

const ROLES: AdminUserRole[] = ["user", "admin", "superAdmin"];

export const meta: MetaFunction = () => [{ title: "Usuarios e acessos" }];

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function isChecked(value: FormDataEntryValue | null) {
  return value === "on";
}

function extractRoles(formData: FormData): AdminUserRole[] {
  const values = formData
    .getAll("roles")
    .map((value) => String(value).trim())
    .filter((value): value is AdminUserRole => ROLES.includes(value as AdminUserRole));

  return normalizeAdminUserRoles(values);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const currentUser = await authenticator.isAuthenticated(request);

  if (!hasAnyRole(currentUser, ["admin", "superAdmin"])) {
    return redirect("/admin");
  }

  const [users, audit] = await Promise.all([
    prismaClient.adminUserAccess.findMany({
      orderBy: [{ username: "asc" }],
    }),
    prismaClient.adminAccessAudit.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const managedEmails = new Set(
    users.map((user) => normalizeUserEmail(user.email)).filter(Boolean)
  );
  const legacyWhitelistOnly = getLegacyWhitelistedEmails().filter(
    (email) => !managedEmails.has(email)
  );

  return json({
    currentUser,
    users,
    audit,
    legacyWhitelistOnly,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const currentUser = await authenticator.isAuthenticated(request);

  if (!hasAnyRole(currentUser, ["admin", "superAdmin"])) {
    return json<ActionData>({ error: "Sem permissao para gerenciar usuarios." }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = str(formData.get("_intent"));

  try {
    if (intent === "create" || intent === "update") {
      const id = str(formData.get("id")) || null;
      const user = await createOrUpdateManagedUser({
        id,
        username: str(formData.get("username")),
        email: str(formData.get("email")) || null,
        name: str(formData.get("name")) || null,
        mobilePhone: str(formData.get("mobilePhone")) || null,
        roles: extractRoles(formData),
        isActive: isChecked(formData.get("isActive")),
        allowGoogleLogin: isChecked(formData.get("allowGoogleLogin")),
        allowPasswordLogin: isChecked(formData.get("allowPasswordLogin")),
        password: str(formData.get("password")) || null,
      });

      return json<ActionData>({
        success: id
          ? `Usuario ${user.username} atualizado.`
          : `Usuario ${user.username} criado.`,
      });
    }

    if (intent === "delete") {
      const id = str(formData.get("id"));
      if (!id) {
        return json<ActionData>({ error: "Usuario invalido." }, { status: 400 });
      }

      const user = await prismaClient.adminUserAccess.findUnique({ where: { id } });
      if (!user) {
        return json<ActionData>({ error: "Usuario nao encontrado." }, { status: 404 });
      }

      if (normalizeUsername(user.username) === normalizeUsername(currentUser.username)) {
        return json<ActionData>(
          { error: "Nao e permitido remover o proprio usuario logado." },
          { status: 400 }
        );
      }

      await prismaClient.adminUserAccess.delete({ where: { id } });
      return json<ActionData>({ success: `Usuario ${user.username} removido.` });
    }

    return json<ActionData>({ error: "Acao invalida." }, { status: 400 });
  } catch (error) {
    console.error("[admin.users.action]", error);
    return json<ActionData>(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar as alteracoes de usuarios.",
      },
      { status: 500 }
    );
  }
}

export default function AdminUsersRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const users = data.users as unknown as ManagedUserRow[];
  const audit = data.audit as AuditRow[];
  const legacyWhitelistOnly = data.legacyWhitelistOnly as string[];

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Usuarios e acesso ao sistema</CardTitle>
          <CardDescription>
            Cada usuario pode ter login por Google, por username/password ou pelos dois.
            O fallback em <code>GOOGLE_AUTH_EMAIL_WHITELIST</code> permanece ativo quando nao existe usuario interno para o e-mail.
            O role <code>superAdmin</code> herda <code>admin</code> e <code>user</code>. O role <code>admin</code> herda <code>user</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">Logado: {data.currentUser.username}</Badge>
            <Badge variant="outline">Roles efetivos: {getEffectiveRoles(data.currentUser).join(", ")}</Badge>
            <Badge variant="outline">Provider: {data.currentUser.authProvider}</Badge>
          </div>

          {actionData?.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionData.error}
            </div>
          ) : null}

          {actionData?.success ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {actionData.success}
            </div>
          ) : null}

          <Form method="post" className="grid gap-4 rounded-lg border p-4 lg:grid-cols-4">
            <input type="hidden" name="_intent" value="create" />

            <Field label="Username">
              <Input name="username" placeholder="gustavo.b" required />
            </Field>
            <Field label="Nome">
              <Input name="name" placeholder="Nome exibido" />
            </Field>
            <Field label="E-mail Google">
              <Input name="email" type="email" placeholder="nome@empresa.com" />
            </Field>
            <Field label="Celular WhatsApp">
              <Input name="mobilePhone" placeholder="5546999999999" />
            </Field>
            <Field label="Roles">
              <RolesField selected={["user"]} />
            </Field>
            <Field label="Password inicial">
              <Input name="password" type="password" placeholder="Opcional" />
            </Field>
            <div className="grid gap-3 lg:col-span-2 lg:grid-cols-3 lg:items-end">
              <ToggleField label="Ativo" name="isActive" defaultChecked />
              <ToggleField label="Google" name="allowGoogleLogin" />
              <ToggleField label="Username/password" name="allowPasswordLogin" />
            </div>
            <div className="lg:col-span-4">
              <Button type="submit">Criar usuario</Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios gerenciados</CardTitle>
          <CardDescription>
            Se voce informar uma nova password ao salvar, ela substitui a anterior. O reset por WhatsApp usa uma senha temporaria que expira em 30 minutos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {users.map((user) => (
            <div key={user.id} className="rounded-lg border p-4">
              <Form method="post" className="grid gap-4 lg:grid-cols-4">
                <input type="hidden" name="_intent" value="update" />
                <input type="hidden" name="id" value={user.id} />

                <Field label="Username">
                  <Input name="username" defaultValue={user.username} required />
                </Field>
                <Field label="Nome">
                  <Input name="name" defaultValue={user.name || ""} />
                </Field>
                <Field label="E-mail Google">
                  <Input name="email" type="email" defaultValue={user.email || ""} />
                </Field>
                <Field label="Celular WhatsApp">
                  <Input name="mobilePhone" defaultValue={user.mobilePhone || ""} />
                </Field>
                <Field label="Roles">
                  <RolesField selected={user.roles} />
                </Field>
                <Field label="Nova password">
                  <Input name="password" type="password" placeholder="Deixe em branco para manter" />
                </Field>
                <Field label="Origem">
                  <div className="flex h-10 items-center">
                    <Badge variant={user.source === "whitelistMigration" ? "secondary" : "outline"}>
                      {user.source}
                    </Badge>
                  </div>
                </Field>
                <Field label="Roles efetivos">
                  <div className="flex h-10 items-center text-sm text-muted-foreground">
                    {getEffectiveRoles(user).join(", ")}
                  </div>
                </Field>
                <Field label="Ultimo login">
                  <div className="flex h-10 items-center text-sm text-muted-foreground">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                  </div>
                </Field>

                <div className="grid gap-3 lg:col-span-3 lg:grid-cols-3 lg:items-end">
                  <ToggleField label="Ativo" name="isActive" defaultChecked={user.isActive} />
                  <ToggleField label="Google" name="allowGoogleLogin" defaultChecked={user.allowGoogleLogin} />
                  <ToggleField label="Username/password" name="allowPasswordLogin" defaultChecked={user.allowPasswordLogin} />
                </div>

                <div className="flex items-end justify-end gap-2 lg:col-span-1">
                  <Button type="submit" variant="outline">
                    Salvar
                  </Button>
                </div>
              </Form>

              <Separator className="my-4" />

              <Form method="post" className="flex justify-end">
                <input type="hidden" name="_intent" value="delete" />
                <input type="hidden" name="id" value={user.id} />
                <Button type="submit" variant="destructive">
                  Remover
                </Button>
              </Form>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria de acesso</CardTitle>
          <CardDescription>
            Eventos recentes de login, logout e recuperacao de password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Sucesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.createdAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{row.eventType}</TableCell>
                  <TableCell>{row.provider}</TableCell>
                  <TableCell>{row.username || row.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={row.success ? "default" : "destructive"}>
                      {row.success ? "sim" : "nao"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Whitelist legada nao migrada</CardTitle>
          <CardDescription>
            E-mails ainda liberados apenas pelo fallback do Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {legacyWhitelistOnly.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum e-mail pendente.</div>
          ) : (
            legacyWhitelistOnly.map((email) => (
              <div key={email} className="rounded-md border px-3 py-2 text-sm">
                {email}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      {props.children}
    </div>
  );
}

function ToggleField(props: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex h-10 items-center gap-3 rounded-md border px-3 text-sm">
      <input name={props.name} type="checkbox" defaultChecked={props.defaultChecked} className="h-4 w-4" />
      <span>{props.label}</span>
    </label>
  );
}

function RolesField(props: { selected: AdminUserRole[] }) {
  return (
    <div className="grid gap-2 rounded-md border p-3">
      {ROLES.map((role) => (
        <label key={role} className="flex items-center gap-3 text-sm">
          <input
            name="roles"
            type="checkbox"
            value={role}
            defaultChecked={props.selected.includes(role)}
            className="h-4 w-4"
          />
          <span>{role}</span>
        </label>
      ))}
    </div>
  );
}
