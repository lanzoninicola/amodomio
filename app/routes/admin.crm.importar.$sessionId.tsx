import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import {
  Await,
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
} from "@remix-run/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Suspense } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  applyCrmCustomerCsvImport,
  summarizeCrmCustomerImportRows,
  updateCrmCustomerImportDecision,
  updateCrmCustomerImportDecisions,
} from "~/domain/crm/customer-csv-import.server";
import type {
  CrmCustomerImportDecision,
  NormalizedCrmCustomerImportRow,
} from "~/domain/crm/customer-csv-import";
import prisma from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [{ title: "CRM - Revisar importação" }];

type ActionData = {
  ok?: boolean;
  error?: string;
  result?: { created: number; merged: number; ignored: number };
};

function readRow(data: unknown) {
  return data as NormalizedCrmCustomerImportRow;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const sessionId = params.sessionId;
  if (!sessionId)
    throw new Response("Importação não encontrada", { status: 404 });
  const session = await prisma.importSession.findFirst({
    where: {
      id: sessionId,
      ImportProfile: { table: "crm_customer_guided_import" },
    },
    select: {
      id: true,
      description: true,
      createdAt: true,
      loaded: true,
      transformed: true,
    },
  });
  if (!session)
    throw new Response("Importação não encontrada", { status: 404 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = 25;
  const status = (url.searchParams.get("status") || "all") as
    | CrmCustomerImportDecision
    | "all";
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();

  const recordsPromise = prisma.importSessionRecord
    .findMany({
      where: { importSessionId: sessionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, data: true },
    })
    .then((records) => {
      const allRows = records.map((record) => ({
        id: record.id,
        row: readRow(record.data),
      }));
      const summary = summarizeCrmCustomerImportRows(
        allRows.map(({ row }) => row)
      );
      const filtered = allRows.filter(({ row }) => {
        if (status !== "all" && row.decision !== status) return false;
        if (!query) return true;
        return [row.normalized.name, row.normalized.phoneE164, row.match?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const safePage = Math.min(page, totalPages);
      return {
        summary,
        rows: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
        pagination: {
          page: safePage,
          pageSize,
          total: filtered.length,
          totalPages,
        },
        filters: { status, query },
      };
    });

  return defer({
    session: { ...session, createdAt: session.createdAt.toISOString() },
    records: recordsPromise,
  });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const sessionId = params.sessionId;
  if (!sessionId)
    return json<ActionData>(
      { error: "Importação não encontrada" },
      { status: 404 }
    );
  const form = await request.formData();
  const intent = String(form.get("_intent") || "");
  try {
    if (intent === "set_decision") {
      const recordId = String(form.get("recordId") || "");
      const decision = String(
        form.get("decision") || ""
      ) as CrmCustomerImportDecision;
      if (
        !recordId ||
        !["create", "merge", "ignore", "pending"].includes(decision)
      ) {
        return json<ActionData>({ error: "Decisão inválida" }, { status: 400 });
      }
      await updateCrmCustomerImportDecision({ sessionId, recordId, decision });
      return json<ActionData>({ ok: true });
    }
    if (intent === "ignore_pending") {
      await updateCrmCustomerImportDecisions({
        sessionId,
        from: "pending",
        to: "ignore",
      });
      return json<ActionData>({ ok: true });
    }
    if (intent === "apply") {
      const records = await prisma.importSessionRecord.findMany({
        where: { importSessionId: sessionId },
        select: { data: true },
      });
      const pending = records.filter(
        (record) => readRow(record.data).decision === "pending"
      ).length;
      if (pending) {
        return json<ActionData>(
          {
            error: `Ainda há ${pending} registro(s) pendente(s). Revise ou marque-os para ignorar.`,
          },
          { status: 409 }
        );
      }
      const result = await applyCrmCustomerCsvImport(sessionId);
      return json<ActionData>({ ok: true, result });
    }
    return json<ActionData>({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return json<ActionData>(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao processar a importação",
      },
      { status: 500 }
    );
  }
}

export default function AdminCrmImportReview() {
  const { session, records } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const applying =
    navigation.state === "submitting" &&
    navigation.formData?.get("_intent") === "apply";

  return (
    <div className="grid gap-6 pb-10">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline">
            Etapa {session.loaded ? "3" : "2"} de 3
          </Badge>
          <h2 className="text-2xl font-semibold tracking-tight">
            {session.loaded
              ? "Importação concluída"
              : "Revise antes de aplicar"}
          </h2>
          <p className="text-sm text-muted-foreground">{session.description}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/crm/importar">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Novo arquivo
          </Link>
        </Button>
      </header>

      {actionData?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{actionData.error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => revalidator.revalidate()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {actionData?.result && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <AlertTitle>Dados aplicados ao CRM</AlertTitle>
          <AlertDescription>
            {actionData.result.created} criado(s), {actionData.result.merged}{" "}
            atualizado(s) e {actionData.result.ignored} ignorado(s).
            <Button asChild variant="link" className="ml-2 h-auto p-0">
              <Link to="/admin/crm">
                Abrir clientes <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Suspense fallback={<ReviewSkeleton />}>
        <Await
          resolve={records}
          errorElement={<LoadError onReload={() => revalidator.revalidate()} />}
        >
          {(data) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryCard
                  label="Novos"
                  value={data.summary.create}
                  tone="emerald"
                />
                <SummaryCard
                  label="Merge seguro"
                  value={data.summary.merge}
                  tone="blue"
                />
                <SummaryCard
                  label="Pendentes"
                  value={data.summary.pending}
                  tone="amber"
                />
                <SummaryCard
                  label="Ignorados"
                  value={data.summary.ignore}
                  tone="slate"
                />
                <SummaryCard
                  label="Aniversários preservados"
                  value={data.summary.birthdaysNotImported}
                  tone="violet"
                />
              </div>

              {!session.loaded && data.summary.pending > 0 && (
                <Alert className="border-amber-200 bg-amber-50">
                  <ShieldCheck className="h-4 w-4 text-amber-700" />
                  <AlertTitle>Decisões humanas necessárias</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                    <span>
                      Os pendentes têm o mesmo telefone de um cliente existente,
                      mas nomes diferentes.
                    </span>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="_intent"
                        value="ignore_pending"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Ignorar todos os pendentes
                      </Button>
                    </Form>
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Registros do lote</CardTitle>
                  <CardDescription>
                    Compare o valor do ERP com o cadastro atual antes de
                    decidir.
                  </CardDescription>
                  <FilterBar
                    currentStatus={data.filters.status}
                    query={data.filters.query}
                  />
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha / decisão</TableHead>
                        <TableHead>ERP</TableHead>
                        <TableHead>CRM atual</TableHead>
                        <TableHead>Métricas importadas</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map(({ id, row }) => (
                        <ImportRow
                          key={id}
                          id={id}
                          row={row}
                          disabled={session.loaded}
                        />
                      ))}
                      {!data.rows.length && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-10 text-center text-muted-foreground"
                          >
                            Nenhum registro neste filtro.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <Pagination
                    sessionId={session.id}
                    page={data.pagination.page}
                    totalPages={data.pagination.totalPages}
                    status={data.filters.status}
                    query={data.filters.query}
                  />
                </CardContent>
              </Card>

              {!session.loaded && (
                <section className="sticky bottom-4 flex flex-col gap-3 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Confirmação final</p>
                    <p className="text-sm text-muted-foreground">
                      Serão aplicados {data.summary.create + data.summary.merge}{" "}
                      registros. A ação exige zero pendências.
                    </p>
                  </div>
                  <Form method="post">
                    <input type="hidden" name="_intent" value="apply" />
                    <Button
                      size="lg"
                      disabled={applying || data.summary.pending > 0}
                    >
                      {applying
                        ? "Aplicando em lotes..."
                        : "Confirmar e aplicar ao CRM"}
                    </Button>
                  </Form>
                </section>
              )}
            </>
          )}
        </Await>
      </Suspense>
    </div>
  );
}

function ImportRow({
  id,
  row,
  disabled,
}: {
  id: string;
  row: NormalizedCrmCustomerImportRow;
  disabled: boolean;
}) {
  const fetcher = useFetcher<ActionData>();
  const busy = fetcher.state !== "idle";
  return (
    <TableRow
      className={row.decision === "pending" ? "bg-amber-50/50" : undefined}
    >
      <TableCell className="align-top">
        <p className="text-xs text-muted-foreground">Linha {row.rowNumber}</p>
        <DecisionBadge decision={row.decision} />
        <p className="mt-1 max-w-44 text-xs text-muted-foreground">
          {row.reason}
        </p>
      </TableCell>
      <TableCell className="align-top">
        <p className="font-medium">{row.normalized.name || "—"}</p>
        <p className="text-xs text-muted-foreground">
          {row.normalized.phoneE164 || row.source.Telefone}
        </p>
        <p className="text-xs">{row.normalized.neighborhood || "Sem bairro"}</p>
      </TableCell>
      <TableCell className="align-top">
        {row.match ? (
          <>
            <p className="font-medium">{row.match.name || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">
              {row.match.phoneE164}
            </p>
            <p className="text-xs">{row.match.neighborhood || "Sem bairro"}</p>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Não existe</span>
        )}
      </TableCell>
      <TableCell className="align-top text-sm">
        <p>{row.normalized.ordersCount} pedido(s)</p>
        <p>{formatCurrency(row.normalized.totalRevenue)} no total</p>
        <p>Último: {formatDate(row.normalized.lastOrderAt)}</p>
      </TableCell>
      <TableCell className="align-top text-right">
        {!disabled && (
          <fetcher.Form
            method="post"
            className="flex flex-wrap justify-end gap-2"
          >
            <input type="hidden" name="_intent" value="set_decision" />
            <input type="hidden" name="recordId" value={id} />
            {row.match && (
              <Button
                size="sm"
                name="decision"
                value="merge"
                disabled={busy}
                variant={row.decision === "merge" ? "default" : "outline"}
              >
                Fazer merge
              </Button>
            )}
            {!row.match && (
              <Button
                size="sm"
                name="decision"
                value="create"
                disabled={busy}
                variant={row.decision === "create" ? "default" : "outline"}
              >
                Criar
              </Button>
            )}
            <Button
              size="sm"
              name="decision"
              value="ignore"
              disabled={busy}
              variant={row.decision === "ignore" ? "secondary" : "ghost"}
            >
              Ignorar
            </Button>
          </fetcher.Form>
        )}
      </TableCell>
    </TableRow>
  );
}

function FilterBar({
  currentStatus,
  query,
}: {
  currentStatus: string;
  query: string;
}) {
  return (
    <Form method="get" className="flex flex-wrap gap-2 pt-2">
      <input
        name="q"
        defaultValue={query}
        placeholder="Nome ou telefone"
        className="h-9 min-w-56 flex-1 rounded-md border px-3 text-sm"
      />
      <div className="flex flex-wrap gap-1">
        {["all", "pending", "create", "merge", "ignore"].map((status) => (
          <Button
            key={status}
            type="submit"
            name="status"
            value={status}
            size="sm"
            variant={currentStatus === status ? "default" : "outline"}
          >
            {statusLabel(status)}
          </Button>
        ))}
      </div>
    </Form>
  );
}

function Pagination({
  sessionId,
  page,
  totalPages,
  status,
  query,
}: {
  sessionId: string;
  page: number;
  totalPages: number;
  status: string;
  query: string;
}) {
  const href = (target: number) =>
    `/admin/crm/importar/${sessionId}?page=${target}&status=${encodeURIComponent(
      status
    )}&q=${encodeURIComponent(query)}`;
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
      <span>
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          asChild
          size="sm"
          variant="outline"
          className={page <= 1 ? "pointer-events-none opacity-50" : ""}
        >
          <Link to={href(Math.max(1, page - 1))}>Anterior</Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
        >
          <Link to={href(Math.min(totalPages, page + 1))}>Próxima</Link>
        </Button>
      </div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: CrmCustomerImportDecision }) {
  return (
    <Badge
      className="mt-1"
      variant={
        decision === "pending"
          ? "destructive"
          : decision === "ignore"
          ? "secondary"
          : "outline"
      }
    >
      {statusLabel(decision)}
    </Badge>
  );
}

function statusLabel(status: string) {
  return (
    (
      {
        all: "Todos",
        pending: "Pendente",
        create: "Criar",
        merge: "Merge",
        ignore: "Ignorar",
      } as Record<string, string>
    )[status] || status
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  const toneClass =
    (
      {
        emerald: "bg-emerald-50",
        blue: "bg-blue-50",
        amber: "bg-amber-50",
        slate: "bg-slate-50",
        violet: "bg-violet-50",
      } as Record<string, string>
    )[tone] || "bg-slate-50";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
function LoadError({ onReload }: { onReload: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Falha ao carregar a revisão</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        Não foi possível consultar os registros do lote.
        <Button size="sm" variant="outline" onClick={onReload}>
          Recarregar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(value)
      )
    : "—";
}
