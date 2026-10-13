import { useOutletContext } from "@remix-run/react";
import { AdminImportStockMovementsBatchLinesRoute } from "~/components/admin/import-stock-lines";
import { StockBatchReview } from "~/components/admin/stock-batch-review";
import type { AdminImportStockMovementsBatchOutletContext } from "./admin.import-stock-movements.$batchId";

export default function AdminImportStockMovementsBatchCardsRoute() {
  const context =
    useOutletContext<AdminImportStockMovementsBatchOutletContext>();
  const data = { ...context, batch: context.selectedBatch };
  if (data.batch?.sourceSystem !== "suitable")
    return <AdminImportStockMovementsBatchLinesRoute layout="cards" />;
  return (
    <StockBatchReview
      initial={{
        batchId: data.batch.id,
        summary: data.summary,
        lines: data.lines,
        items: data.items.map((item: any) => ({
          ...item,
          unit: item.consumptionUm || item.purchaseUm,
        })),
        suppliers: data.suppliers || [],
      }}
      request={async (payload) => {
        const response = await fetch("/api/stock/suitable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || !result.ok)
          throw new Error(result.error || "Falha ao atualizar lote");
        return result;
      }}
    />
  );
}
