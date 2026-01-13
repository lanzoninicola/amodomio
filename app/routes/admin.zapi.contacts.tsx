import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  error?: string;
};

const MAX_INVALID_PHONE_LOGS = 50;
const MAX_INVALID_PHONE_DISPLAY = 5;
const invalidPhoneLog: Array<{ phone: string; timestamp: number }> = [];

function addInvalidPhoneLog(phone: string) {
  invalidPhoneLog.unshift({ phone, timestamp: Date.now() });
  if (invalidPhoneLog.length > MAX_INVALID_PHONE_LOGS) {
    invalidPhoneLog.length = MAX_INVALID_PHONE_LOGS;
  }
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
    const importSource = "zapi-contacts";

    for (const contact of contacts) {
      try {
        const rawPhone = contact?.phone || contact?.number || "";
        const phone_e164 = normalize_phone_e164_br(rawPhone);
        if (!phone_e164) {
          skipped += 1;
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
      } catch {
        failed += 1;
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
  const hasNext = (contacts?.length ?? 0) >= pageSize;
  const hasPrev = page > 1;
  const prevPage = Math.max(1, page - 1);
  const nextPage = page + 1;

  return (
    <div className="flex max-w-6xl flex-col gap-6 font-neue">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Lista de contatos</h2>
            <p className="text-sm text-muted-foreground">
              Página {page} • Tamanho {pageSize}
              {typeof total === "number" ? ` • Total: ${total}` : " • Total: não informado pela API"}
              {fetchedAt ? ` • Atualizado: ${new Date(fetchedAt).toLocaleTimeString()}` : ""}
            </p>
          </div>
          {isLoading && (
            <span className="text-xs font-medium text-muted-foreground">
              Atualizando...
            </span>
          )}
        </div>
        <Form method="get" className="flex items-end gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="flex flex-col text-xs font-medium text-muted-foreground">
              Tamanho
              <Input
                type="number"
                name="pageSize"
                min={1}
                defaultValue={pageSize}
                className="w-24"
              />
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
          </div>
        </Form>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Importação manual</span>
          <span>Importar contatos desta página para o CRM.</span>
          <Link to="/admin/zapi/import-logs" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            Ver logs de importação
          </Link>
        </div>
          <Form method="post" className="flex flex-wrap items-center gap-3">
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

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="rounded-lg border border-border/60">
            <div className="hidden grid-cols-[160px_minmax(0,1fr)_220px_minmax(0,1fr)] gap-4 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span>Phone</span>
              <span>Nome</span>
              <span>ID</span>
              <span>Raw</span>
            </div>
            <ul className="divide-y divide-border/60">
              {contacts?.length ? (
                contacts.map((contact: any, idx: number) => (
                  <li
                    key={`${contact.id || contact.phone || idx}`}
                    className="flex flex-col gap-3 px-4 py-4 md:grid md:grid-cols-[160px_minmax(0,1fr)_220px_minmax(0,1fr)] md:items-center md:gap-4"
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
