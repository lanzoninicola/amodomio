import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useOutletContext } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { listStockMovementImportMovements } from "~/domain/stock-movement/stock-movement-import.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import type { AdminItemOutletContext } from "./admin.items.$id";

const WINDOW_DAYS = 30;
const PAGE_SIZE = 100;

function formatDate(value: unknown) {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

function formatMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function movementLifecycleBadgeClass(deletedAt: unknown) {
  return deletedAt
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function buildWindowStart() {
  const from = new Date();
  from.setDate(from.getDate() - WINDOW_DAYS);
  return from;
}

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const itemId = params.id;
    if (!itemId) return badRequest("Item inválido");

    const from = buildWindowStart();
    const result = await listStockMovementImportMovements({
      itemId,
      from,
      status: "all",
      page: 1,
      pageSize: PAGE_SIZE,
    });

    return ok({
      ...result,
      windowDays: WINDOW_DAYS,
      from: from.toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminItemStockMovementsTab() {
  const loaderData = useLoaderData<typeof loader>();
  const { item } = useOutletContext<AdminItemOutletContext>();
  const payload = (loaderData as any)?.payload || {};
  const rows = (payload.rows || []) as any[];
  const summary = payload.summary || { total: 0, active: 0, deleted: 0, uniqueSuppliers: 0 };
  const pagination = payload.pagination || { totalItems: 0 };
  const windowDays = Number(payload.windowDays || WINDOW_DAYS);
  const from = payload.from ? new Date(String(payload.from)) : buildWindowStart();
  const fromLabel = Number.isNaN(from.getTime()) ? `${windowDays} dias` : from.toLocaleDateString("pt-BR");
  const isTruncated = Number(pagination.totalItems || 0) > rows.length;

  return (
    <div className="space-y-4">
      {!item.canStock ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este item está com <span className="font-semibold">Tem estoque</span> desativado na aba Principal. Abaixo
          aparecem apenas movimentações já registradas.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Movimentações", summary.total],
          ["Ativas", summary.active],
          ["Eliminadas", summary.deleted],
          ["Fornecedores", summary.uniqueSuppliers],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-2xl font-semibold text-slate-950">{value as any}</div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Últimos {windowDays} dias</h2>
            <p className="text-sm text-slate-600">
              Movimentações deste item desde {fromLabel}, incluindo registros ativos e eliminados.
            </p>
            <Link
              to={`/admin/stock-movements?itemId=${encodeURIComponent(item.id)}`}
              className="inline-flex text-sm font-medium text-slate-900 underline underline-offset-4 transition hover:text-slate-700"
            >
              Ver todas as movimentações do estoque deste produto
            </Link>
          </div>
          <Link
            to={`/admin/stock-movements?itemId=${encodeURIComponent(item.id)}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Ver listagem completa
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="overflow-auto rounded-xl">
          <Table className="min-w-[1180px]">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-slate-50/80">
                <TableHead className="px-3 py-2 text-xs">Movimentação</TableHead>
                <TableHead className="px-3 py-2 text-xs">Fornecedor / Doc.</TableHead>
                <TableHead className="px-3 py-2 text-xs">Origem</TableHead>
                <TableHead className="px-3 py-2 text-xs">Quantidade</TableHead>
                <TableHead className="px-3 py-2 text-xs">Custo</TableHead>
                <TableHead className="px-3 py-2 text-xs">Lote</TableHead>
                <TableHead className="px-3 py-2 text-xs">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                    Nenhuma movimentação encontrada para este item nos últimos {windowDays} dias.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="border-slate-100 align-top">
                    <TableCell className="px-3 py-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">{formatDate(row.movementAt)}</div>
                      <div className="text-slate-500">aplicado em {formatDate(row.appliedAt)}</div>
                      <div className="text-slate-400">linha {row.Line?.rowNumber ?? "-"}</div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">{row.supplierName || "Sem fornecedor"}</div>
                      <div className="text-slate-500">Doc. {row.invoiceNumber || "-"}</div>
                      <div className="text-slate-400">{row.supplierCnpj || "sem CNPJ"}</div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">{row.Line?.ingredientName || item.name}</div>
                      <div className="text-slate-500">{row.Item?.classification || "-"}</div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs text-slate-700">
                      <div>
                        entrada: {row.Line?.qtyEntry ?? "-"} {row.Line?.unitEntry || ""}
                      </div>
                      <div className="text-slate-500">
                        consumo: {row.Line?.qtyConsumption ?? "-"} {row.Line?.unitConsumption || ""}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs text-slate-700">
                      <div className="font-medium text-slate-900">
                        {formatMoney(row.newCostAtImport)} / {row.newCostUnitAtImport || row.movementUnit || "-"}
                      </div>
                      <div className="text-slate-500">total doc.: {formatMoney(row.Line?.costTotalAmount)}</div>
                      <div className="text-slate-400">
                        antes: {formatMoney(row.lastCostAtImport)} / {row.lastCostUnitAtImport || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs text-slate-700">
                      <Link to={`/admin/import-stock-movements/${row.batchId}`} className="font-medium text-slate-900 hover:underline">
                        {row.Batch?.name || row.batchId}
                      </Link>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-xs">
                      <Badge variant="outline" className={movementLifecycleBadgeClass(row.deletedAt)}>
                        {row.deletedAt ? "eliminada" : "ativa"}
                      </Badge>
                      {row.deletedAt ? <div className="mt-1 text-slate-500">eliminada em {formatDate(row.deletedAt)}</div> : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {isTruncated ? (
          <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            Exibindo as primeiras {rows.length} movimentações do período. Use a listagem completa para refinar filtros.
          </div>
        ) : null}
      </section>
    </div>
  );
}
