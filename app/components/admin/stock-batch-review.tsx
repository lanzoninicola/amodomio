import { useState } from "react";
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
}: {
  initial: StockBatchView;
  request: StockRequest;
  portalContainer?: HTMLElement;
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
      <div className="flex flex-wrap items-center gap-3">
        <strong>
          {view.summary.total} produtos · {ready} prontos ·{" "}
          {view.summary.imported || 0} importados
        </strong>
        {view.url && (
          <a
            className="underline"
            href={view.url}
            target="_blank"
            rel="noreferrer"
          >
            Abrir lote
          </a>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run({ action: "status" })}
        >
          Atualizar lote
        </Button>
      </div>
      <div className="max-h-[50vh] space-y-3 overflow-auto">
        {view.lines.map((line) => (
          <article key={line.id} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{line.ingredientName}</strong>
              <span>{labels[line.status] || line.status}</span>
            </div>
            <p>
              {line.qtyEntry} {line.unitEntry} · {money(line.costAmount)} por
              unidade · Total {money(line.costTotalAmount)}
            </p>
            {line.status !== "imported" &&
              line.status !== "skipped_duplicate" && (
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
                  <SelectContent portalContainer={portalContainer}>
                    {view.items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.unit || "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            {line.status === "pending_conversion" && (
              <form
                className="flex flex-wrap items-center gap-2"
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
                <label className="flex items-center gap-2">
                  1 {line.unitEntry} ={" "}
                  <Input
                    name="factor"
                    aria-label={`Fator para ${line.ingredientName}`}
                    className="w-28"
                    inputMode="decimal"
                    required
                  />{" "}
                  {line.targetUnit}
                </label>
                <Button type="submit" variant="outline" disabled={busy}>
                  Salvar conversão
                </Button>
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
                <SelectContent portalContainer={portalContainer}>
                  {view.suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {line.errorMessage && line.status !== "pending_cost_review" && (
              <p className="text-red-700">{line.errorMessage}</p>
            )}
          </article>
        ))}
      </div>
      {!complete && (
        <p>
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
    </section>
  );
}
