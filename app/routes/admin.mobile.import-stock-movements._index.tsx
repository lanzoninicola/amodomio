import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { ExternalLink, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { deleteStockNfImportBatch, listStockNfImportBatches } from "~/domain/stock-nf-import/stock-nf-import.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Importação de estoque" }];

function str(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function formatDate(value: any) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    ready: Number(summary?.ready || 0),
    pendingMapping: Number(summary?.pendingMapping || 0),
    pendingConversion: Number(summary?.pendingConversion || 0),
    error: Number(summary?.error || 0),
  };
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "validated":
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "applied":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function DeleteBatchButton({ batchId, batchName, status }: { batchId: string; batchName: string; status: string }) {
  const isValidated = status === "validated";

  if (!isValidated) {
    return (
      <Form method="post">
        <input type="hidden" name="_action" value="batch-delete" />
        <input type="hidden" name="batchId" value={batchId} />
        <Button type="submit" variant="outline" size="sm" className="h-9 rounded-xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800">
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </Form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800">
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar lote validado?</AlertDialogTitle>
          <AlertDialogDescription>
            O lote <strong>{batchName}</strong> está com status <strong>validated</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Form method="post">
            <input type="hidden" name="_action" value="batch-delete" />
            <input type="hidden" name="batchId" value={batchId} />
            <AlertDialogAction asChild>
              <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
                Confirmar
              </Button>
            </AlertDialogAction>
          </Form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export async function loader(_: LoaderFunctionArgs) {
  try {
    const batches = await listStockNfImportBatches(100);
    return ok({ batches });
  } catch (error) {
    return serverError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const action = str(formData.get("_action"));
    if (action !== "batch-delete") return badRequest("Ação inválida");

    const batchId = str(formData.get("batchId"));
    if (!batchId) return badRequest("Lote inválido");

    await deleteStockNfImportBatch(batchId);
    return ok({ message: "Lote eliminado com sucesso" });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminMobileImportStockMovementsIndexRoute() {
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const batches = (loaderData?.payload?.batches || []) as any[];

  return (
    <div className="space-y-4 pb-6">
      {actionData?.message ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${actionData.status >= 400 ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          {actionData.message}
        </div>
      ) : null}

      <section className="border-b border-slate-200 pb-4">
        <p className="text-sm text-slate-600">{batches.length} lote(s) disponíveis.</p>
      </section>

      <div className="space-y-4">
        {batches.map((batch) => {
          const summary = summaryFromAny(batch.summary);
          return (
            <article key={batch.id} className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/admin/mobile/import-stock-movements/${batch.id}`} className="block truncate text-sm font-semibold text-slate-950">
                    {batch.name}
                  </Link>
                  <div className="mt-1 text-xs text-slate-500">{batch.originalFileName || "-"}</div>
                  <div className="text-xs text-slate-500">Criado em {formatDate(batch.createdAt)}</div>
                </div>
                <Badge variant="outline" className={statusBadgeClass(String(batch.status))}>
                  {batch.status}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-3">
                {[
                  ["Total", summary.total],
                  ["Prontas", summary.ready],
                  ["Pend.", summary.pendingMapping + summary.pendingConversion],
                  ["Erros", summary.error],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
                    <div className="mt-1 text-base font-semibold text-slate-950">{value as any}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <DeleteBatchButton
                  batchId={String(batch.id)}
                  batchName={String(batch.name || "sem nome")}
                  status={String(batch.status || "")}
                />
                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200">
                  <Link to={`/admin/mobile/import-stock-movements/${batch.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir lote
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
