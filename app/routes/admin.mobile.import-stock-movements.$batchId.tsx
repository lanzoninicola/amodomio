import type { MetaFunction } from "@remix-run/node";
import {
  Form,
  Link,
  Outlet,
  useLoaderData,
  useNavigation,
  useOutlet,
} from "@remix-run/react";
import { RotateCcw } from "lucide-react";
import {
  ImportStockLinesPanel,
  type ImportStockLinesContext,
} from "~/components/admin/import-stock-lines";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  formatDate,
  statusBadgeClass,
  summaryFromAny,
} from "./admin.import-stock-movements.$batchId";

export { action, loader } from "./admin.import-stock-movements.$batchId";

export const meta: MetaFunction = () => [
  { title: "Admin Mobile | Lote de estoque" },
];

export default function AdminMobileImportStockMovementsBatchRoute() {
  const loaderData = useLoaderData<any>();
  const navigation = useNavigation();
  const outlet = useOutlet();
  const payload = loaderData?.payload || {};
  const selected = payload.selected as any;
  const selectedBatch = selected?.batch || null;
  const lines = (selected?.lines || []) as any[];
  const items = (selected?.items || []) as any[];
  const appliedChanges = (selected?.appliedChanges || []) as any[];
  const unitOptions = (payload.unitOptions || []) as string[];
  const itemUnitOptionsByItemId = (payload.itemUnitOptionsByItemId ||
    {}) as Record<string, string[]>;
  const measurementConversions = (payload.measurementConversions ||
    []) as Array<{
    fromUnit: string;
    toUnit: string;
    factor: number;
  }>;
  const categories = (payload.categories || []) as Array<{
    id: string;
    name: string;
  }>;
  const suppliers = (payload.suppliers || []) as any[];
  const itemCostHints = (payload.itemCostHints || {}) as Record<
    string,
    { lastCostPerUnit: number | null; avgCostPerUnit: number | null }
  >;
  const summary = summaryFromAny(selected?.summary || selectedBatch?.summary);
  const isImportingBatch =
    String(selectedBatch?.importStatus || "idle") === "importing" ||
    (navigation.state === "submitting" &&
      String(navigation.formData?.get("_action") || "") === "batch-import" &&
      String(navigation.formData?.get("batchId") || "") ===
        String(selectedBatch?.id || ""));

  if (!selectedBatch) return null;
  if (outlet) return <Outlet />;

  const context: ImportStockLinesContext = {
    selected,
    selectedBatch,
    lines,
    items,
    appliedChanges,
    unitOptions,
    itemUnitOptionsByItemId,
    measurementConversions,
    suppliers,
    categories,
    itemCostHints,
    summary,
    isImportingBatch,
  };

  return (
    <div className="space-y-4 pb-6">
      <section className="space-y-3 rounded-lg bg-white px-3 py-3 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold text-slate-950">
                  {selectedBatch.name}
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    statusBadgeClass(String(selectedBatch.status))
                  )}
                >
                  {selectedBatch.status}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">
                {selectedBatch.originalFileName || "sem arquivo"} •{" "}
                {selectedBatch.createdAt
                  ? formatDate(selectedBatch.createdAt)
                  : "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            ["Total", summary.total],
            ["Prontas", summary.readyToImport],
            [
              "Pend.",
              summary.pendingMapping +
                summary.pendingConversion +
                summary.pendingSupplier +
                summary.pendingCostReview,
            ],
            ["Erros", summary.error + summary.invalid],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg bg-slate-50 px-2 py-2"
            >
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {label}
              </div>
              <div className="mt-1 text-lg font-semibold leading-none text-slate-950">
                {value as any}
              </div>
            </div>
          ))}
        </div>

        {summary.pendingSupplier > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Faltam {summary.pendingSupplier} registro(s) para conciliar com o
            fornecedor.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-xl border-amber-200 bg-amber-50 text-sm text-amber-900 hover:bg-amber-100"
          >
            <Link
              to={`/admin/mobile/import-stock-movements/${selectedBatch.id}/supplier-reconciliation`}
            >
              Fornecedor
            </Link>
          </Button>
          <Form method="post">
            <input type="hidden" name="_action" value="batch-rollback" />
            <input type="hidden" name="batchId" value={selectedBatch.id} />
            <Button
              type="submit"
              variant="outline"
              className="h-11 w-full rounded-xl text-sm"
              disabled={appliedChanges.length <= 0 || isImportingBatch}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Desfazer
            </Button>
          </Form>
        </div>
      </section>

      <ImportStockLinesPanel context={context} layout="cards" mobile />
    </div>
  );
}
