import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { getContactProfilePicture, listContacts } from "~/domain/z-api/zapi.service";
import { ValidationError } from "~/domain/z-api/errors";
import { ZApiError } from "~/domain/z-api/zapi-client.server";
import prisma from "~/lib/prisma/client.server";
import { normalize_phone_e164_br } from "~/domain/crm/normalize-phone.server";

type LoaderData = {
  contacts: any[];
  page: number;
  pageSize: number;
  total: number | null;
  error?: string;
  fetchedAt: string;
};

type ActionData = {
  ok: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  nextPage?: number;
  invalidPhones?: Array<{ phone: string; timestamp: number }>;
  results?: ImportResult[];
  error?: string;
};

const MAX_INVALID_PHONE_LOGS = 50;
const MAX_INVALID_PHONE_DISPLAY = 5;
const invalidPhoneLog: Array<{ phone: string; timestamp: number }> = [];
const IMPORT_STATUS_CACHE_PREFIX = "zapi-import-status";
type ImportStatus = "created" | "updated" | "skipped" | "failed" | "invalid_phone";
type ImportResult = { key: string; status: ImportStatus; error?: string };

function addInvalidPhoneLog(phone: string) {
  invalidPhoneLog.unshift({ phone, timestamp: Date.now() });
  if (invalidPhoneLog.length > MAX_INVALID_PHONE_LOGS) {
    invalidPhoneLog.length = MAX_INVALID_PHONE_LOGS;
  }
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof ZApiError || error instanceof ValidationError) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as any).message);
  return "Erro ao importar contato";
}

function getContactKey(contact: any, idx: number) {
  return String(contact?.id || contact?.phone || contact?.number || contact?.lid || idx);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || 20));

  try {
    const result = await listContacts({ page, pageSize });

    const contacts = normalizeContacts(result);
    const total = normalizeTotal(result);
    return json<LoaderData>({ contacts, page, pageSize, total, fetchedAt: new Date().toISOString() });
  } catch (error: any) {
    const message =
      error instanceof ZApiError
        ? error.message
        : error instanceof ValidationError
          ? error.message
          : error?.message || "Erro ao carregar contatos";
    return json<LoaderData>(
      { contacts: [], page, pageSize, total: null, error: message, fetchedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json<ActionData>({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "import") {
    return json<ActionData>({ ok: false, error: "invalid_intent" }, { status: 400 });
  }

  const page = Math.max(1, Number(formData.get("page") || 1));
  const pageSize = Math.max(1, Number(formData.get("importPageSize") || 20));
  const overwriteName = formData.get("overwriteName") === "on";

  try {
    const result = await listContacts({ page, pageSize });
    const contacts = normalizeContacts(result);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const invalidPhones: Array<{ phone: string; timestamp: number }> = [];
    const results: ImportResult[] = [];
    const importSource = "zapi-contacts";

    for (const [idx, contact] of contacts.entries()) {
      const key = getContactKey(contact, idx);
      try {
        const rawPhone = contact?.phone || contact?.number || "";
        const phone_e164 = normalize_phone_e164_br(rawPhone);
        if (!phone_e164) {
          skipped += 1;
          results.push({
            key,
            status: "invalid_phone",
            error: rawPhone ? `Telefone inválido: ${rawPhone}` : "Telefone inválido",
          });
          if (rawPhone) {
            const entry = { phone: String(rawPhone), timestamp: Date.now() };
            invalidPhones.push(entry);
            addInvalidPhoneLog(entry.phone);
          }
          continue;
        }

        const name =
          contact?.pushname ||
          contact?.name ||
          contact?.vname ||
          contact?.short ||
          contact?.profileName ||
          "";

        const existing = await prisma.crmCustomer.findUnique({
          where: { phone_e164 },
          select: { id: true, name: true },
        });

        let customer = existing;
        if (existing) {
          const shouldUpdateName = Boolean(name) && (overwriteName || !existing.name);
          if (shouldUpdateName) {
            customer = await prisma.crmCustomer.update({
              where: { phone_e164 },
              data: { name },
              select: { id: true, name: true },
            });
            updated += 1;
            results.push({ key, status: "updated" });
            await prisma.crmCustomerEvent.create({
              data: {
                customer_id: customer.id,
                event_type: "WHATSAPP_IMPORT",
                source: importSource,
                external_id: `${page}:${pageSize}`,
                payload: { status: "updated", phone_e164, name: name || undefined, page, pageSize },
                payload_raw: JSON.stringify({ status: "updated", phone_e164, name: name || undefined, page, pageSize }),
              },
            });
          } else {
            skipped += 1;
            results.push({ key, status: "skipped", error: "Ignorado: já existe e não houve mudança" });
            await prisma.crmCustomerEvent.create({
              data: {
                customer_id: existing.id,
                event_type: "WHATSAPP_IMPORT",
                source: importSource,
                external_id: `${page}:${pageSize}`,
                payload: { status: "skipped", reason: "no_change", phone_e164, name: name || undefined, page, pageSize },
                payload_raw: JSON.stringify({
                  status: "skipped",
                  reason: "no_change",
                  phone_e164,
                  name: name || undefined,
                  page,
                  pageSize,
                }),
              },
            });
          }
        } else {
          customer = await prisma.crmCustomer.create({
            data: {
              phone_e164,
              name: name || null,
              preferred_channel: "whatsapp",
            },
            select: { id: true, name: true },
          });
          created += 1;
          results.push({ key, status: "created" });
          await prisma.crmCustomerEvent.create({
            data: {
              customer_id: customer.id,
              event_type: "WHATSAPP_IMPORT",
              source: importSource,
              external_id: `${page}:${pageSize}`,
              payload: { status: "created", phone_e164, name: name || undefined, page, pageSize },
              payload_raw: JSON.stringify({ status: "created", phone_e164, name: name || undefined, page, pageSize }),
            },
          });
        }

        if (customer) {
          const existingImage = await prisma.crmCustomerImage.findFirst({
            where: { customer_id: customer.id },
            select: { id: true },
          });

          if (!existingImage) {
            const normalizedDigits = phone_e164.replace(/\D/g, "");
            const photoResponse = await getContactProfilePicture(normalizedDigits, { timeoutMs: 5_000 }).catch(
              () => null
            );
            const photo = Array.isArray(photoResponse)
              ? photoResponse[0]?.link
              : (photoResponse as any)?.link;

            if (photo) {
              await prisma.crmCustomerImage.create({
                data: {
                  customer_id: customer.id,
                  url: photo,
                  description: "WhatsApp profile photo",
                },
              });
            }
          }
        }
      } catch (error) {
        failed += 1;
        results.push({ key, status: "failed", error: getImportErrorMessage(error) });
      }
    }

    return json<ActionData>({
      ok: true,
      created,
      updated,
      skipped,
      failed,
      nextPage: page + 1,
      invalidPhones,
      results,
    });
  } catch (error: any) {
    const message =
      error instanceof ZApiError
        ? error.message
        : error instanceof ValidationError
          ? error.message
          : error?.message || "Erro ao importar contatos";
    return json<ActionData>({ ok: false, error: message }, { status: 500 });
  }
}

export default function AdminZapiContactsPage() {
  const { contacts, page, pageSize, total, error, fetchedAt } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isLoading = navigation.state === "loading";
  const isSubmitting = navigation.state === "submitting";
  const [cachedResults, setCachedResults] = useState<ImportResult[]>([]);
  const cacheKey = useMemo(() => `${IMPORT_STATUS_CACHE_PREFIX}:${page}:${pageSize}`, [page, pageSize]);
  const importResults = isSubmitting ? [] : actionData?.results ?? cachedResults;
  const showImportStatus = isSubmitting || importResults.length > 0;
  const importStatusByKey = new Map(importResults.map((entry) => [entry.key, entry]));
  const hasNext = (contacts?.length ?? 0) >= pageSize;
  const hasPrev = page > 1;
  const prevPage = Math.max(1, page - 1);
  const nextPage = page + 1;

  useEffect(() => {
    setCachedResults(readCachedImportResults(cacheKey));
  }, [cacheKey]);

  useEffect(() => {
    if (actionData?.ok && actionData.results) {
      writeCachedImportResults(cacheKey, actionData.results);
      setCachedResults(actionData.results);
    }
  }, [actionData?.ok, actionData?.results, cacheKey]);

  return (
    <div className="flex max-w-6xl flex-col gap-6 font-neue">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-white via-white to-muted/40 px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Lista de contatos</h2>
            <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Z-API
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Página {page}</span>
            <span className="hidden sm:inline">•</span>
            <span>Tamanho {pageSize}</span>
            <span className="hidden sm:inline">•</span>
            <span>{typeof total === "number" ? `Total: ${total}` : "Total: não informado pela API"}</span>
            {fetchedAt ? (
              <>
                <span className="hidden sm:inline">•</span>
                <span>Atualizado: {new Date(fetchedAt).toLocaleTimeString()}</span>
              </>
            ) : null}
          </div>
          {isLoading && (
            <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Atualizando...
            </span>
          )}
        </div>
        <Form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card/70 px-4 py-3 shadow-sm">
          <label className="flex flex-col text-xs font-medium text-muted-foreground">
            Tamanho
            <Input type="number" name="pageSize" min={1} defaultValue={pageSize} className="w-24" />
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="default" disabled={isLoading}>
              {isLoading ? "Carregando..." : "Atualizar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || revalidator.state === "loading"}
              onClick={() => revalidator.revalidate()}
            >
              {revalidator.state === "loading" ? "Recarregando..." : "Recarregar"}
            </Button>
          </div>
        </Form>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/80 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Importação manual</span>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Entenda como funciona a importação"
                  >
                    <QuestionMarkCircledIcon className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Como funciona a importação de contatos</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>A importação acontece quando você envia o formulário com o botão “Importar lote”.</p>
                    <ul className="list-disc space-y-2 pl-5">
                      <li>Busca a página atual na Z-API usando <code>listContacts</code>.</li>
                      <li>Normaliza os contatos e tenta converter o telefone para E.164 BR.</li>
                      <li>Telefones inválidos são ignorados e exibidos no alerta da página.</li>
                      <li>
                        Se o cliente já existe, pode atualizar o nome (quando marcado “Sobrescrever nome” ou nome vazio).
                      </li>
                      <li>Se não existir, cria um novo cliente no CRM com canal preferido WhatsApp.</li>
                      <li>Registra um evento <code>WHATSAPP_IMPORT</code> com status created/updated/skipped.</li>
                      <li>Se não houver foto, tenta salvar a foto de perfil do WhatsApp.</li>
                    </ul>
                    <p>O lote é sempre referente à página atual da listagem.</p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-sm text-muted-foreground">Importar contatos desta página para o CRM.</span>
            <Link to="/admin/zapi/import-logs" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
              Ver logs de importação
            </Link>
          </div>
          <Form method="post" className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <input type="hidden" name="intent" value="import" />
            <input type="hidden" name="page" value={page} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Quantidade
              <Input
                type="number"
                name="importPageSize"
                min={1}
                max={pageSize}
                defaultValue={Math.min(20, pageSize)}
                className="h-8 w-20"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="overwriteName" className="h-4 w-4" />
              Sobrescrever nome
            </label>
            <Button type="submit" variant="default" size="sm" disabled={isSubmitting}>
              Importar lote
            </Button>
          </Form>
        </div>

        {actionData?.ok === false && actionData.error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionData.error}
          </div>
        ) : null}
        {actionData?.ok ? (
          <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
            Criados: {actionData.created ?? 0} • Atualizados: {actionData.updated ?? 0} •
            Ignorados: {actionData.skipped ?? 0} • Falhas: {actionData.failed ?? 0}
            {actionData.nextPage ? ` • Próxima página: ${actionData.nextPage}` : ""}
          </div>
        ) : null}
        {actionData?.invalidPhones?.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Telefones inválidos (últimos {MAX_INVALID_PHONE_DISPLAY}):
            {" "}
            {actionData.invalidPhones
              .slice(0, MAX_INVALID_PHONE_DISPLAY)
              .map((entry) => `${entry.phone} (${new Date(entry.timestamp).toLocaleTimeString()})`)
              .join(", ")}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <div>
            Página atual: {page} {hasNext ? `• Próxima: ${nextPage}` : ""}
          </div>
          <div className="flex items-center gap-2">
            <Form method="get">
              <input type="hidden" name="page" value={prevPage} />
              <input type="hidden" name="pageSize" value={pageSize} />
              <Button type="submit" variant="outline" size="sm" disabled={!hasPrev || isLoading}>
                Previous
              </Button>
            </Form>
            <Form method="get">
              <input type="hidden" name="page" value={nextPage} />
              <input type="hidden" name="pageSize" value={pageSize} />
              <Button type="submit" variant="outline" size="sm" disabled={!hasNext || isLoading}>
                Next
              </Button>
            </Form>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div
              className={[
                "hidden gap-4 border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid",
                showImportStatus
                  ? "grid-cols-[160px_minmax(0,1.6fr)_220px_minmax(0,1fr)_minmax(0,1fr)_180px]"
                  : "grid-cols-[160px_minmax(0,1.6fr)_220px_minmax(0,1fr)_minmax(0,1fr)]",
              ].join(" ")}
            >
              <span>Phone</span>
              <span>Nome</span>
              <span>ID</span>
              <span>Raw</span>
              {showImportStatus ? <span>Importação</span> : null}
            </div>
            <ul className="divide-y divide-border/60">
              {contacts?.length ? (
                contacts.map((contact: any, idx: number) => (
                  <li
                    key={`${contact.id || contact.phone || idx}`}
                    className={[
                      "flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 md:grid md:items-center md:gap-4",
                      showImportStatus
                        ? "md:grid-cols-[160px_minmax(0,1.6fr)_220px_minmax(0,1fr)_minmax(0,1fr)_180px]"
                        : "md:grid-cols-[160px_minmax(0,1.6fr)_220px_minmax(0,1fr)_minmax(0,1fr)]",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground md:hidden">Phone</span>
                      <span className="font-mono text-xs">{contact.phone || contact.number || "-"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {getInitials(contact.pushname || contact.name || contact.vname || "?")}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {contact.pushname || contact.name || contact.vname || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {contact.short || contact.profileName || ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground md:hidden">ID</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {contact.id || contact.lid || "-"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground md:hidden">Raw</span>
                      <span className="text-xs text-muted-foreground">
                        {contact.rawName || contact.short || contact.profileName || contact.vname || "-"}
                      </span>
                    </div>
                    {showImportStatus ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground md:hidden">
                          Importação
                        </span>
                        <ImportStatusCell
                          statusEntry={importStatusByKey.get(getContactKey(contact, idx))}
                          isSubmitting={isSubmitting}
                        />
                      </div>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum contato retornado.
                </li>
              )}
            </ul>
            <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              Contatos recuperados diretamente da instância configurada na Z-API.
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{contacts?.length ?? 0} contato(s) nesta página</span>
        </div>
      </section>
    </div>
  );
}

function readCachedImportResults(cacheKey: string): ImportResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { results?: ImportResult[] };
    return Array.isArray(parsed?.results) ? parsed.results : [];
  } catch {
    return [];
  }
}

function writeCachedImportResults(cacheKey: string, results: ImportResult[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ results, updatedAt: new Date().toISOString() }));
  } catch {
    // ignore quota errors
  }
}

function normalizeContacts(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray((result as any).contacts)) return (result as any).contacts;
  if (Array.isArray((result as any).data)) return (result as any).data;
  if (Array.isArray((result as any).items)) return (result as any).items;
  return [];
}

function normalizeTotal(result: any): number | null {
  if (typeof (result as any)?.total === "number") return (result as any).total;
  if (typeof (result as any)?.count === "number") return (result as any).count;
  if (typeof (result as any)?.size === "number") return (result as any).size;
  return null;
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase?.() || "").join("") || "?";
}

function ImportStatusCell({
  statusEntry,
  isSubmitting,
}: {
  statusEntry?: ImportResult;
  isSubmitting: boolean;
}) {
  if (!statusEntry && isSubmitting) {
    return <span className="text-xs text-muted-foreground">Aguardando...</span>;
  }

  if (!statusEntry) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  const label = getImportStatusLabel(statusEntry.status);
  const className = getImportStatusClass(statusEntry.status);
  const baseBadge = "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";

  if (statusEntry.error) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`${baseBadge} h-7 px-2 ${className}`}
          >
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Erro na importação</DialogTitle>
            <DialogDescription>{statusEntry.error}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return <span className={`${baseBadge} ${className}`}>{label}</span>;
}

function getImportStatusLabel(status: ImportStatus) {
  switch (status) {
    case "created":
      return "Criado";
    case "updated":
      return "Atualizado";
    case "skipped":
      return "Ignorado";
    case "invalid_phone":
      return "Telefone inválido";
    case "failed":
    default:
      return "Falhou";
  }
}

function getImportStatusClass(status: ImportStatus) {
  switch (status) {
    case "created":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "updated":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "skipped":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "invalid_phone":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
    default:
      return "border-destructive/30 bg-destructive/10 text-destructive";
  }
}
