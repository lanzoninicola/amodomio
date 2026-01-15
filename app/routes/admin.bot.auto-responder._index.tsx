import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useSearchParams, useSubmit, Link } from "@remix-run/react";
import { useEffect, useMemo } from "react";
import prismaClient from "~/lib/prisma/client.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function loader({ request }: LoaderFunctionArgs) {
  // TODO: requireUserSession(request)
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

  const [count, rules] = await Promise.all([
    prismaClient.botAutoResponseRule.count({ where }),
    prismaClient.botAutoResponseRule.findMany({
      where,
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return json({ q, page, pageSize, total: count, rules });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  // toggle/delete mantidos aqui para UX rápida na lista
  if (intent === "toggle") {
    const id = String(form.get("id"));
    const current = await prismaClient.botAutoResponseRule.findUnique({ where: { id } });
    await prismaClient.botAutoResponseRule.update({ where: { id }, data: { isActive: !current?.isActive } });
    return redirect("/admin/bot/auto-responder");
  }

  if (intent === "delete") {
    const id = String(form.get("id"));
    await prismaClient.botAutoResponseRule.delete({ where: { id } });
    return redirect("/admin/bot/auto-responder");
  }

  return json({ ok: false, error: "intent inválido" }, { status: 400 });
}

export default function IndexPage() {
  const { q, page, pageSize, total, rules } = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const isSubmitting = nav.state !== "idle";
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    if (isSubmitting) console.log("Processando…");
  }, [isSubmitting]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-end justify-between gap-3">
          <CardTitle>Regras Cadastradas</CardTitle>
          <Form method="get" className="flex gap-2 items-center">
            <Input name="q" defaultValue={q || ""} placeholder="Buscar por nome, gatilho ou resposta…" className="w-[260px]" />
            <Button type="submit" variant="outline">Buscar</Button>
            <Button asChild><Link to="/admin/bot/auto-responder/new">Nova Regra</Link></Button>
          </Form>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Regex</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Janela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r: any, idx: number) => (
                  <TableRow key={r.id}>
                    <TableCell>{(idx + 1) + (page - 1) * pageSize}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.label}>{r.label}</TableCell>
                    <TableCell className="max-w-[260px]">
                      <code className="rounded bg-muted px-1 py-0.5 break-all">{r.trigger}</code>
                    </TableCell>
                    <TableCell>{r.isRegex ? "Sim" : "Não"}</TableCell>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell className="text-xs">
                      {r.activeFrom ? new Date(r.activeFrom).toLocaleString() : "—"} → {r.activeTo ? new Date(r.activeTo).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Form method="post">
                        <input type="hidden" name="intent" value="toggle" />
                        <input type="hidden" name="id" value={r.id} />
                        <Button size="sm" variant={r.isActive ? "default" : "secondary"}>
                          {r.isActive ? "Ativa" : "Inativa"}
                        </Button>
                      </Form>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/bot/auto-responder/${r.id}/edit`}>Editar</Link>
                      </Button>
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={r.id} />
                        <Button size="sm" variant="destructive">Excluir</Button>
                      </Form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="opacity-70">Total: {total}</span>
            <Pager total={total} page={page} pages={pages} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Pager({ total, page, pages }: { total: number; page: number; pages: number }) {
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
    <div className="flex items-center gap-2">
      <Button
        variant="outline" size="sm"
        disabled={page <= 1}
        onClick={(e) => { e.preventDefault(); submit(toQuery(page - 1), { method: "get" }); }}
      >
        Anterior
      </Button>
      <span className="px-2">{page} / {pages}</span>
      <Button
        variant="outline" size="sm"
        disabled={page >= pages}
        onClick={(e) => { e.preventDefault(); submit(toQuery(page + 1), { method: "get" }); }}
      >
        Próxima
      </Button>
    </div>
  );
}
