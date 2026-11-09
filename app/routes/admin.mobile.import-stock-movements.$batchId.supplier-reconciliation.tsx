import type { MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export { action, loader } from "./admin.import-stock-movements.$batchId";

export const meta: MetaFunction = () => [{ title: "Admin Mobile | Conciliação de fornecedor" }];

function formatDate(value: any) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function supplierReconciliationLabel(line: any) {
  if (line?.supplierReconciliationStatus === "manual") return "conciliado manualmente";
  if (line?.supplierReconciliationStatus === "matched" || line?.supplierId) return "conciliado com cadastro";
  if (line?.supplierReconciliationStatus === "unmatched") return "pendente de conciliação";
  return "sem conciliação iniciada";
}

function summaryFromAny(summary: any) {
  return {
    total: Number(summary?.total || 0),
    pendingSupplier: Number(summary?.pendingSupplier || 0),
    readyToImport: Number(summary?.readyToImport || 0),
  };
}

export default function AdminMobileImportStockMovementsSupplierReconciliationRoute() {
  const loaderData = useLoaderData<any>();
  const payload = loaderData?.payload || {};
  const selected = payload.selected as any;
  const batch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const summary = summaryFromAny(selected?.summary || batch?.summary);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const filteredLines = useMemo(() => {
    if (filter === "all") return lines;
    return lines.filter((line) => {
      const status = String(line?.status || "");
      if (["invalid", "ignored", "skipped_duplicate"].includes(status)) return false;
      return !(line?.supplierReconciliationStatus === "matched" || line?.supplierReconciliationStatus === "manual" || line?.supplierId);
    });
  }, [filter, lines]);

  if (!batch) return null;

  return (
    <div className="space-y-4 pb-6">
      <section className="space-y-3 rounded-2xl bg-white/90 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">Conciliação de fornecedor</h2>
            <Badge variant="outline">{batch.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">{batch.name}</p>
          <p className="text-xs text-slate-500">JSON atual: {batch.supplierNotesFileName || "não anexado"}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Pendentes</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">{summary.pendingSupplier}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Prontas</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">{summary.readyToImport}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">{summary.total}</div>
          </div>
        </div>

        <Form method="post" encType="multipart/form-data" className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="_action" value="batch-attach-supplier-json" />
          <input type="hidden" name="batchId" value={batch.id} />
          <div className="space-y-1">
            <Label htmlFor="supplierNotesFile">Anexar JSON das notas</Label>
            <Input id="supplierNotesFile" name="supplierNotesFile" type="file" accept=".json,application/json" className="h-11 rounded-xl bg-white" />
          </div>
          <Button type="submit" variant="outline" className="h-11 w-full rounded-xl">
            Reprocessar conciliação
          </Button>
        </Form>

        <Button asChild variant="outline" className="h-11 w-full rounded-xl">
          <Link to={`/admin/mobile/import-stock-movements/${batch.id}`}>Voltar ao lote</Link>
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold ${
              filter === "pending" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Pendentes
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold ${
              filter === "all" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Todas
          </button>
        </div>

        <div className="space-y-3">
          {filteredLines.map((line) => (
            <article key={line.id} className="rounded-xl bg-white/90 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-950">
                    <span className="mr-1 text-slate-500">[{line.rowNumber}]</span>
                    {line.ingredientName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">{line.invoiceNumber || "-"} • {formatDate(line.movementAt)}</p>
                </div>
                <Badge variant="outline">{supplierReconciliationLabel(line)}</Badge>
              </div>
              <div className="mt-3 text-sm text-slate-800">{line.supplierName || "-"}</div>
              <div className="text-xs text-slate-500">{line.supplierCnpj || "sem CNPJ"}</div>
              <div className="text-xs text-slate-400">{line.supplierReconciliationSource || line.supplierMatchSource || "-"}</div>
            </article>
          ))}
          {filteredLines.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Nenhuma linha encontrada para este filtro.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
