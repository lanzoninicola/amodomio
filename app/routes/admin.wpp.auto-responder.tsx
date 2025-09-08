// app/routes/admin.wpp.auto-responder._index.tsx
import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useSearchParams, useSubmit } from "@remix-run/react";
import { useEffect, useMemo } from "react";
import prismaClient from "~/lib/prisma/client.server";

// ----------------------------
// Loader
// ----------------------------
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get("pageSize") || "20", 10)));

  const where = q
    ? {
      OR: [
        { label: { contains: q, mode: "insensitive" } },
        { trigger: { contains: q, mode: "insensitive" } },
        { response: { contains: q, mode: "insensitive" } },
      ],
    }
    : {};

  const [count, rules, setting] = await Promise.all([
    prismaClient.botAutoResponseRule.count({ where }),
    prismaClient.botAutoResponseRule.findMany({
      where,
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prismaClient.botSetting.findFirst({ where: { id: 1 } }),
  ]);

  return json({
    q,
    page,
    pageSize,
    total: count,
    rules,
    setting,
  });
}

// ----------------------------
// Action (CRUD + Settings)
// ----------------------------
export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  try {
    if (intent === "create") {
      await prismaClient.botAutoResponseRule.create({
        data: {
          label: String(form.get("label") || ""),
          trigger: String(form.get("trigger") || ""),
          isRegex: form.get("isRegex") === "on",
          response: String(form.get("response") || ""),
          priority: Number(form.get("priority") || 100),
          isActive: form.get("isActive") === "on",
          activeFrom: form.get("activeFrom") ? new Date(String(form.get("activeFrom"))) : null,
          activeTo: form.get("activeTo") ? new Date(String(form.get("activeTo"))) : null,
        },
      });
      return redirect("/admin/wpp/auto-responder");
    }

    if (intent === "update") {
      const id = String(form.get("id"));
      await prismaClient.botAutoResponseRule.update({
        where: { id },
        data: {
          label: String(form.get("label") || ""),
          trigger: String(form.get("trigger") || ""),
          isRegex: form.get("isRegex") === "on",
          response: String(form.get("response") || ""),
          priority: Number(form.get("priority") || 100),
          isActive: form.get("isActive") === "on",
          activeFrom: form.get("activeFrom") ? new Date(String(form.get("activeFrom"))) : null,
          activeTo: form.get("activeTo") ? new Date(String(form.get("activeTo"))) : null,
        },
      });
      return redirect("/admin/wpp/auto-responder");
    }

    if (intent === "toggle") {
      const id = String(form.get("id"));
      const current = await prismaClient.botAutoResponseRule.findUnique({ where: { id } });
      await prismaClient.botAutoResponseRule.update({ where: { id }, data: { isActive: !current?.isActive } });
      return redirect("/admin/wpp/auto-responder");
    }

    if (intent === "delete") {
      const id = String(form.get("id"));
      await prismaClient.botAutoResponseRule.delete({ where: { id } });
      return redirect("/admin/wpp/auto-responder");
    }

    if (intent === "settings") {
      await prismaClient.botSetting.upsert({
        where: { id: 1 },
        update: {
          businessStartHour: Number(form.get("businessStartHour") || 18),
          businessEndHour: Number(form.get("businessEndHour") || 22),
          businessDays: String(form.get("businessDays") || "3,4,5,6,0"),
          offHoursMessage: String(form.get("offHoursMessage") || ""),
        },
        create: {
          id: 1,
          businessStartHour: Number(form.get("businessStartHour") || 18),
          businessEndHour: Number(form.get("businessEndHour") || 22),
          businessDays: String(form.get("businessDays") || "3,4,5,6,0"),
          offHoursMessage: String(form.get("offHoursMessage") || "Estamos fora do horário. Voltamos em breve! 🍕"),
        },
      });
      return redirect("/admin/wpp/auto-responder");
    }
  } catch (e) {
    return json({ ok: false, error: String(e) }, { status: 400 });
  }

  return json({ ok: false, error: "intent inválido" }, { status: 400 });
}

// ----------------------------
// Page
// ----------------------------
export default function AdminWppAutoResponderPage() {
  const { q, page, pageSize, total, rules, setting } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";
  const [searchParams] = useSearchParams();
  const submit = useSubmit();

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    if (isSubmitting) console.log("Salvando...");
  }, [isSubmitting]);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">WPP • Auto-responder</h1>
          <p className="text-sm text-muted-foreground">Gerencie regras, horários e mensagens automáticas.</p>
        </div>
        <Form method="get" className="flex gap-2 items-center">
          <input
            type="text"
            name="q"
            defaultValue={q || ""}
            placeholder="Buscar por nome, gatilho ou resposta..."
            className="rounded-xl border p-2 min-w-[260px]"
          />
          <button className="rounded-xl border px-4 py-2">Buscar</button>
        </Form>
      </header>

      {/* SETTINGS */}
      <section className="rounded-2xl border p-4 bg-white/70">
        <h2 className="text-lg font-semibold mb-3">Configurações de Horário</h2>
        <Form method="post" className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input type="hidden" name="intent" value="settings" />
          <label className="flex flex-col gap-1">
            <span className="text-sm">Início (hora)</span>
            <input name="businessStartHour" defaultValue={setting?.businessStartHour ?? 18} className="rounded-md border p-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Fim (hora)</span>
            <input name="businessEndHour" defaultValue={setting?.businessEndHour ?? 22} className="rounded-md border p-2" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm">Dias ativos (0=Dom .. 6=Sáb)</span>
            <input name="businessDays" defaultValue={setting?.businessDays ?? "3,4,5,6,0"} className="rounded-md border p-2" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-6">
            <span className="text-sm">Mensagem fora do horário</span>
            <textarea name="offHoursMessage" defaultValue={setting?.offHoursMessage ?? "Estamos fora do horário. Voltamos em breve! 🍕"} className="rounded-md border p-2" />
          </label>
          <div className="md:col-span-6 flex items-center gap-3">
            <button className="rounded-xl border px-4 py-2 shadow-sm">Salvar</button>
            {isSubmitting && <span className="text-sm opacity-70">Salvando…</span>}
          </div>
        </Form>
      </section>

      {/* CREATE */}
      <section className="rounded-2xl border p-4 bg-white/70">
        <h2 className="text-lg font-semibold mb-3">Nova Regra</h2>
        <Form method="post" className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input type="hidden" name="intent" value="create" />
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-sm">Nome</span>
            <input name="label" required className="rounded-md border p-2" placeholder="Saudação Oi/Olá" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-sm">Gatilho</span>
            <input name="trigger" required className="rounded-md border p-2" placeholder="oi|olá (regex) ou 'cardápio'" />
          </label>
          <label className="flex items-center gap-2 md:col-span-1">
            <input type="checkbox" name="isRegex" /> <span className="text-sm">Regex</span>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm">Prioridade</span>
            <input name="priority" type="number" defaultValue={100} className="rounded-md border p-2" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-sm">Janela (De)</span>
            <input name="activeFrom" type="datetime-local" className="rounded-md border p-2" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-sm">Janela (Até)</span>
            <input name="activeTo" type="datetime-local" className="rounded-md border p-2" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-12">
            <span className="text-sm">Resposta</span>
            <textarea name="response" required className="rounded-md border p-2" placeholder={"Olá! Digite 1 para Cardápio, 2 para Promoções…"} />
          </label>
          <div className="md:col-span-12 flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isActive" defaultChecked /> <span className="text-sm">Ativa</span>
            </label>
            <button className="rounded-xl border px-4 py-2 shadow-sm">Criar regra</button>
          </div>
        </Form>
      </section>

      {/* LIST */}
      <section className="rounded-2xl border p-4 bg-white/70">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Regras Cadastradas</h2>
          <Pagination total={total} page={page} pages={pages} />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">#</th>
                <th>Nome</th>
                <th>Gatilho</th>
                <th>Regex</th>
                <th>Prioridade</th>
                <th>Janela</th>
                <th>Ativa</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any, idx: number) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2 pr-2">{(idx + 1) + (page - 1) * pageSize}</td>
                  <td className="pr-3 max-w-[220px] truncate" title={r.label}>{r.label}</td>
                  <td className="pr-3 max-w-[260px]">
                    <code className="rounded bg-gray-50 px-1 py-0.5 break-all">{r.trigger}</code>
                  </td>
                  <td className="pr-3">{r.isRegex ? "Sim" : "Não"}</td>
                  <td className="pr-3">{r.priority}</td>
                  <td className="pr-3 text-xs">
                    {r.activeFrom ? new Date(r.activeFrom).toLocaleString() : "—"} → {r.activeTo ? new Date(r.activeTo).toLocaleString() : "—"}
                  </td>
                  <td className="pr-3">
                    <Form method="post">
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="id" value={r.id} />
                      <button className={`rounded-full px-3 py-1 text-xs border ${r.isActive ? "bg-green-600 text-white" : "bg-gray-100"}`}>
                        {r.isActive ? "Ativa" : "Inativa"}
                      </button>
                    </Form>
                  </td>
                  <td className="pr-2 text-right">
                    <details className="inline-block mr-2">
                      <summary className="cursor-pointer text-blue-600">Editar</summary>
                      <div className="mt-2 rounded border p-3 bg-white shadow w-[min(90vw,720px)]">
                        <Form method="post" className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="id" value={r.id} />
                          <input name="label" defaultValue={r.label} className="rounded-md border p-2 md:col-span-4" />
                          <input name="trigger" defaultValue={r.trigger} className="rounded-md border p-2 md:col-span-4" />
                          <label className="flex items-center gap-2 md:col-span-2">
                            <input type="checkbox" name="isRegex" defaultChecked={r.isRegex} /> Regex
                          </label>
                          <input name="priority" type="number" defaultValue={r.priority} className="rounded-md border p-2 md:col-span-2" />
                          <label className="flex flex-col gap-1 md:col-span-6">
                            <span className="text-sm">Janela (De)</span>
                            <input name="activeFrom" defaultValue={r.activeFrom ? toLocalDatetimeValue(r.activeFrom) : ""} type="datetime-local" className="rounded-md border p-2" />
                          </label>
                          <label className="flex flex-col gap-1 md:col-span-6">
                            <span className="text-sm">Janela (Até)</span>
                            <input name="activeTo" defaultValue={r.activeTo ? toLocalDatetimeValue(r.activeTo) : ""} type="datetime-local" className="rounded-md border p-2" />
                          </label>
                          <textarea name="response" defaultValue={r.response} className="rounded-md border p-2 md:col-span-12 min-h-[120px]" />
                          <label className="flex items-center gap-2 md:col-span-4">
                            <input type="checkbox" name="isActive" defaultChecked={r.isActive} /> Ativa
                          </label>
                          <div className="md:col-span-8 text-right">
                            <button className="rounded-xl border px-3 py-1 shadow-sm">Salvar</button>
                          </div>
                        </Form>
                      </div>
                    </details>

                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-xl border px-3 py-1 text-red-600">Excluir</button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3"><Pagination total={total} page={page} pages={pages} /></div>
      </section>
    </div>
  );
}

// ----------------------------
// Helpers UI
// ----------------------------
function Pagination({ total, page, pages }: { total: number; page: number; pages: number }) {
  const [sp] = useSearchParams();
  const submit = useSubmit();
  if (pages <= 1) return null;

  const toQuery = (p: number) => {
    const f = new FormData();
    sp.forEach((v, k) => f.append(k, v));
    f.set("page", String(p));
    return f;
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-70">Total: {total}</span>
      <button
        className="rounded border px-3 py-1 disabled:opacity-50"
        disabled={page <= 1}
        onClick={(e) => {
          e.preventDefault();
          submit(toQuery(page - 1), { method: "get" });
        }}
      >Anterior</button>
      <span className="px-2">{page} / {pages}</span>
      <button
        className="rounded border px-3 py-1 disabled:opacity-50"
        disabled={page >= pages}
        onClick={(e) => {
          e.preventDefault();
          submit(toQuery(page + 1), { method: "get" });
        }}
      >Próxima</button>
    </div>
  );
}

function toLocalDatetimeValue(d: string | Date) {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
