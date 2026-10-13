import { useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
export type StockBatchView = {
  batchId: string;
  url?: string;
  summary: Record<string, number>;
  lines: Array<{
    id: string;
    ingredientName: string;
    qtyEntry: number;
    unitEntry: string;
    status: string;
    errorMessage?: string;
    mappedItemId?: string;
    targetUnit?: string;
    costAmount?: number;
    costTotalAmount?: number;
    convertedCostAmount?: number;
    supplierReconciliationStatus?: string;
  }>;
  items: Array<{ id: string; name: string; unit?: string }>;
  suppliers?: Array<{ id: string; name: string }>;
};
export type StockRequest = (payload: Record<string, unknown>) => Promise<any>;
const labels: Record<string, string> = {
  ready: "Pronto",
  pending_mapping: "Vincular produto",
  pending_conversion: "Definir conversão",
  pending_cost_review: "Revisar custo",
  imported: "Importado",
  skipped_duplicate: "Já importado",
  invalid: "Dados inválidos",
  error: "Erro",
};
const money = (n?: number) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function StockBatchReview({
  initial,
  request,
  portalContainer,
  portalZIndex,
}: {
  initial: StockBatchView;
  request: StockRequest;
  portalContainer?: HTMLElement;
  portalZIndex?: number;
}) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request({ ...payload, batchId: view.batchId });
      setView(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao atualizar lote"
      );
    } finally {
      setBusy(false);
    }
  }
  async function importAll() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request({ action: "start", batchId: view.batchId });
      for (let pass = 0; pass <= 500; pass++) {
        const result = await request({ action: "step", batchId: view.batchId });
        setMessage(
          `${result.progress.processedCount} de ${result.progress.totalCount} produtos processados`
        );
        if (result.done) {
          if (result.progress.errorCount)
            setError(
              "Alguns produtos falharam. Confira as linhas antes de tentar novamente"
            );
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
      setView(await request({ action: "status", batchId: view.batchId }));
    } catch (cause) {
      setError(
        `${
          cause instanceof Error ? cause.message : "Falha na importação"
        }. Atualize o lote para conferir o que foi processado antes de tentar novamente.`
      );
    } finally {
      setBusy(false);
    }
  }
  const ready = view.summary.readyToImport || 0;
  const complete =
    ready +
      (view.summary.imported || 0) +
      (view.summary.skippedDuplicate || 0) ===
    view.summary.total;
  return (
    <section
      className="space-y-3 text-sm"
      aria-label="Revisão do lote de estoque"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
            {view.summary.total} produtos
          </span>
          <span className="rounded-full bg-green-50 px-3 py-1.5 text-green-800">
            {ready} {ready === 1 ? "pronto" : "prontos"}
          </span>
          {!complete && (
            <span className="rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-800">
              {view.summary.total -
                ready -
                (view.summary.imported || 0) -
                (view.summary.skippedDuplicate || 0)}{" "}
              {view.summary.total -
                ready -
                (view.summary.imported || 0) -
                (view.summary.skippedDuplicate || 0) ===
              1
                ? "pendente"
                : "pendentes"}
            </span>
          )}
          {!!view.summary.imported && (
            <span className="text-slate-500">
              {view.summary.imported} importados
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {view.url && (
            <a
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
              href={view.url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir lote
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={busy}
            title="Atualizar lote"
            aria-label="Atualizar lote"
            onClick={() => run({ action: "status" })}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
        {view.lines.map((line) => (
          <article
            key={line.id}
            className="overflow-hidden rounded-lg border bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <strong className="text-slate-900">{line.ingredientName}</strong>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  ["ready", "imported", "skipped_duplicate"].includes(
                    line.status
                  )
                    ? "bg-green-50 text-green-800"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {["ready", "imported", "skipped_duplicate"].includes(
                  line.status
                ) ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {labels[line.status] || line.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y bg-slate-50 px-4 py-2.5">
              <p className="text-xs text-slate-500">
                Na nota{" "}
                <strong className="ml-1 text-sm font-semibold tabular-nums text-slate-900">
                  {line.qtyEntry.toLocaleString("pt-BR", {
                    maximumFractionDigits: 6,
                  })}{" "}
                  {line.unitEntry}
                </strong>
                <span className="ml-2">
                  {money(line.costAmount)} / {line.unitEntry}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Total{" "}
                <strong className="ml-1 text-sm tabular-nums text-slate-900">
                  {money(line.costTotalAmount)}
                </strong>
              </p>
            </div>
            <div className="space-y-3 p-4">
              {line.status !== "imported" &&
                line.status !== "skipped_duplicate" && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-500">
                      Produto no estoque
                    </p>
                    <Select
                      value={line.mappedItemId || ""}
                      disabled={busy}
                      onValueChange={(itemId) =>
                        run({ action: "map", lineId: line.id, itemId })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Produto para ${line.ingredientName}`}
                      >
                        <SelectValue placeholder="Vincular produto do estoque" />
                      </SelectTrigger>
                      <SelectContent
                        portalContainer={portalContainer}
                        style={
                          portalZIndex ? { zIndex: portalZIndex } : undefined
                        }
                      >
                        {view.items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {item.unit || "—"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              {line.status === "pending_conversion" && (
                <form
                  className="space-y-2 rounded-md bg-amber-50 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    run({
                      action: "conversion",
                      lineId: line.id,
                      factor: Number(
                        String(data.get("factor")).replace(",", ".")
                      ),
                    });
                  }}
                >
                  <p className="text-xs font-medium text-amber-900">
                    Conversão da nota para o estoque
                  </p>
                  <p className="text-xs text-amber-800">
                    Informe quantos {line.targetUnit} correspondem a 1{" "}
                    {line.unitEntry} da nota.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2">
                      1 {line.unitEntry} ={" "}
                      <Input
                        name="factor"
                        aria-label={`Fator para ${line.ingredientName}`}
                        className="w-28"
                        inputMode="decimal"
                        placeholder="Quantidade"
                        required
                      />{" "}
                      {line.targetUnit}
                    </label>
                    <Button type="submit" variant="outline" disabled={busy}>
                      Salvar conversão
                    </Button>
                  </div>
                </form>
              )}
              {line.status === "pending_cost_review" && (
                <div className="space-y-2">
                  <p>
                    Novo custo: {money(line.convertedCostAmount)} por{" "}
                    {line.targetUnit}. {line.errorMessage}
                  </p>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => run({ action: "approve", lineId: line.id })}
                  >
                    Aprovar novo custo
                  </Button>
                </div>
              )}
              {line.supplierReconciliationStatus === "unmatched" && (
                <Select
                  disabled={busy}
                  onValueChange={(supplierId) =>
                    run({ action: "supplier", lineId: line.id, supplierId })
                  }
                >
                  <SelectTrigger
                    aria-label={`Fornecedor para ${line.ingredientName}`}
                  >
                    <SelectValue placeholder="Vincular fornecedor" />
                  </SelectTrigger>
                  <SelectContent
                    portalContainer={portalContainer}
                    style={portalZIndex ? { zIndex: portalZIndex } : undefined}
                  >
                    {view.suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {line.errorMessage && line.status !== "pending_cost_review" && (
                <p className="text-xs text-slate-500">{line.errorMessage}</p>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {!complete && (
          <p className="max-w-lg text-xs text-slate-500">
            Resolva os vínculos, fornecedores, conversões e revisões antes de
            importar a nota.
          </p>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <p role="status" aria-live="polite">
          {busy ? message || "Processando…" : message}
        </p>
        <Button disabled={busy || !complete || !ready} onClick={importAll}>
          {busy
            ? "Processando…"
            : ready
            ? "Importar nota no estoque"
            : complete
            ? "Nota processada"
            : "Importar nota no estoque"}
        </Button>
      </div>
    </section>
  );
}
