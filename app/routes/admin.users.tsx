import type { UserAccess, UserProvisionSource, UserRole } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authenticator } from "~/domain/auth/google.server";
import {
  createOrUpdateManagedUser,
  getEffectiveRoles,
  getLegacyWhitelistedEmails,
  hasAnyRole,
  normalizeUserRoles,
} from "~/domain/auth/user-access.server";
import prismaClient from "~/lib/prisma/client.server";

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string }> = [
  { value: "user", label: "User", description: "Acesso base ao sistema." },
  { value: "admin", label: "Admin", description: "Gestão operacional e administrativa." },
  { value: "superAdmin", label: "Super Admin", description: "Controle total e herança dos demais papéis." },
];

type ManagedUserRecord = {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  mobilePhone: string | null;
  roles: UserRole[];
  effectiveRoles: UserRole[];
  isActive: boolean;
  allowGoogleLogin: boolean;
  allowPasswordLogin: boolean;
  source: UserProvisionSource;
  lastLoginAt: string | null;
  inLegacyWhitelist: boolean;
};

type UserFormValues = {
  id?: string | null;
  username: string;
  email: string;
  name: string;
  mobilePhone: string;
  roles: UserRole[];
  isActive: boolean;
  allowGoogleLogin: boolean;
  allowPasswordLogin: boolean;
  password: string;
};

type ActionData = {
  error?: string;
  values?: UserFormValues;
};

export const meta: MetaFunction = () => [{ title: "Usuários e roles" }];

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function boolString(value: FormDataEntryValue | null) {
  return String(value || "") === "1";
}

function toLabel(role: UserRole) {
  if (role === "superAdmin") return "super-admin";
  return role;
}

function buildFormValues(
  source?: Partial<UserFormValues> | null
): UserFormValues {
  return {
    id: source?.id || null,
    username: source?.username || "",
    email: source?.email || "",
    name: source?.name || "",
    mobilePhone: source?.mobilePhone || "",
    roles: normalizeUserRoles(source?.roles || ["user"]),
    isActive: source?.isActive ?? true,
    allowGoogleLogin: source?.allowGoogleLogin ?? false,
    allowPasswordLogin: source?.allowPasswordLogin ?? false,
    password: source?.password || "",
  };
}

function mapUserRecord(user: UserAccess, whitelist: Set<string>): ManagedUserRecord {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    mobilePhone: user.mobilePhone,
    roles: normalizeUserRoles(user.roles),
    effectiveRoles: getEffectiveRoles(user),
    isActive: user.isActive,
    allowGoogleLogin: user.allowGoogleLogin,
    allowPasswordLogin: user.allowPasswordLogin,
    source: user.source,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    inLegacyWhitelist: Boolean(user.email && whitelist.has(user.email.toLowerCase())),
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const currentUser = await authenticator.isAuthenticated(request);
  const currentRoles = normalizeUserRoles((currentUser?.roles || []) as UserRole[]);

  if (!currentUser || !hasAnyRole({ roles: currentRoles }, ["admin", "superAdmin"])) {
    return redirect("/admin");
  }

  const editId = new URL(request.url).searchParams.get("edit");
  const whitelist = new Set(getLegacyWhitelistedEmails());
  const users = await prismaClient.userAccess.findMany({
    orderBy: [{ isActive: "desc" }, { username: "asc" }],
  });

  const mappedUsers = users.map((user) => mapUserRecord(user, whitelist));
  const editUser = mappedUsers.find((user) => user.id === editId) || null;

  return json({
    currentUser,
    users: mappedUsers,
    editUser,
    whitelistEmails: Array.from(whitelist).sort(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const currentUser = await authenticator.isAuthenticated(request);
  const currentRoles = normalizeUserRoles((currentUser?.roles || []) as UserRole[]);

  if (!currentUser || !hasAnyRole({ roles: currentRoles }, ["admin", "superAdmin"])) {
    return json<ActionData>({ error: "Sem permissão para gerenciar usuários." }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = str(formData.get("_intent"));

  if (intent === "toggle-active") {
    const id = str(formData.get("id"));
    const nextIsActive = boolString(formData.get("nextIsActive"));

    if (!id) {
      return json<ActionData>({ error: "Usuário inválido." }, { status: 400 });
    }

    await prismaClient.userAccess.update({
      where: { id },
      data: { isActive: nextIsActive },
    });

    throw redirect(`/admin/users?success=${nextIsActive ? "activated" : "deactivated"}`);
  }

  if (intent !== "save-user") {
    return json<ActionData>({ error: "Ação inválida." }, { status: 400 });
  }

  const values = buildFormValues({
    id: str(formData.get("id")) || null,
    username: str(formData.get("username")),
    email: str(formData.get("email")),
    name: str(formData.get("name")),
    mobilePhone: str(formData.get("mobilePhone")),
    roles: formData
      .getAll("roles")
      .map((value) => String(value))
      .filter((value): value is UserRole => ROLE_OPTIONS.some((role) => role.value === value)),
    isActive: boolString(formData.get("isActive")),
    allowGoogleLogin: boolString(formData.get("allowGoogleLogin")),
    allowPasswordLogin: boolString(formData.get("allowPasswordLogin")),
    password: str(formData.get("password")),
  });

  try {
    const user = await createOrUpdateManagedUser({
      id: values.id || null,
      username: values.username,
      email: values.email || null,
      name: values.name || null,
      mobilePhone: values.mobilePhone || null,
      roles: values.roles,
      isActive: values.isActive,
      allowGoogleLogin: values.allowGoogleLogin,
      allowPasswordLogin: values.allowPasswordLogin,
      password: values.password || null,
    });

    return redirect(`/admin/users?success=${values.id ? "updated" : "created"}&edit=${user.id}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível salvar o usuário.";

    return json<ActionData>(
      {
        error: message,
        values,
      },
      { status: 400 }
    );
  }
}

function UserEditor({ initialValues }: { initialValues: UserFormValues }) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(
    normalizeUserRoles(initialValues.roles)
  );
  const [isActive, setIsActive] = useState(initialValues.isActive);
  const [allowGoogleLogin, setAllowGoogleLogin] = useState(initialValues.allowGoogleLogin);
  const [allowPasswordLogin, setAllowPasswordLogin] = useState(initialValues.allowPasswordLogin);

  function toggleRole(role: UserRole, checked: boolean) {
    setSelectedRoles((current) => {
      if (checked) {
        return normalizeUserRoles([...current, role]);
      }

      const next = current.filter((item) => item !== role);
      return next.length ? next : [];
    });
  }

  return (
    <Form method="post" className="space-y-5">
      <input type="hidden" name="_intent" value="save-user" />
      {initialValues.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="isActive" value={isActive ? "1" : "0"} />
      <input type="hidden" name="allowGoogleLogin" value={allowGoogleLogin ? "1" : "0"} />
      <input type="hidden" name="allowPasswordLogin" value={allowPasswordLogin ? "1" : "0"} />
      {selectedRoles.map((role) => (
        <input key={role} type="hidden" name="roles" value={role} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" name="username" defaultValue={initialValues.username} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={initialValues.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" defaultValue={initialValues.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobilePhone">Celular</Label>
          <Input id="mobilePhone" name="mobilePhone" defaultValue={initialValues.mobilePhone} placeholder="5511999999999" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          defaultValue=""
          placeholder={initialValues.id ? "Preencha apenas para trocar a senha" : "Opcional no cadastro"}
        />
      </div>

      <div className="space-y-3">
        <Label>Roles</Label>
        <div className="space-y-3">
          {ROLE_OPTIONS.map((role) => {
            const checked = selectedRoles.includes(role.value);
            const checkboxId = `role-${role.value}`;

            return (
              <div key={role.value} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  onCheckedChange={(value) => toggleRole(role.value, value === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor={checkboxId} className="cursor-pointer">
                    {role.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        {!selectedRoles.length ? (
          <p className="text-xs text-muted-foreground">
            Sem seleção explícita, o backend aplica o role padrão <code>user</code>.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <Label>Modalidades de acesso</Label>
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Usuário ativo</p>
              <p className="text-xs text-muted-foreground">Usuários inativos não conseguem entrar no sistema.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Permitir Google</p>
              <p className="text-xs text-muted-foreground">Respeita também a whitelist legada quando houver e-mail compatível.</p>
            </div>
            <Switch checked={allowGoogleLogin} onCheckedChange={setAllowGoogleLogin} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Permitir username e senha</p>
              <p className="text-xs text-muted-foreground">Necessário para login local e recuperação por senha temporária.</p>
            </div>
            <Switch checked={allowPasswordLogin} onCheckedChange={setAllowPasswordLogin} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">{initialValues.id ? "Salvar alterações" : "Criar usuário"}</Button>
        <Button variant="outline" asChild>
          <Link to="/admin/users">Novo usuário</Link>
        </Button>
      </div>
    </Form>
  );
}

export default function AdminUsersRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success");

  const initialValues = useMemo(() => {
    if (actionData?.values) {
      return buildFormValues(actionData.values);
    }

    if (data.editUser) {
      return buildFormValues({
        id: data.editUser.id,
        username: data.editUser.username,
        email: data.editUser.email || "",
        name: data.editUser.name || "",
        mobilePhone: data.editUser.mobilePhone || "",
        roles: data.editUser.roles,
        isActive: data.editUser.isActive,
        allowGoogleLogin: data.editUser.allowGoogleLogin,
        allowPasswordLogin: data.editUser.allowPasswordLogin,
      });
    }

    return buildFormValues();
  }, [actionData?.values, data.editUser]);

  return (
    <div className="space-y-6 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de usuários</CardDescription>
            <CardTitle>{data.users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usuários ativos</CardDescription>
            <CardTitle>{data.users.filter((user) => user.isActive).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>E-mails na whitelist legada</CardDescription>
            <CardTitle>{data.whitelistEmails.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Usuários do sistema</CardTitle>
            <CardDescription>
              Vínculo de usuário, roles e modalidades de acesso. Os roles efetivos consideram a herança entre <code>user</code>, <code>admin</code> e <code>super-admin</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {success ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success === "created" && "Usuário criado."}
                {success === "updated" && "Usuário atualizado."}
                {success === "activated" && "Usuário ativado."}
                {success === "deactivated" && "Usuário desativado."}
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-xs text-muted-foreground">{user.name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{user.email || "-"}</div>
                      {user.mobilePhone ? (
                        <div className="text-xs text-muted-foreground">{user.mobilePhone}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={`${user.id}-${role}`} variant="outline">
                            {toLabel(role)}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {user.effectiveRoles.map((role) => (
                          <Badge key={`${user.id}-effective-${role}`} variant="secondary">
                            {toLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.allowGoogleLogin ? <Badge variant="outline">Google</Badge> : null}
                        {user.allowPasswordLogin ? <Badge variant="outline">Senha</Badge> : null}
                        {!user.allowGoogleLogin && !user.allowPasswordLogin ? (
                          <Badge variant="secondary">Sem login</Badge>
                        ) : null}
                        {user.inLegacyWhitelist ? <Badge>Whitelist</Badge> : null}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Último login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "nunca"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "ativo" : "inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.source}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/admin/users?edit=${user.id}`}>Editar</Link>
                        </Button>
                        <Form method="post">
                          <input type="hidden" name="_intent" value="toggle-active" />
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="nextIsActive" value={user.isActive ? "0" : "1"} />
                          <Button type="submit" size="sm" variant={user.isActive ? "secondary" : "default"}>
                            {user.isActive ? "Desativar" : "Ativar"}
                          </Button>
                        </Form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{data.editUser ? "Editar usuário" : "Novo usuário"}</CardTitle>
            <CardDescription>
              O vínculo com Google continua baseado no e-mail e respeita o fallback de <code>GOOGLE_AUTH_EMAIL_WHITELIST</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {actionData?.error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {actionData.error}
              </div>
            ) : null}

            <UserEditor key={initialValues.id || "new-user"} initialValues={initialValues} />

            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Whitelist legada atual</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {data.whitelistEmails.map((email) => (
                  <Badge key={email} variant="outline">
                    {email}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
