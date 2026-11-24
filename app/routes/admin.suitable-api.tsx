import {
  defer,
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Await, useFetcher, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import { authenticator } from "~/domain/auth/google.server";
import prisma from "~/lib/prisma/client.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  checkSuitableHealth,
  createSuitableWebhook,
  listSuitableWebhooks,
  rotateSuitableWebhookSecret,
  setSuitableWebhookActive,
  testSuitableWebhook,
  type SuitableHealth,
  type SuitableWebhook,
} from "~/domain/suitable/suitable-client.server";
import {
  reconcileSuitableOrders,
  syncInboxOrder,
} from "~/domain/suitable/suitable-inbox.server";

export const meta = () => [{ title: "Suitable API | A Modo Mio" }];

async function activity() {
  const [byStatus, lastEvent, errors] = await Promise.all([
    prisma.suitableOrderInbox.groupBy({ by: ["status"], _count: true }),
    prisma.suitableWebhookEvent.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.suitableOrderInbox.findMany({
      where: { fetchError: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { suitableOrderId: true, fetchError: true, updatedAt: true },
    }),
  ]);
  return {
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    lastEvent: lastEvent && {
      type: lastEvent.type,
      at: lastEvent.createdAt.toISOString(),
    },
    errors: errors.map((e) => ({ ...e, updatedAt: e.updatedAt.toISOString() })),
  };
}

type WebhooksResult =
  | { ok: true; webhooks: SuitableWebhook[] }
  | { ok: false; error: string };

async function webhooks(): Promise<WebhooksResult> {
  try {
    return { ok: true, webhooks: await listSuitableWebhooks() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request))) throw redirect("/login");
  const webhookUrl = `${new URL(request.url).origin}/webhooks/suitable`;
  return defer({ webhookUrl, activity: activity(), webhooks: webhooks() });
}

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  secret?: string;
  health?: SuitableHealth;
};

export async function action({ request }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return json<ActionResult>({ ok: false, error: "Não autenticado" }, { status: 401 });
  const form = await request.formData();
  const intent = String(form.get("_action") ?? "");
  const id = String(form.get("id") ?? "");
  try {
    switch (intent) {
      case "health":
        return json<ActionResult>({ ok: true, health: await checkSuitableHealth() });
      case "createWebhook": {
        const created = await createSuitableWebhook(
          String(form.get("name") ?? "").trim(),
          String(form.get("url") ?? "").trim()
        );
        return json<ActionResult>({
          ok: true,
          message: `Webhook "${created.name}" criado.`,
          secret: created.secret,
        });
      }
      case "rotateSecret": {
        const r = await rotateSuitableWebhookSecret(id);
        return json<ActionResult>({
          ok: true,
          message: "Segredo trocado. Atualize SUITABLE_WEBHOOK_SECRET agora.",
          secret: r.secret,
        });
      }
      case "toggleWebhook": {
        const active = form.get("active") === "true";
        await setSuitableWebhookActive(id, active);
        return json<ActionResult>({
          ok: true,
          message: active ? "Webhook ativado." : "Webhook pausado.",
        });
      }
      case "testWebhook": {
        const r = await testSuitableWebhook(id);
        return json<ActionResult>({
          ok: true,
          message: `Evento de teste enviado (${r.event_id}). Confira "Último evento" abaixo.`,
        });
      }
      case "reconcile": {
        const r = await reconcileSuitableOrders(24);
        return json<ActionResult>({
          ok: true,
          message: `Pedidos nas últimas 24h: ${r.checked}. Faltando: ${r.missing}. Recuperados: ${r.recovered}.`,
        });
      }
      case "retryOrder": {
        const orderId = Number(form.get("orderId"));
        if (!Number.isInteger(orderId))
          return json<ActionResult>({ ok: false, error: "Pedido inválido" }, { status: 400 });
        const r = await syncInboxOrder(orderId, null, "retry");
        return json<ActionResult>(
          r.ok ? { ok: true, message: `Pedido #${orderId} buscado.` } : { ok: false, error: r.error }
        );
      }
    }
  } catch (e) {
    return json<ActionResult>(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
  return json<ActionResult>({ ok: false, error: "Ação inválida" }, { status: 400 });
}

const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span
    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
      ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
    }`}
  >
    {label}
  </span>
);

function Feedback({ data }: { data?: ActionResult }) {
  if (!data) return null;
  return (
    <div className="grid gap-1 text-sm" role="status">
      {data.message && <p className="text-green-700">{data.message}</p>}
      {data.error && <p className="text-red-700">{data.error}</p>}
      {data.secret && (
        <p className="rounded bg-amber-50 border border-amber-300 p-2">
          Segredo (aparece só agora, copie e salve em{" "}
          <code>SUITABLE_WEBHOOK_SECRET</code>): <code className="break-all">{data.secret}</code>
        </p>
      )}
    </div>
  );
}

function HealthCard() {
  const fx = useFetcher<ActionResult>();
  const h = fx.data?.health;
  return (
    <section className="rounded border p-4 grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Configuração e healthcheck</h2>
        <fx.Form method="post">
          <Button type="submit" name="_action" value="health" disabled={fx.state !== "idle"}>
            {fx.state !== "idle" ? "Verificando…" : "Verificar agora"}
          </Button>
        </fx.Form>
      </div>
      {!h ? (
        <p className="text-sm text-gray-500">Clique em verificar para testar a API.</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {Object.entries(h.env).map(([k, v]) => (
            <li key={k} className="flex gap-2 items-center">
              <code>{k}</code> <Badge ok={v} label={v ? "definida" : "ausente"} />
            </li>
          ))}
          <li className="flex gap-2 items-center flex-wrap">
            GET /health <Badge ok={h.api.ok} label={h.api.ok ? "ok" : "falhou"} />
            <span>{h.api.ms} ms</span>
            {h.api.error && <span className="text-red-600">{h.api.error}</span>}
          </li>
          <li className="flex gap-2 items-center flex-wrap">
            Token (client_credentials){" "}
            <Badge ok={h.auth.ok} label={h.auth.ok ? "ok" : "falhou"} />
            <span>{h.auth.ms} ms</span>
            {h.auth.error && <span className="text-red-600">{h.auth.error}</span>}
          </li>
        </ul>
      )}
    </section>
  );
}

function WebhooksCard({ webhookUrl, result }: { webhookUrl: string; result: WebhooksResult }) {
  const fx = useFetcher<ActionResult>();
  const busy = fx.state !== "idle";
  return (
    <section className="rounded border p-4 grid gap-3 text-sm">
      <h2 className="font-semibold">Webhooks na Suitable</h2>
      <Feedback data={fx.data} />
      {!result.ok ? (
        <p className="text-red-700" role="alert">
          Não foi possível listar: {result.error}. A chave precisa do escopo{" "}
          <code>webhook:manage</code>.
        </p>
      ) : result.webhooks.length === 0 ? (
        <p>Nenhum webhook cadastrado.</p>
      ) : (
        <ul className="grid gap-2">
          {result.webhooks.map((w) => (
            <li key={w.id} className="rounded border p-2 grid gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <b>{w.name}</b>
                <Badge ok={w.active} label={w.active ? "ativo" : "pausado"} />
                {w.url === webhookUrl && <Badge ok label="esta instalação" />}
              </div>
              <code className="break-all">{w.url}</code>
              <span>Eventos: {w.events.join(", ")}</span>
              <fx.Form method="post" className="flex gap-2 flex-wrap">
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="active" value={String(!w.active)} />
                <Button size="sm" variant="outline" type="submit" name="_action" value="toggleWebhook" disabled={busy}>
                  {w.active ? "Pausar" : "Ativar"}
                </Button>
                <Button size="sm" variant="outline" type="submit" name="_action" value="testWebhook" disabled={busy}>
                  Enviar teste
                </Button>
                <Button size="sm" variant="outline" type="submit" name="_action" value="rotateSecret" disabled={busy}>
                  Trocar segredo
                </Button>
              </fx.Form>
            </li>
          ))}
        </ul>
      )}
      <fx.Form method="post" className="flex gap-2 flex-wrap items-end">
        <label className="grid gap-1">
          Nome
          <Input name="name" defaultValue="KDS A Modo Mio" required />
        </label>
        <label className="grid gap-1 flex-1 min-w-64">
          URL (https)
          <Input name="url" defaultValue={webhookUrl} required />
        </label>
        <Button type="submit" name="_action" value="createWebhook" disabled={busy}>
          Cadastrar webhook
        </Button>
      </fx.Form>
      <p className="text-gray-500">
        Eventos cadastrados: new_order, paid_order, changed_order_status. Pausar cancela eventos
        ainda não enviados.
      </p>
    </section>
  );
}

export default function SuitableApiAdmin() {
  const { webhookUrl, activity, webhooks } = useLoaderData<typeof loader>();
  const fx = useFetcher<ActionResult>();
  return (
    <div className="grid gap-4 p-4 max-w-3xl">
      <h1 className="text-xl font-bold">Suitable API</h1>
      <HealthCard />
      <Suspense fallback={<p role="status">Carregando webhooks…</p>}>
        <Await
          resolve={webhooks}
          errorElement={<p role="alert">Não foi possível carregar os webhooks.</p>}
        >
          {(r) => <WebhooksCard webhookUrl={webhookUrl} result={r} />}
        </Await>
      </Suspense>
      <Suspense fallback={<p role="status">Carregando atividade…</p>}>
        <Await
          resolve={activity}
          errorElement={<p role="alert">Não foi possível carregar a atividade.</p>}
        >
          {(a) => (
            <section className="rounded border p-4 text-sm grid gap-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Atividade</h2>
                <fx.Form method="post">
                  <Button size="sm" variant="outline" type="submit" name="_action" value="reconcile" disabled={fx.state !== "idle"}>
                    {fx.state !== "idle" ? "Reconciliando…" : "Reconciliar últimas 24h"}
                  </Button>
                </fx.Form>
              </div>
              <Feedback data={fx.data} />
              <p>
                Último evento:{" "}
                {a.lastEvent
                  ? `${a.lastEvent.type} em ${new Date(a.lastEvent.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                  : "nenhum recebido"}
              </p>
              <p>
                Caixa de entrada:{" "}
                {a.byStatus.length
                  ? a.byStatus.map((s) => `${s.status}: ${s.count}`).join(" · ")
                  : "vazia"}
              </p>
              {a.errors.length > 0 && (
                <div>
                  <h3 className="font-medium text-red-700">Falhas ao buscar pedido</h3>
                  <ul className="grid gap-1">
                    {a.errors.map((e) => (
                      <li key={e.suitableOrderId} className="flex gap-2 items-center flex-wrap">
                        <span>
                          #{e.suitableOrderId}: {e.fetchError}
                        </span>
                        <fx.Form method="post">
                          <input type="hidden" name="orderId" value={e.suitableOrderId} />
                          <Button size="sm" variant="outline" type="submit" name="_action" value="retryOrder" disabled={fx.state !== "idle"}>
                            Tentar de novo
                          </Button>
                        </fx.Form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
