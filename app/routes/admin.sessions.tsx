import type { AdminUserSessionStatus, AccessAuditEventType, AccessAuditProvider } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { blockAdminSessionById, getCurrentSessionId, listAdminSessions, revokeAdminSessionById, revokeAllAdminSessionsForUser, revokeCurrentAdminSession } from "~/domain/auth/admin-user-session.server";
import { hasAnyRole } from "~/domain/auth/admin-user-access.server";
import { authenticator } from "~/domain/auth/google.server";
import prismaClient from "~/lib/prisma/client.server";

type ActionData = {
  error?: string;
  success?: string;
};

type SessionRow = {
  id: string;
  userId: string;
  authProvider: AccessAuditProvider;
  status: AdminUserSessionStatus;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  User: {
    username: string;
    email: string | null;
    name: string | null;
  };
};

type AuditRow = {
  id: string;
  eventType: AccessAuditEventType;
  provider: AccessAuditProvider;
  success: boolean;
  sessionId: string | null;
  sessionDeviceLabel: string | null;
  username: string | null;
  createdAt: string;
};

export const meta: MetaFunction = () => [{ title: "Sessoes ativas" }];

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const currentUser = await authenticator.isAuthenticated(request);

  if (!hasAnyRole(currentUser, ["admin", "superAdmin"])) {
    return redirect("/admin");
  }

  const [sessions, audit] = await Promise.all([
    listAdminSessions(),
    prismaClient.adminAccessAudit.findMany({
      where: {
        eventType: {
          in: ["loginSuccess", "logout", "logoutAllDevices", "sessionExpired", "sessionRevoked", "sessionBlocked"],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
  ]);

  return json({
    currentUser,
    sessions,
    audit,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const currentUser = await authenticator.isAuthenticated(request);

  if (!hasAnyRole(currentUser, ["admin", "superAdmin"])) {
    return json<ActionData>({ error: "Sem permissao para gerenciar sessoes." }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = str(formData.get("_intent"));
  const sessionId = str(formData.get("sessionId"));
  const userId = str(formData.get("userId"));

  if (intent === "revoke-session") {
    if (!sessionId) {
      return json<ActionData>({ error: "Sessao invalida." }, { status: 400 });
    }

    if (sessionId === getCurrentSessionId(currentUser)) {
      const setCookie = await revokeCurrentAdminSession({
        request,
        actorUserId: currentUser.id,
      });

      throw redirect("/login?_status=session-expired", {
        headers: { "Set-Cookie": setCookie },
      });
    }

    await revokeAdminSessionById({
      sessionId,
      actorUserId: currentUser.id,
      request,
    });

    return json<ActionData>({ success: "Sessao encerrada." });
  }

  if (intent === "block-session") {
    if (!sessionId) {
      return json<ActionData>({ error: "Sessao invalida." }, { status: 400 });
    }

    if (sessionId === getCurrentSessionId(currentUser)) {
      const setCookie = await revokeCurrentAdminSession({
        request,
        actorUserId: currentUser.id,
      });

      throw redirect("/login?_status=session-expired", {
        headers: { "Set-Cookie": setCookie },
      });
    }

    await blockAdminSessionById({
      sessionId,
      actorUserId: currentUser.id,
      request,
    });

    return json<ActionData>({ success: "Sessao bloqueada." });
  }

  if (intent === "logout-user-devices") {
    if (!userId) {
      return json<ActionData>({ error: "Usuario invalido." }, { status: 400 });
    }

    const includeCurrent = str(formData.get("includeCurrent")) === "1";
    const currentSessionId = getCurrentSessionId(currentUser);

    await revokeAllAdminSessionsForUser({
      userId,
      actorUserId: currentUser.id,
      request,
      exceptSessionId: includeCurrent || userId !== currentUser.id ? null : currentSessionId,
    });

    if (includeCurrent && userId === currentUser.id) {
      const setCookie = await revokeCurrentAdminSession({
        request,
        actorUserId: currentUser.id,
      });

      throw redirect("/login?_status=session-expired", {
        headers: { "Set-Cookie": setCookie },
      });
    }

    return json<ActionData>({ success: "Sessoes do usuario encerradas." });
  }

  return json<ActionData>({ error: "Acao invalida." }, { status: 400 });
}

export default function AdminSessionsRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const sessions = data.sessions as unknown as SessionRow[];
  const audit = data.audit as AuditRow[];
  const currentSessionId = getCurrentSessionId(data.currentUser);

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Sessoes ativas e recentes</CardTitle>
          <CardDescription>
            Controle sessoes por dispositivo, com expiracao por inatividade, encerramento global e bloqueio manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">Sessao atual: {currentSessionId}</Badge>
            <Badge variant="outline">Dispositivo: {data.currentUser.sessionDeviceLabel || "Desconhecido"}</Badge>
            <Badge variant="outline">
              Ultima atividade: {new Date(data.currentUser.sessionLastActivityAt).toLocaleString("pt-BR")}
            </Badge>
          </div>

          <Form method="post" className="flex flex-wrap gap-2">
            <input type="hidden" name="_intent" value="logout-user-devices" />
            <input type="hidden" name="userId" value={data.currentUser.id} />
            <input type="hidden" name="includeCurrent" value="0" />
            <Button type="submit" variant="outline">
              Encerrar minhas outras sessoes
            </Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de sessoes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ultima atividade</TableHead>
                <TableHead>Expira por inatividade</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{session.User.username}</div>
                    <div className="text-xs text-muted-foreground">{session.User.email || "-"}</div>
                    {session.id === currentSessionId ? (
                      <Badge variant="secondary" className="mt-2">Atual</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[280px] text-sm">{session.deviceLabel || "Dispositivo desconhecido"}</div>
                    <div className="text-xs text-muted-foreground">{session.ipAddress || "-"}</div>
                  </TableCell>
                  <TableCell>{session.authProvider}</TableCell>
                  <TableCell>
                    <Badge variant={session.status === "active" ? "default" : "secondary"}>
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(session.lastActivityAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{new Date(session.idleExpiresAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Form method="post">
                        <input type="hidden" name="_intent" value="revoke-session" />
                        <input type="hidden" name="sessionId" value={session.id} />
                        <Button type="submit" size="sm" variant="outline" disabled={session.status !== "active"}>
                          Encerrar
                        </Button>
                      </Form>
                      <Form method="post">
                        <input type="hidden" name="_intent" value="block-session" />
                        <input type="hidden" name="sessionId" value={session.id} />
                        <Button type="submit" size="sm" variant="destructive" disabled={session.status !== "active"}>
                          Bloquear
                        </Button>
                      </Form>
                      <Form method="post">
                        <input type="hidden" name="_intent" value="logout-user-devices" />
                        <input type="hidden" name="userId" value={session.userId} />
                        <input type="hidden" name="includeCurrent" value={session.userId === data.currentUser.id ? "0" : "1"} />
                        <Button type="submit" size="sm" variant="secondary">
                          Encerrar do usuario
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
          <CardTitle>Auditoria de sessao</CardTitle>
          <CardDescription>
            Eventos recentes vinculados a sessoes e dispositivos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Sucesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.createdAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{row.eventType}</TableCell>
                  <TableCell>{row.username || "-"}</TableCell>
                  <TableCell>{row.sessionDeviceLabel || row.sessionId || "-"}</TableCell>
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
    </div>
  );
}
