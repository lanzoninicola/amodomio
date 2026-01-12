import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, type ReactNode } from "react";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";
import { Separator } from "~/components/ui/separator";

type LoaderData = {
  customers: Array<{
    id: string;
    name: string | null;
    phone_e164: string;
    events: number;
    tags: number;
    tagBadges: string[];
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  query: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 20)));
  const query = (url.searchParams.get("q") || "").trim();
  const where = query
    ? {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { phone_e164: { contains: query, mode: "insensitive" } },
      ],
    }
    : undefined;

  const [total, customers] = await Promise.all([
    prisma.crmCustomer.count({ where }),
    prisma.crmCustomer.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: "desc" },
      where,
      include: {
        _count: { select: { events: true, tags: true } },
        tags: { include: { tag: true } },
      },
    }),
  ]);

  return json<LoaderData>({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone_e164: c.phone_e164,
      events: c._count.events,
      tags: c._count.tags,
      tagBadges: c.tags.map((t) => t.tag.label || t.tag.key),
    })),
    pagination: { page, pageSize, total },
    query,
  });
}

export const meta: MetaFunction = () => [{ title: "CRM - Clientes" }];

type ActionData = { error?: string; ok?: boolean };

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const form = await request.formData();
  const phone = String(form.get("phone") || "").trim();
  const name = String(form.get("name") || "").trim();

  if (!phone) return json<ActionData>({ error: "Telefone é obrigatório" }, { status: 400 });

  const phone_e164 = normalize_phone_e164_br(phone);
  if (!phone_e164) return json<ActionData>({ error: "Telefone inválido" }, { status: 400 });

  const customer = await prisma.crmCustomer.upsert({
    where: { phone_e164 },
    update: name ? { name } : {},
    create: { phone_e164, name: name || null },
  });

  await prisma.crmCustomerEvent.create({
    data: {
      customer_id: customer.id,
      event_type: "PROFILE_UPDATE",
      source: "admin-ui",
      payload: { action: "customer_upsert", source: "admin-ui" },
      payload_raw: "customer_upsert",
    },
  });

  return redirect(`/admin/crm/${customer.id}/timeline`);
}

export default function AdminCrmIndex() {
  const { customers, pagination, query } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showQuick, setShowQuick] = useState(false);

  return (
    <div className="grid gap-5 font-neue">

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Clientes</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/admin/crm/new">Novo cliente completo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/crm/jornada-de-inserimento">Relatório de inserções</Link>
            </Button>
            <Button variant={showQuick ? "default" : "outline"} type="button" onClick={() => setShowQuick((v) => !v)}>
              {showQuick ? "Ocultar cadastro rápido" : "Cadastro rápido"}
            </Button>
          </div>
          <Form method="get" className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex-1 sm:min-w-[280px]">
              <Input
                name="q"
                placeholder="Buscar por nome ou telefone"
                defaultValue={query}
                className="w-full"
                autoComplete="off"
              />
            </div>
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="pageSize" value={pagination.pageSize} />
            <div className="flex gap-2 sm:justify-end">
              <Button type="submit" variant="default">
                Buscar
              </Button>
              {query ? (
                <Button variant="ghost" asChild>
                  <Link to="?">Limpar</Link>
                </Button>
              ) : null}
            </div>
          </Form>
        </div>
      </div>




      {showQuick ? (
        <Card id="quick-create">
          <CardHeader>
            <CardTitle>Novo cliente</CardTitle>
            <CardDescription>Cadastro rápido (upsert por telefone E.164).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {actionData?.error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionData.error}
              </div>
            )}
            <Form method="post" className="grid gap-3 md:grid-cols-2 md:items-end">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Telefone (E.164 ou BR)</label>
                <Input name="phone" placeholder="+5544999999999" required />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <Input name="name" placeholder="Nome do cliente" required />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar e abrir"}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      <Separator className="my-2" />

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">


          <p className="text-xs text-muted-foreground">
            Mostrando {customers.length} de {pagination.total} registros.
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PageLink
              page={pagination.page - 1}
              disabled={pagination.page <= 1}
              pageSize={pagination.pageSize}
              query={query}
            >
              Anterior
            </PageLink>
            <span className="text-muted-foreground">Página {pagination.page}</span>
            <PageLink
              page={pagination.page + 1}
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              pageSize={pagination.pageSize}
              query={query}
            >
              Próxima
            </PageLink>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-left">Nome</TableHead>
                <TableHead className="text-left">Telefone</TableHead>
                <TableHead className="text-left">Eventos</TableHead>
                <TableHead className="text-left">Tags</TableHead>
                <TableHead className="text-left">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length ? (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.phone_e164}</TableCell>
                    <TableCell>{c.events}</TableCell>
                    <TableCell className="space-x-1">
                      {c.tagBadges.length ? (
                        c.tagBadges.map((tag) => (
                          <span key={tag} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Nenhuma</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={`/admin/crm/${c.id}/profile`} className="text-primary underline">
                        Abrir
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nenhum cliente ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function PageLink({
  page,
  pageSize,
  disabled,
  children,
  query,
}: {
  page: number;
  pageSize: number;
  disabled?: boolean;
  children: ReactNode;
  query?: string;
}) {
  if (disabled || page < 1) {
    return <span className="rounded border px-2 py-1 text-muted-foreground/70">{children}</span>;
  }
  const searchParams = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (query) searchParams.set("q", query);
  const search = searchParams.toString();
  return (
    <Link to={`?${search}`} className="rounded border px-2 py-1 text-primary hover:bg-muted">
      {children}
    </Link>
  );
}
