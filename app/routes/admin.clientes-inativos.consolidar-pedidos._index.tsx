import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { DatabaseZap, Import, RefreshCw, Search, ListFilter, Trash2, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { upsertCustomerOrdersFromImport } from "~/domain/campaigns/etl.server";
import prismaClient from "~/lib/prisma/client.server";

// === shadcn/ui ===
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";

// ========== Loader: métricas + listagem ==========
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get("ps") || "20", 10)));
  const q = url.searchParams.get("q")?.trim() || "";
  const src = url.searchParams.get("src")?.trim() || "";

  const AND: any[] = [];
  if (q) {
    const qDigits = q.replace(/\D/g, "");
    AND.push({
      OR: [
        { externalOrderNumber: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { phoneE164: { contains: q } },
        ...(qDigits
          ? [
            { phoneE164: { contains: qDigits } },
            { phoneRaw: { contains: qDigits } },
          ]
          : []),
      ],
    });
  }
  if (src) AND.push({ source: src });
  const where = AND.length ? { AND } : undefined;

  const [rawImportCount, ordersCount, itemsCount, lastPaidAtRow, sources, totalList, rows] =
    await Promise.all([
      prismaClient.importMogoVendaPorCliente.count(),
      prismaClient.customerOrder.count(),
      prismaClient.customerOrderItem.count(),
      prismaClient.customerOrder.findFirst({ orderBy: { paidAt: "desc" }, select: { paidAt: true } }),
      prismaClient.customerOrder.findMany({
        distinct: ["source"],
        select: { source: true },
        orderBy: { source: "asc" },
      }),
      prismaClient.customerOrder.count({ where }),
      prismaClient.customerOrder.findMany({
        where,
        orderBy: [{ paidAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          source: true,
          externalOrderNumber: true,
          customerName: true,
          phoneE164: true,
          paidAt: true,
          totalAmount: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

  return json({
    panels: {
      rawImportCount,
      ordersCount,
      itemsCount,
      lastPaidAt: lastPaidAtRow?.paidAt ? lastPaidAtRow.paidAt.toISOString() : null,
    },
    filters: {
      q,
      src,
      sources: sources.map((s) => s.source).filter(Boolean),
    },
    list: {
      page,
      pageSize,
      total: totalList,
      rows: rows.map((o) => ({ ...o, paidAt: o.paidAt.toISOString() })),
    },
  });
}

// ========== Action: executa ETL de pedidos ==========
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, { status: 405 });

  try {
    const form = await request.formData();
    const source = String(form.get("source") || "csv");

    const t0 = Date.now();
    const res = await upsertCustomerOrdersFromImport(source);
    const tookMs = Date.now() - t0;

    return json({
      ok: true,
      source,
      ordersUpserted: Number((res as any)?.upserted ?? 0),
      ordersFound: Number((res as any)?.ordersFound ?? 0),
      tookMs,
      at: new Date().toISOString(),
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || "Falha na consolidação de pedidos",
        debug: process.env.NODE_ENV !== "production" ? String(err?.stack || err) : undefined,
      },
      { status: 500 },
    );
  }
}

// ========== Componente ==========
export default function AdminCampanhasConsolidarPedidos() {
  const { panels, filters, list } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const running = fetcher.state !== "idle";
  const [showDetails, setShowDetails] = useState(false);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(list.total / list.pageSize)), [list.total, list.pageSize]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      // @ts-ignore
      fetcher.load(window.location.pathname + window.location.search);
    }
  }, [fetcher]);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <DatabaseZap className="h-6 w-6" />
            Consolidar pedidos (histórico normalizado)
          </h1>
          <Button asChild variant="link" className="px-0">
            <Link to="/admin/campanhas/consolidar-cliente">Consolidar clientes →</Link>
          </Button>
        </header>

        <div className="flex items-center justify-between w-full">
          <Accordion type="single" collapsible >
            <AccordionItem value="tips" className="border-none">
              <AccordionTrigger >Boas práticas e observações</AccordionTrigger>
              <AccordionContent>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Execute a consolidação logo após cada importação de CSV.</li>
                  <li>O campo <code>source</code> etiqueta a carga e compõe a chave única.</li>
                  <li>Se você importar os mesmos pedidos novamente, eles serão apenas atualizados, sem criar duplicados.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Import className="h-4 w-4" />
            <Button asChild variant="link" className="px-0">
              <Link to={"/admin/importer/new/csv"}>Importar CSV antes de consolidar pedidos</Link>
            </Button>
          </div>

        </div>


        {/* Painéis */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard label="Linhas importadas (staging)" value={panels.rawImportCount} />
          <MetricCard label="Pedidos consolidados" value={panels.ordersCount} />
          <MetricCard label="Itens consolidados" value={panels.itemsCount} />
          <MetricCard label="Último pedido (paidAt)" value={panels.lastPaidAt ? formatDateTime(panels.lastPaidAt) : "—"} />
        </section>

        {/* Ações: consolidar + fonte */}
        <fetcher.Form method="post" replace className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="source" value={filters.src || "csv"} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" disabled={running} aria-busy={running} className="gap-2" title="Executa o ETL: import → customer_order / customer_order_item">
                <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
                {running ? "Consolidando..." : "Consolidar pedidos agora"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Executa o ETL e atualiza a listagem</TooltipContent>
          </Tooltip>

          <SourceSelector current={filters.src} />
        </fetcher.Form>

        {/* Feedback */}
        {fetcher.data && (
          <Alert variant={fetcher.data.ok ? "default" : "destructive"}>
            <AlertTitle>{fetcher.data.ok ? "Consolidação concluída" : "Falha na consolidação"}</AlertTitle>
            <AlertDescription>
              {fetcher.data.ok ? (
                <div className="grid gap-1 text-sm">
                  <div>
                    Fonte: <Badge variant="secondary">{fetcher.data.source}</Badge>
                  </div>
                  <div>Pedidos detectados: {fetcher.data.ordersFound}</div>
                  <div>Pedidos upsertados: {fetcher.data.ordersUpserted}</div>
                  <div>Tempo: {Math.max(1, Math.round(fetcher.data.tookMs || 0))} ms</div>
                  <div>Quando: {formatDateTime(fetcher.data.at)}</div>
                </div>
              ) : (
                <div className="text-sm">
                  <div className="font-medium mb-1">{fetcher.data.error || "Erro desconhecido"}</div>
                  {fetcher.data.debug && (
                    <details open={showDetails} onToggle={(e) => setShowDetails((e.target as any).open)}>
                      <summary className="cursor-pointer">Mostrar detalhes técnicos</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs">{fetcher.data.debug}</pre>
                    </details>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Filtros */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4" />
            <h2 className="text-lg font-semibold">Pedidos (amostra)</h2>
          </div>

          <form method="get" className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(160px,220px)_minmax(140px,180px)_auto] items-end">
            <div className="grid gap-1">
              <Label htmlFor="q">Buscar</Label>
              <div className="flex gap-2">
                <Input id="q" name="q" defaultValue={filters.q || ""} placeholder="nº pedido, nome ou telefone" />
                <Button type="submit" variant="secondary" className="shrink-0" aria-label="Aplicar filtros">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-1">
              <Label>Fonte (source)</Label>
              <Select name="src" defaultValue={filters.src || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="(todas)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">(todas)</SelectItem>
                  {filters.sources.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  {filters.sources.length === 0 && (
                    <>
                      <SelectItem value="csv">csv</SelectItem>
                      <SelectItem value="mogo">mogo</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label>Itens por página</Label>
              <Select name="ps" defaultValue={String(list.pageSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-3">
              <Button type="submit">Aplicar</Button>
              <span className="text-sm text-muted-foreground">{list.total} registros</span>
            </div>
          </form>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Badge variant="outline">{o.source}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{o.externalOrderNumber}</TableCell>
                    <TableCell>{o.customerName || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{o.phoneE164 || "—"}</TableCell>
                    <TableCell>{o._count.items}</TableCell>
                    <TableCell>{formatMoney(o.totalAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(o.paidAt)}</TableCell>
                    <TableCell>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost">
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover pedido?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O pedido {o.externalOrderNumber} será apagado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <fetcher.Form
                              method="delete"
                              action={`/admin/cliente-inativos/consolidar-pedidos/${o.id}`}
                            >
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <Button type="submit" variant="destructive">
                                Confirmar
                              </Button>
                            </fetcher.Form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                    </TableCell>
                  </TableRow>
                ))}
                {list.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Nenhum pedido encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PagerLink page={Math.max(1, list.page - 1)} disabled={list.page === 1} searchParams={searchParams} ariaLabel="Página anterior">
                  <PaginationPrevious />
                </PagerLink>
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm px-3 py-2">página <b>{list.page}</b> de <b>{totalPages}</b></span>
              </PaginationItem>
              <PaginationItem>
                <PagerLink page={Math.min(totalPages, list.page + 1)} disabled={list.page >= totalPages} searchParams={searchParams} ariaLabel="Próxima página">
                  <PaginationNext />
                </PagerLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </section>

        <Separator />


      </div>
    </TooltipProvider>
  );
}

/* ========== UI helpers ========== */
function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SourceSelector({ current }: { current?: string | null }) {
  const [sp] = useSearchParams();
  const defaultValue = current || sp.get("src") || "csv";
  return (
    <div className="grid gap-1">
      <Label>Etiquetar como</Label>
      {/* NOTE: this Select is UI-only; the hidden input above carries the value to the action */}
      <Select defaultValue={defaultValue}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="csv">csv</SelectItem>
          <SelectItem value="mogo">mogo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function PagerLink({
  page,
  disabled,
  searchParams,
  children,
  ariaLabel,
}: {
  page: number;
  disabled?: boolean;
  searchParams: URLSearchParams;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const url = new URL(typeof window !== "undefined" ? window.location.href : "http://local");
  const preserved = new URLSearchParams(searchParams);
  preserved.set("page", String(page));
  url.search = preserved.toString();

  if (disabled) {
    return (
      <span aria-disabled className="opacity-50 pointer-events-none select-none">{children}</span>
    );
  }

  return (
    <PaginationLink href={`${url.pathname}${url.search}`} aria-label={ariaLabel}>
      {children}
    </PaginationLink>
  );
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
function formatMoney(v: any) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}
