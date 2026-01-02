import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listContacts } from "~/domain/z-api/zapi.service";
import { ValidationError } from "~/domain/z-api/errors";
import { ZApiError } from "~/domain/z-api/zapi-client.server";

type LoaderData = {
  contacts: any[];
  page: number;
  pageSize: number;
  total: number | null;
  error?: string;
  fetchedAt: string;
};

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

export default function AdminZapiContactsPage() {
  const { contacts, page, pageSize, total, error, fetchedAt } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isLoading = navigation.state === "loading";
  const hasNext = (contacts?.length ?? 0) >= pageSize;
  const hasPrev = page > 1;
  const prevPage = Math.max(1, page - 1);
  const nextPage = page + 1;

  return (
    <div className="flex max-w-6xl flex-col gap-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contatos Z-API</h1>
          <p className="text-sm text-muted-foreground">
            Consulta paginada direta da Z-API para monitorar contatos do WhatsApp.
          </p>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de contatos</CardTitle>
              <CardDescription>
                Página {page} • Tamanho {pageSize}
                {typeof total === "number" ? ` • Total: ${total}` : " • Total: não informado pela API"}
                {fetchedAt ? ` • Atualizado: ${new Date(fetchedAt).toLocaleTimeString()}` : ""}
              </CardDescription>
            </div>
            {isLoading && (
              <span className="text-xs font-medium text-muted-foreground">
                Atualizando...
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
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
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[180px] text-left">Phone</TableHead>
                    <TableHead className="text-left">Nome</TableHead>
                    <TableHead className="w-[220px] text-left">ID</TableHead>
                    <TableHead className="text-left">Raw</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts?.length ? (
                    contacts.map((contact: any, idx: number) => (
                      <TableRow key={`${contact.id || contact.phone || idx}`}>
                        <TableCell className="font-mono text-xs">
                          {contact.phone || contact.number || "-"}
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
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
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {contact.id || contact.lid || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {contact.rawName || contact.short || contact.profileName || contact.vname || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum contato retornado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableCaption className="bg-muted/30">
                  Contatos recuperados diretamente da instância configurada na Z-API.
                </TableCaption>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{contacts?.length ?? 0} contato(s) nesta página</span>
          </div>
        </CardContent>
      </Card>
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
