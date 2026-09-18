import type { UserAccess, UserProvisionSource, UserRole } from "@prisma/client";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useRouteError,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { useMemo, useState } from "react";
import { ChevronLeft, PlusCircle, Search, Users } from "lucide-react";
import Container from "~/components/layout/container/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authenticator } from "~/domain/auth/google.server";
import {
  createOrUpdateManagedUser,
  getLegacyWhitelistedEmails,
  hasAnyRole,
} from "~/domain/auth/user-access.server";
import {
  getEffectiveRoles,
  normalizeUserRoles,
} from "~/domain/auth/user-access";
import prismaClient from "~/lib/prisma/client.server";

const ROLE_OPTIONS: Array<{
  value: UserRole;
  label: string;
  description: string;
}> = [
  { value: "user", label: "User", description: "Acesso base ao sistema." },
  {
    value: "admin",
    label: "Admin",
    description: "Gestão operacional e administrativa.",
  },
  {
    value: "superAdmin",
    label: "Super Admin",
    description: "Controle total e herança dos demais papéis.",
  },
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

function mapUserRecord(
  user: UserAccess,
  whitelist: Set<string>
): ManagedUserRecord {
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
    inLegacyWhitelist: Boolean(
      user.email && whitelist.has(user.email.toLowerCase())
    ),
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const currentUser = await authenticator.isAuthenticated(request);
  const currentRoles = normalizeUserRoles(
    (currentUser?.roles || []) as UserRole[]
  );

  if (!currentUser) return redirect("/login");
  if (!hasAnyRole({ roles: currentRoles }, ["admin", "superAdmin"])) {
    throw json(
      {
        code: "USERS_ACCESS_DENIED",
        email: currentUser.email || "Não informado",
      },
      { status: 403 }
    );
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
  const currentRoles = normalizeUserRoles(
    (currentUser?.roles || []) as UserRole[]
  );

  if (
    !currentUser ||
    !hasAnyRole({ roles: currentRoles }, ["admin", "superAdmin"])
  ) {
    return json<ActionData>(
      { error: "Sem permissão para gerenciar usuários." },
      { status: 403 }
    );
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

    throw redirect(
      `/admin/users?success=${nextIsActive ? "activated" : "deactivated"}`
    );
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
      .filter((value): value is UserRole =>
        ROLE_OPTIONS.some((role) => role.value === value)
      ),
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

    return redirect(
      `/admin/users?success=${values.id ? "updated" : "created"}&edit=${
        user.id
      }`
    );
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
  const navigation = useNavigation();
  const isSaving =
    navigation.state !== "idle" &&
    navigation.formData?.get("_intent") === "save-user";
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(
    normalizeUserRoles(initialValues.roles)
  );
  const [isActive, setIsActive] = useState(initialValues.isActive);
  const [allowGoogleLogin, setAllowGoogleLogin] = useState(
    initialValues.allowGoogleLogin
  );
  const [allowPasswordLogin, setAllowPasswordLogin] = useState(
    initialValues.allowPasswordLogin
  );

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
    <Form method="post" className="space-y-8">
      <input type="hidden" name="_intent" value="save-user" />
      {initialValues.id ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}
      <input type="hidden" name="isActive" value={isActive ? "1" : "0"} />
      <input
        type="hidden"
        name="allowGoogleLogin"
        value={allowGoogleLogin ? "1" : "0"}
      />
      <input
        type="hidden"
        name="allowPasswordLogin"
        value={allowPasswordLogin ? "1" : "0"}
      />
      {selectedRoles.map((role) => (
        <input key={role} type="hidden" name="roles" value={role} />
      ))}

      <section className="grid gap-5 border-b border-slate-200 pb-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Dados do usuário
          </h3>
          <p className="text-sm text-slate-500">
            Identificação e informações de contato.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              defaultValue={initialValues.username}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initialValues.email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={initialValues.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobilePhone">Celular</Label>
            <Input
              id="mobilePhone"
              name="mobilePhone"
              defaultValue={initialValues.mobilePhone}
              placeholder="5511999999999"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 border-b border-slate-200 pb-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Segurança</h3>
          <p className="text-sm text-slate-500">
            Defina ou atualize a senha de acesso.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            autoComplete="new-password"
            type="password"
            defaultValue=""
            placeholder={
              initialValues.id
                ? "Preencha apenas para trocar a senha"
                : "Opcional no cadastro"
            }
          />
        </div>
      </section>

      <section className="grid gap-5 border-b border-slate-200 pb-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Permissões</h3>
          <p className="text-sm text-slate-500">
            Escolha os perfis de acesso deste usuário.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-3">
            {ROLE_OPTIONS.map((role) => {
              const checked = selectedRoles.includes(role.value);
              const checkboxId = `role-${role.value}`;

              return (
                <div
                  key={role.value}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 p-4"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleRole(role.value, value === true)
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor={checkboxId} className="cursor-pointer">
                      {role.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {!selectedRoles.length ? (
            <p className="text-xs text-muted-foreground">
              Sem seleção, será aplicado o perfil padrão User.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 border-b border-slate-200 pb-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Modalidades de acesso
          </h3>
          <p className="text-sm text-slate-500">
            Controle o status e as formas de entrar no sistema.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Usuário ativo</p>
                <p className="text-xs text-muted-foreground">
                  Usuários inativos não conseguem entrar no sistema.
                </p>
              </div>
              <Switch
                aria-label="Usuário ativo"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Permitir Google</p>
                <p className="text-xs text-muted-foreground">
                  Respeita também a whitelist legada quando houver e-mail
                  compatível.
                </p>
              </div>
              <Switch
                aria-label="Permitir Google"
                checked={allowGoogleLogin}
                onCheckedChange={setAllowGoogleLogin}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Permitir username e senha</p>
                <p className="text-xs text-muted-foreground">
                  Necessário para login local e recuperação por senha
                  temporária.
                </p>
              </div>
              <Switch
                aria-label="Permitir username e senha"
                checked={allowPasswordLogin}
                onCheckedChange={setAllowPasswordLogin}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-slate-900 hover:bg-slate-700"
        >
          {isSaving
            ? "Salvando..."
            : initialValues.id
            ? "Salvar alterações"
            : "Criar usuário"}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin/users">Voltar à lista</Link>
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

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const showEditor = Boolean(
    data.editUser || searchParams.get("new") === "1" || actionData?.values
  );
  const filteredUsers = data.users.filter((user) => {
    const matchesStatus =
      status === "all" ||
      (status === "active" ? user.isActive : !user.isActive);
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (
      matchesStatus &&
      [user.username, user.name, user.email, user.mobilePhone].some((value) =>
        value?.toLocaleLowerCase("pt-BR").includes(term)
      )
    );
  });
  const activeCount = data.users.filter((user) => user.isActive).length;
  const successMessage = (
    {
      created: "Usuário criado.",
      updated: "Usuário atualizado.",
      activated: "Usuário ativado.",
      deactivated: "Usuário desativado.",
    } as Record<string, string>
  )[success || ""];

  return (
    <Container fullWidth className="px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to={showEditor ? "/admin/users" : "/admin"}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <Link to="/admin/users" className="font-medium text-slate-900">
                usuários
              </Link>
              {showEditor && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-500">
                    {initialValues.id ? "editar" : "novo"}
                  </span>
                </>
              )}
            </div>
            <Link
              to="/admin/users?new=1"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <PlusCircle size={15} />
              Novo usuário
            </Link>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">
              Usuários
            </h1>
            <p className="text-sm text-slate-500">
              Gerencie cadastros, permissões e modalidades de acesso ao sistema.
            </p>
          </div>
        </section>

        {successMessage && (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          >
            {successMessage}
          </div>
        )}
        {actionData?.error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {actionData.error}
          </div>
        )}

        {showEditor ? (
          <div className="space-y-6">
            <section className="space-y-1 border-b border-slate-200/80 pb-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {initialValues.id
                  ? initialValues.name || initialValues.username
                  : "Novo usuário"}
              </h2>
              <p className="break-all text-sm text-slate-500">
                {initialValues.id ||
                  "Preencha os dados e defina as permissões de acesso."}
              </p>
            </section>
            <UserEditor
              key={initialValues.id || "new-user"}
              initialValues={initialValues}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span>{data.users.length} usuários</span>
              <span aria-hidden="true">·</span>
              <span>{activeCount} ativos</span>
              <span aria-hidden="true">·</span>
              <span>
                {data.whitelistEmails.length} e-mails na lista de acesso legado
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                aria-label="Buscar usuários"
                placeholder="Buscar por nome, username, e-mail ou celular..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 border-slate-300 bg-white pl-9"
              />
            </div>
            <div className="overflow-hidden bg-white">
              <div
                className="flex overflow-x-auto border-b border-slate-200"
                aria-label="Filtrar por status"
              >
                {[
                  { value: "all", label: "Todos", count: data.users.length },
                  { value: "active", label: "Ativos", count: activeCount },
                  {
                    value: "inactive",
                    label: "Inativos",
                    count: data.users.length - activeCount,
                  },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    aria-pressed={status === tab.value}
                    onClick={() => setStatus(tab.value)}
                    className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition ${
                      status === tab.value
                        ? "border-slate-950 font-semibold text-slate-950"
                        : "border-transparent font-medium text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              <Table className="min-w-[900px]">
                <TableHeader className="bg-slate-50/90">
                  <TableRow>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                      Usuário
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                      Permissões
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                      Acesso
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                      Origem
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-medium text-slate-500">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!filteredUsers.length && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-slate-500"
                      >
                        <Users className="mx-auto mb-3 h-6 w-6 text-slate-400" />
                        {data.users.length
                          ? "Nenhum usuário encontrado para os filtros selecionados."
                          : "Nenhum usuário cadastrado."}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-slate-100 hover:bg-slate-50/50"
                    >
                      <TableCell className="px-4 py-3">
                        <Link
                          to={`/admin/users?edit=${user.id}`}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {user.username}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {user.name || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.email || "-"}
                        </div>
                        {user.mobilePhone ? (
                          <div className="text-xs text-muted-foreground">
                            {user.mobilePhone}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={`${user.id}-${role}`} variant="outline">
                              {toLabel(role)}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Perfis efetivos
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {user.effectiveRoles.map((role) => (
                            <Badge
                              key={`${user.id}-effective-${role}`}
                              variant="secondary"
                            >
                              {toLabel(role)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.allowGoogleLogin ? (
                            <Badge variant="outline">Google</Badge>
                          ) : null}
                          {user.allowPasswordLogin ? (
                            <Badge variant="outline">Senha</Badge>
                          ) : null}
                          {!user.allowGoogleLogin &&
                          !user.allowPasswordLogin ? (
                            <Badge variant="secondary">Sem login</Badge>
                          ) : null}
                          {user.inLegacyWhitelist ? (
                            <Badge>Whitelist</Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Último login:{" "}
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleString("pt-BR")
                            : "nunca"}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            user.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                          }
                        >
                          {user.isActive ? "ativo" : "inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">{user.source}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/admin/users?edit=${user.id}`}>
                              Editar
                            </Link>
                          </Button>
                          <Form method="post">
                            <input
                              type="hidden"
                              name="_intent"
                              value="toggle-active"
                            />
                            <input type="hidden" name="id" value={user.id} />
                            <input
                              type="hidden"
                              name="nextIsActive"
                              value={user.isActive ? "0" : "1"}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant={user.isActive ? "secondary" : "default"}
                            >
                              {user.isActive ? "Desativar" : "Ativar"}
                            </Button>
                          </Form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                Exibindo {filteredUsers.length} de {data.users.length} usuários
              </div>
            </div>
          </div>
        )}

        <details className="border-t border-slate-200 pt-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-600">
            Lista de acesso legado ({data.whitelistEmails.length})
          </summary>
          <p className="mt-3 text-xs text-slate-500">
            E-mails considerados pela configuração de acesso legado do Google.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.whitelistEmails.map((email) => (
              <Badge
                key={email}
                variant="outline"
                className="break-all border-slate-200 text-slate-600"
              >
                {email}
              </Badge>
            ))}
            {!data.whitelistEmails.length && (
              <span className="text-xs text-slate-500">
                Nenhum e-mail configurado.
              </span>
            )}
          </div>
        </details>
      </div>
    </Container>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const denied = isRouteErrorResponse(error) && error.status === 403;
  const email = denied ? String(error.data?.email || "Não informado") : "";
  const details = [
    `Código: ${denied ? "USERS_ACCESS_DENIED" : "USERS_PAGE_ERROR"}`,
    "Página: /admin/users",
    ...(email ? [`Conta: ${email}`] : []),
  ].join("\n");
  const [copyStatus, setCopyStatus] = useState("");

  return (
    <Card className="mx-auto my-8 max-w-xl">
      <CardHeader>
        <CardTitle>
          {denied ? "Acesso não autorizado" : "Não foi possível abrir Usuários"}
        </CardTitle>
        <CardDescription>
          {denied
            ? "Sua sessão não possui permissão para gerenciar usuários."
            : "Ocorreu uma falha ao carregar esta página. Tente novamente e, se persistir, procure o responsável pelo sistema."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {denied && (
          <>
            <p className="text-sm">
              Conta conectada: <strong>{email}</strong>
            </p>
            <p className="text-sm">
              Se seu acesso já foi liberado, use{" "}
              <strong>Atualizar sessão</strong> no menu do seu avatar e tente
              novamente.
            </p>
            <p className="text-sm">
              Se continuar sem acesso, envie os dados abaixo ao responsável pelo
              sistema e peça para conferir o vínculo do seu e-mail com o
              cadastro e suas permissões.
            </p>
          </>
        )}
        <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
          {details}
        </pre>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(details);
                setCopyStatus("Dados copiados para enviar ao suporte.");
              } catch {
                setCopyStatus(
                  "Não foi possível copiar automaticamente. Selecione e copie os dados acima."
                );
              }
            }}
          >
            Copiar dados para suporte
          </Button>
          <Button asChild>
            <Link to="/admin/users" reloadDocument>
              Tentar novamente
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/admin">Voltar ao painel</Link>
          </Button>
          {denied && (
            <Button asChild variant="ghost">
              <Link to="/logout">Trocar de conta</Link>
            </Button>
          )}
        </div>
        <p role="status" className="text-sm">
          {copyStatus}
        </p>
      </CardContent>
    </Card>
  );
}
