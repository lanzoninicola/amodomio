import {
  defer,
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Await, useLoaderData, useRevalidator } from "@remix-run/react";
import { Suspense } from "react";
import { getZapiConnection } from "~/domain/z-api/zapi-client.server";
import { listTrackedMessages } from "~/domain/z-api/message-tracking.server";
import { MESSAGE_STATUS_LABELS } from "~/domain/z-api/message-status";
import { authenticator } from "~/domain/auth/google.server";
import { ZapiReconnectionControls } from "~/components/z-api/reconnection-controls";
import {
  checkZapiReconnection,
  getZapiPairingQrCode,
  tryReconnectZapi,
  type ReconnectionResult,
} from "~/domain/z-api/reconnection.server";
import { enforceRateLimit } from "~/domain/z-api/route-helpers.server";
import { ZApiError } from "~/domain/z-api/zapi-client.server";
import { isAllowedRequestOrigin } from "~/domain/security/origin.server";

function canManageConnection(user: { roles?: string[] }) {
  return Boolean(
    user.roles?.some((role) => role === "admin" || role === "superAdmin")
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const respond = (data: ReconnectionResult, status = 200) =>
    json(
      { ...data, checkedAt: Date.now() },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  if (request.method !== "POST")
    return respond({ state: "error", message: "Método não permitido." }, 405);
  if (!isAllowedRequestOrigin(request))
    return respond({ state: "error", message: "Origem inválida." }, 403);
  const user = await authenticator.isAuthenticated(request);
  if (!user)
    return respond(
      { state: "error", message: "Entre novamente para gerenciar a conexão." },
      401
    );
  if (!canManageConnection(user))
    return respond(
      {
        state: "error",
        message:
          "Somente administradores podem gerenciar a conexão do WhatsApp.",
      },
      403
    );
  const form = await request.formData();
  const intent = form.get("_intent");
  if (!["reconnect", "connection", "qr-code"].includes(String(intent)))
    return respond({ state: "error", message: "Ação inválida." }, 400);
  const limited = enforceRateLimit(
    request,
    intent === "reconnect" ? 1 : 30,
    intent === "reconnect" ? "zapi-reconnect" : "zapi-connection-check"
  );
  if (limited)
    return json<ReconnectionResult>(
      {
        state: "error",
        checkedAt: Date.now(),
        message:
          intent === "reconnect"
            ? "Aguarde antes de tentar novamente. A reinicialização é limitada a uma tentativa por minuto."
            : "Muitas verificações de conexão. Aguarde alguns segundos e tente novamente.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": limited.headers.get("Retry-After") || "60",
        },
      }
    );
  try {
    return respond(
      await (intent === "reconnect"
        ? tryReconnectZapi()
        : intent === "qr-code"
        ? getZapiPairingQrCode()
        : checkZapiReconnection())
    );
  } catch (error) {
    // Only our sanitized messages leave the server; provider payloads can contain credentials.
    const safeMessage =
      error instanceof ZApiError && !error.path.startsWith("/instances/")
        ? error.message
        : "Não foi possível concluir a operação na Z-API. Verifique a conexão ou tente gerar outro QR Code.";
    return respond(
      { state: "error", message: safeMessage },
      error instanceof ZApiError && error.status === 409 ? 409 : 502
    );
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw redirect("/login");
  return defer(
    {
      webhookConfigured: Boolean(process.env.ZAPI_WEBHOOK_SECRET),
      canManageConnection: canManageConnection(user),
      connection: getZapiConnection({ timeoutMs: 5_000 })
        .then((result) => result.connected)
        .catch(() => null),
      messages: listTrackedMessages(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export default function ZapiEnvios() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  return (
    <section className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Envios e conexão do WhatsApp</h2>
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm"
          disabled={revalidator.state !== "idle"}
          onClick={() => revalidator.revalidate()}
        >
          {revalidator.state === "idle" ? "Atualizar" : "Atualizando…"}
        </button>
      </div>
      <Suspense fallback={<p>Verificando conexão…</p>}>
        <Await
          resolve={data.connection}
          errorElement={<p>Não foi possível verificar a conexão.</p>}
        >
          {(connected) => (
            <p
              role="status"
              className={`font-medium ${
                connected === true ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {connected === true
                ? "Instância conectada"
                : connected === false
                ? "Instância desconectada — tente reconectar para liberar os envios."
                : "Conexão não verificada — os envios exigem confirmação da conexão."}
            </p>
          )}
        </Await>
      </Suspense>
      {data.canManageConnection ? <ZapiReconnectionControls /> : null}
      {!data.webhookConfigured ? (
        <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
          O acompanhamento ainda precisa ser configurado no servidor e na Z-API.
          Consulte as instruções de configuração do projeto.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          As confirmações dependem dos webhooks de envio e status cadastrados na
          Z-API.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Últimos 30 envios. Aceitação pela API não confirma envio ou entrega.
        Atualize para consultar as confirmações.
      </p>
      <Suspense fallback={<p>Carregando envios…</p>}>
        <Await
          resolve={data.messages}
          errorElement={
            <p role="alert">Não foi possível carregar os envios.</p>
          }
        >
          {(messages) =>
            messages.length ? (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted">
                      <th className="p-3">Data</th>
                      <th className="p-3">Telefone</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Identificador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message) => (
                      <tr
                        key={message.trackingId}
                        className="border-b align-top"
                      >
                        <td className="whitespace-nowrap p-3">
                          {new Date(message.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">
                          {message.phone || "Status do WhatsApp"}
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              message.status === "failed"
                                ? "font-semibold text-red-700"
                                : "font-medium"
                            }
                          >
                            {MESSAGE_STATUS_LABELS[message.status]}
                          </span>
                          {message.confirmationOverdue ? (
                            <p className="text-amber-700">
                              Sem confirmação há mais de 5 minutos. Não reenvie
                              automaticamente.
                            </p>
                          ) : null}
                          {message.error ? (
                            <p className="text-red-700">{message.error}</p>
                          ) : null}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {message.trackingId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Nenhum envio acompanhado ainda.</p>
            )
          }
        </Await>
      </Suspense>
    </section>
  );
}
