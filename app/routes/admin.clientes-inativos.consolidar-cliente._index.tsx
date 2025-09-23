// app/routes/admin.campanhas.consolidar-cliente._index.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { Import } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { upsertCustomerOrdersFromImport, upsertCustomersFromErp } from "~/domain/campaigns/etl.server";
import prismaClient from "~/lib/prisma/client.server";

// ===== Loader: painéis + amostra de clientes =====
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get("ps") || "20", 10)));
  const q = url.searchParams.get("q")?.trim() || "";

  const [rawCount, customersCount, customersNever, lastUpdated] = await Promise.all([
    prismaClient.importMogoVendaPorCliente.count(),
    prismaClient.customer.count(),
    prismaClient.customer.count({ where: { lastOrderAt: null } }),
    prismaClient.customer.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } })
      .then((r) => r?.updatedAt ?? null),
  ]);

  const AND: any[] = [];
  if (q) {
    AND.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q.replace(/\D/g, "") } },
      ],
    });
  }
  const where = AND.length ? { AND } : undefined;

  const [totalList, rows] = await Promise.all([
    prismaClient.customer.count({ where }),
    prismaClient.customer.findMany({
      where,
      orderBy: [{ lastOrderAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, phone: true, lastOrderAt: true },
    }),
  ]);

  return json({
    rawCount,
    customersCount,
    customersNever,
    lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    list: {
      q, page, pageSize, total: totalList,
      rows: rows.map((c) => ({
        ...c,
        dias: c.lastOrderAt ? Math.max(0, Math.floor((Date.now() - c.lastOrderAt.getTime()) / 86400000)) : null,
      })),
    },
  });
}

// ===== Action: consolida pedidos e, em seguida, clientes =====
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ ok: false }, { status: 405 });

  try {
    const t0 = Date.now();

    // 1) consolida pedidos (camada histórica)
    const ordersRes = await upsertCustomerOrdersFromImport("csv"); // ajuste o source se quiser
    // 2) consolida base de clientes (por telefone)
    const customersRes = await upsertCustomersFromErp();

    const tookMs = Date.now() - t0;
    return json({
      ok: true,
      ordersUpserted: Number((ordersRes as any)?.upserted ?? 0),
      customersUpserted: Number((customersRes as any)?.upserted ?? 0),
      tookMs,
      at: new Date().toISOString(),
    });
  } catch (err: any) {
    return json(
      { ok: false, error: err?.message || "Falha na atualização", debug: String(err?.stack || err) },
      { status: 500 },
    );
  }
}

// ===== Componente =====
export default function AdminCampanhasConsolidarCliente() {
  const { rawCount, customersCount, customersNever, lastUpdated, list } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const running = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      // @ts-ignore
      fetcher.load(window.location.pathname + window.location.search);
    }
  }, [fetcher]);

  const [showDetails, setShowDetails] = useState(false);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(list.total / list.pageSize)),
    [list.total, list.pageSize],
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Consolidar base de clientes</h1>

      <section className="flex items-center gap-2">
        <Import />
        <Link to={"/admin/importer/new/csv"}>
          <span className="text-md hover:underline">Importar pedidos para consolidamento base cliente</span>
        </Link>
      </section>

      {/* painéis */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card label="Linhas importadas (ERP)" value={rawCount} />
        <Card label="Clientes na base" value={customersCount} />
        <Card label="Clientes sem último pedido" value={customersNever} />
        <Card label="Última atualização" value={lastUpdated ? formatDateTime(lastUpdated) : "—"} />
      </section>

      {/* botão */}
      <fetcher.Form method="post" replace>
        <button type="submit" className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={running}>
          {running ? "Atualizando..." : "Atualizar base agora"}
        </button>
      </fetcher.Form>

      {/* feedback */}
      {fetcher.data && (
        <div
          className={`p-4 border rounded text-sm ${fetcher.data.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200 text-red-700"}`}
        >
          {fetcher.data.ok ? (
            <div className="space-y-1">
              <b>Atualização concluída.</b>
              <div>Pedidos upsertados: {fetcher.data.ordersUpserted}</div>
              <div>Clientes upsertados: {fetcher.data.customersUpserted}</div>
              <div>Tempo: {Math.max(1, Math.round(fetcher.data.tookMs || 0))} ms</div>
              <div>Quando: {formatDateTime(fetcher.data.at)}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div><b>Erro:</b> {fetcher.data.error || "Falha na atualização"}</div>
              {fetcher.data.debug && (
                <details open={showDetails} onToggle={(e) => setShowDetails((e.target as any).open)}>
                  <summary className="cursor-pointer">Mostrar detalhes técnicos</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">{fetcher.data.debug}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* lista de clientes */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Clientes (amostra)</h2>

        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-sm">Buscar</label>
            <input name="q" defaultValue={list.q || ""} placeholder="nome ou telefone" className="border rounded px-2 py-1" />
          </div>
          <div className="flex flex-col">
            <label className="text-sm">Itens por página</label>
            <select name="ps" defaultValue={String(list.pageSize)} className="border rounded px-2 py-1">
              <option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option>
            </select>
          </div>
          <button className="px-3 py-2 rounded bg-gray-900 text-white">Aplicar</button>
          <div className="text-sm text-gray-600">{list.total} registros</div>
        </form>

        <div className="border rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Telefone</th>
                <th className="p-2 text-left">Último pedido</th>
                <th className="p-2 text-left">Dias</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.name || "—"}</td>
                  <td className="p-2">{c.phone}</td>
                  <td className="p-2">{c.lastOrderAt ? formatDateTime(c.lastOrderAt.toString()) : "—"}</td>
                  <td className="p-2">{c.dias ?? "—"}</td>
                </tr>
              ))}
              {list.rows.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={4}>Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* paginação simples */}
        <nav className="flex items-center gap-2">
          <PagerLink page={1} disabled={list.page === 1}>«</PagerLink>
          <PagerLink page={Math.max(1, list.page - 1)} disabled={list.page === 1}>‹</PagerLink>
          <span className="text-sm">página <b>{list.page}</b> de <b>{totalPages}</b></span>
          <PagerLink page={Math.min(totalPages, list.page + 1)} disabled={list.page >= totalPages}>›</PagerLink>
          <PagerLink page={totalPages} disabled={list.page >= totalPages}>»</PagerLink>
        </nav>
      </section>

      <Tips />
    </div>
  );
}

// ===== UI helpers =====
function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function PagerLink({ page, disabled, children }: { page: number; disabled?: boolean; children: React.ReactNode; }) {
  const url = new URL(typeof window !== "undefined" ? window.location.href : "http://local");
  url.searchParams.set("page", String(page));
  return (
    <a href={disabled ? "#" : `${url.pathname}${url.search}`} className={`px-2 py-1 border rounded text-sm ${disabled ? "pointer-events-none opacity-50" : ""}`}>{children}</a>
  );
}
function Tips() {
  return (
    <details className="mt-6">
      <summary className="cursor-pointer text-sm text-gray-600">Boas práticas e observações</summary>
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
        <li>Rode a atualização sempre que importar um novo CSV (ou agende 1×/dia).</li>
        <li>Telefones são normalizados antes do upsert; inválidos são ignorados.</li>
        <li>Para alto volume, considere processar em lotes.</li>
      </ul>
    </details>
  );
}
function formatDateTime(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
