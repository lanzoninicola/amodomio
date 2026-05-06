import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ImageOff,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "~/components/ui/pagination";
import { Separator } from "~/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";
import { dayjs } from "~/lib/dayjs";
import prisma from "~/lib/prisma/client.server";

type LoaderData = {
  customers: Array<{
    id: string;
    name: string | null;
    phone_e164: string;
    events: number;
    tags: number;
    tagBadges: string[];
    profileImageUrl: string | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  query: string;
  stats: {
    total: number;
    addedYesterday: number;
    addedLastWeek: number;
    addedLastMonth: number;
  };
};

function buildPageHref(params: {
  page: number;
  pageSize: number;
  query: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page));
  searchParams.set("pageSize", String(params.pageSize));
  if (params.query) searchParams.set("q", params.query);
  return `/admin/crm?${searchParams.toString()}`;
}

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

  const now = dayjs();
  const startOfToday = now.startOf("day");
  const startOfYesterday = startOfToday.subtract(1, "day");
  const startOfLastWeek = startOfToday.subtract(7, "day");
  const startOfLastMonth = startOfToday.subtract(30, "day");

  const [total, customers, totalAll, addedYesterday, addedLastWeek, addedLastMonth] = await Promise.all([
    prisma.crmCustomer.count({ where }),
    prisma.crmCustomer.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: "desc" },
      where,
      include: {
        _count: { select: { events: true, tags: true } },
        tags: { include: { tag: true } },
        images: {
          take: 1,
          orderBy: { created_at: "desc" },
          select: { url: true },
        },
      },
    }),
    prisma.crmCustomer.count(),
    prisma.crmCustomer.count({
      where: {
        created_at: {
          gte: startOfYesterday.toDate(),
          lt: startOfToday.toDate(),
        },
      },
    }),
    prisma.crmCustomer.count({
      where: {
        created_at: {
          gte: startOfLastWeek.toDate(),
        },
      },
    }),
    prisma.crmCustomer.count({
      where: {
        created_at: {
          gte: startOfLastMonth.toDate(),
        },
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
      profileImageUrl: (() => {
        const imageUrl = c.images[0]?.url?.trim();
        if (!imageUrl) return null;
        const normalized = imageUrl.toLowerCase();
        return normalized === "null" || normalized === "undefined" ? null : imageUrl;
      })(),
    })),
    pagination: { page, pageSize, total },
    query,
    stats: {
      total: totalAll,
      addedYesterday,
      addedLastWeek,
      addedLastMonth,
    },
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
  const { customers, pagination, query, stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showQuick, setShowQuick] = useState(false);
  const numberFormatter = new Intl.NumberFormat("pt-BR");
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const hasNextPage = pagination.page < totalPages;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">CRM</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                <Link to="/admin/crm/jornada-de-inserimento">Relatório de inserções</Link>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/crm/new"
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              <Plus size={14} />
              Novo cliente
            </Link>
            <Link to="/admin" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
              <ChevronLeft size={14} />
              Voltar
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
          <span>{numberFormatter.format(stats.total)} contato(s)</span>
          <span>•</span>
          <span>{numberFormatter.format(pagination.total)} registro(s) filtrado(s)</span>
          <span>•</span>
          <span>{numberFormatter.format(stats.addedLastWeek)} novo(s) nos últimos 7 dias</span>
          <span>•</span>
          <span>
            Página {pagination.page} de {totalPages}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <label htmlFor="q" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Busca
              </label>
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Nome ou telefone"
                className="mt-1 border-slate-300"
                autoComplete="off"
              />
            </div>
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="pageSize" value={pagination.pageSize} />
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Filtrar
              </button>
              <Link
                to="/admin/crm"
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpar
              </Link>
            </div>
          </Form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cadastro rápido</div>
              <div className="mt-1 text-sm text-slate-600">Cria ou atualiza contato pelo telefone.</div>
            </div>
            <Button variant={showQuick ? "default" : "outline"} type="button" onClick={() => setShowQuick((v) => !v)}>
              {showQuick ? "Ocultar" : "Abrir"}
            </Button>
          </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de registros</CardDescription>
            <CardTitle className="text-2xl">{numberFormatter.format(stats.total)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Base completa de clientes</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Adicionados ontem</CardDescription>
            <CardTitle className="text-2xl">{numberFormatter.format(stats.addedYesterday)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Últimas 24h fechadas</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última semana</CardDescription>
            <CardTitle className="text-2xl">{numberFormatter.format(stats.addedLastWeek)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Novos em 7 dias</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Último mês</CardDescription>
            <CardTitle className="text-2xl">{numberFormatter.format(stats.addedLastMonth)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Novos em 30 dias</CardContent>
        </Card>
      </section>

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

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-slate-50/90">
            <TableRow className="hover:bg-slate-50/90">
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Contato</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</TableHead>
              <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Principais tags</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="px-4 py-8 text-sm text-slate-500">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id} className="border-slate-100 hover:bg-slate-50/50">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {customer.profileImageUrl ? (
                        <img
                          src={customer.profileImageUrl}
                          alt={customer.name ? `Foto de ${customer.name}` : "Foto do cliente"}
                          className="h-10 w-10 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-400">
                          <ImageOff className="h-4 w-4" aria-label="Sem foto" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          to={`/admin/crm/${customer.id}/profile`}
                          className="truncate font-semibold text-slate-900 hover:underline"
                          title={customer.name || customer.phone_e164}
                        >
                          {customer.name || "Sem nome"}
                        </Link>
                        <span className="text-xs text-slate-500">ID: {customer.id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium text-slate-800">{customer.phone_e164}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="border-slate-200 bg-white font-medium text-slate-700">
                      {numberFormatter.format(customer.events)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 font-medium text-slate-700">
                      {numberFormatter.format(customer.tags)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {customer.tagBadges.length === 0 ? (
                        <span className="text-sm text-slate-400">Sem tags</span>
                      ) : (
                        customer.tagBadges.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            {tag}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <Link
                        to={`/admin/crm/${customer.id}/profile`}
                        className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Abrir
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-slate-500">
            Mostrando {customers.length} de {pagination.total} contato(s).
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:gap-6">
            <div className="text-xs font-semibold text-slate-900">
              Page {pagination.page} of {totalPages}
            </div>

            <Pagination className="mx-0 w-auto justify-start">
              <PaginationContent className="gap-1.5">
                <PaginationItem>
                  <PaginationLink
                    href={pagination.page > 1 ? buildPageHref({ page: 1, pageSize: pagination.pageSize, query }) : "#"}
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      pagination.page <= 1 ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Primeira pagina"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href={
                      pagination.page > 1
                        ? buildPageHref({ page: pagination.page - 1, pageSize: pagination.pageSize, query })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      pagination.page <= 1 ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Pagina anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href={
                      hasNextPage
                        ? buildPageHref({ page: pagination.page + 1, pageSize: pagination.pageSize, query })
                        : "#"
                    }
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      !hasNextPage ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Proxima pagina"
                  >
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    href={hasNextPage ? buildPageHref({ page: totalPages, pageSize: pagination.pageSize, query }) : "#"}
                    className={`h-8 w-8 rounded-md border border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50 ${
                      !hasNextPage ? "pointer-events-none opacity-40" : ""
                    }`}
                    aria-label="Ultima pagina"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  );
}
