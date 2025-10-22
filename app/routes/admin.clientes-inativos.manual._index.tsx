import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useFetcher } from "@remix-run/react";
import { listInactiveCustomers, sendBulk, sendOne } from "~/domain/campaigns/campaigns.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const bucket = (url.searchParams.get("b") || "90") as any; // 180|90|45|never
  const q = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const { total, data, pageSize } = await listInactiveCustomers({ bucket, q, page, pageSize: 50 });
  return json({ total, data, page, pageSize, bucket, q });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const message = String(form.get("message") || "");

  if (intent === "one") {
    const id = String(form.get("id") || "");
    const r = await sendOne({ customerId: id, messageTemplate: message });
    return json(r, { status: r.ok ? 200 : 500 });
  }

  if (intent === "bulk") {
    const ids = JSON.parse(String(form.get("ids") || "[]"));
    const r = await sendBulk({ ids, messageTemplate: message, ratePerSecond: 3 });
    return json(r);
  }

  return json({ error: "intent inválido" }, { status: 400 });
}

export default function Page() {
  const { data, bucket, q, total } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const sending = fetcher.state !== "idle";

  // estado local simples
  // (você pode trocar por use-optimistic e toasts do shadcn/ui)
  const selected = new Set<string>();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Clientes inativos (manual)</h1>

      <Form method="get" className="flex gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-sm">Bucket</label>
          <select name="b" defaultValue={bucket} className="border rounded px-2 py-1">
            <option value="180">&gt; 180 dias</option>
            <option value="90">&gt; 90 dias</option>
            <option value="45">&gt; 45 dias</option>
            <option value="never">Nunca pediu</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Buscar</label>
          <input name="q" defaultValue={q} placeholder="nome ou telefone" className="border rounded px-2 py-1" />
        </div>
        <button className="px-3 py-2 bg-black text-white rounded">Aplicar</button>
        <div className="text-sm text-gray-600">{total} clientes</div>
      </Form>

      <MessageTemplate />

      {/* Tabela */}
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2"></th>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-left">Telefone</th>
              <th className="p-2 text-left">Último pedido (dias)</th>
              <th className="p-2 text-left">Respondeu (dias)</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <Row key={c.id} c={c} sending={sending} fetcher={fetcher} />
            ))}
            {data.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhum cliente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MessageTemplate() {
  const fetcher = useFetcher();
  const sending = fetcher.state !== "idle";
  // Estado local simples
  // (em produção, use um store/refs para compartilhar com a tabela)
  const defaultTpl =
    "Oi {{nome}}, aqui é a A Modo Mio 🍕 Faz {{dias}} dias que você não pede com a gente. Posso te mandar os sabores de hoje? 🙂";

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Mensagem base</label>
      <textarea name="message" defaultValue={defaultTpl} rows={4} className="w-full border rounded p-2" />
      <div className="text-xs text-gray-500">Placeholders: {"{{nome}}"}, {"{{dias}}"}</div>
      {/* Exemplo de disparo em lote (IDs devem vir de um estado global da tabela; mantido simples aqui) */}
      {/* <button disabled={sending} onClick={...}>Enviar selecionados</button> */}
    </div>
  );
}

function Row({ c, sending, fetcher }: any) {
  return (
    <tr className="border-t">
      <td className="p-2"></td>
      <td className="p-2">{c.name || "—"}</td>
      <td className="p-2">{c.phone}</td>
      <td className="p-2">{c.dias ?? "—"}</td>
      <td className="p-2">{c.respondeuRecentemente ?? "—"}</td>
      <td className="p-2">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="one" />
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="message" value={"Oi {{nome}}, aqui é a A Modo Mio 🍕 Faz {{dias}} dias..."} />
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={sending || c.optout}
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </fetcher.Form>
      </td>
    </tr>
  );
}
