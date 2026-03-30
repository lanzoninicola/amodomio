import type { ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ok, serverError } from "~/utils/http-response.server";
import {
  scanItemsForRecalculation,
  recalculateAllItemsCostHistory,
} from "~/domain/item/item-cost-recalculate.server";
import type { ScanResult, BulkRecalculateResult } from "~/domain/item/item-cost-recalculate.server";

// ─── action ───────────────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const _action = String(formData.get("_action") || "");

    if (_action === "scan") {
      const result = await scanItemsForRecalculation();
      return ok({ phase: "scanned", scan: result });
    }

    if (_action === "apply") {
      const raw = String(formData.get("itemIds") || "");
      const itemIds = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (itemIds.length === 0) {
        return ok({ phase: "done", bulk: { results: [], totals: { updated: 0, skipped: 0, errors: 0 } } });
      }

      const bulk = await recalculateAllItemsCostHistory(itemIds);
      return ok({ phase: "done", bulk });
    }

    return ok({ phase: "idle" });
  } catch (err) {
    return serverError(err);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
      {children}
    </p>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${highlight ? "text-amber-600" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

// ─── scan results panel ───────────────────────────────────────────────────────

function ScanPanel({ scan, submitting }: { scan: ScanResult; submitting: boolean }) {
  const itemsWithChanges = scan.items.filter((i) => i.recalculableEntries > 0);
  const itemIds = itemsWithChanges.map((i) => i.itemId).join(",");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Insumos analisados" value={scan.totalItems} />
        <StatBox label="Itens com entradas corrigíveis" value={scan.itemsWithChanges} highlight={scan.itemsWithChanges > 0} />
        <StatBox label="Total de entradas a corrigir" value={scan.totalRecalculable} highlight={scan.totalRecalculable > 0} />
      </div>

      {scan.totalRecalculable === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-emerald-800">Nenhuma entrada precisa de correção.</p>
          <p className="mt-1 text-xs text-emerald-700">
            Todos os registros de custo estão corretamente normalizados com a configuração atual dos itens.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>O que será feito:</strong> para cada entrada identificada, o sistema re-normaliza o custo
            usando a conversão atual do item (<code className="rounded bg-amber-100 px-1 font-mono">ItemPurchaseConversion</code>)
            e atualiza <code className="rounded bg-amber-100 px-1 font-mono">costAmount</code> e{" "}
            <code className="rounded bg-amber-100 px-1 font-mono">unit</code> para a unidade de consumo. O custo
            atual (<code className="rounded bg-amber-100 px-1 font-mono">ItemCostVariation</code>) também é
            sincronizado. Esta operação <strong>modifica dados históricos</strong> — execute apenas se as
            conversões do item estiverem corretas.
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-600">Insumo</th>
                  <th className="px-3 py-2 font-semibold text-slate-600">Unidade consumo</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Entradas (mov.)</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">A corrigir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scan.items.map((item) => (
                  <tr key={item.itemId} className={item.recalculableEntries > 0 ? "bg-amber-50/40" : ""}>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      <a
                        href={`/admin/items/${item.itemId}/costs`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-blue-600"
                      >
                        {item.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {item.consumptionUm ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{item.movementLinkedEntries}</td>
                    <td className="px-3 py-2 text-right">
                      {item.recalculableEntries > 0 ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 font-semibold tabular-nums">
                          {item.recalculableEntries}
                        </Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Form method="post">
            <input type="hidden" name="_action" value="apply" />
            <input type="hidden" name="itemIds" value={itemIds} />
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting
                ? "Aplicando recálculo…"
                : `Aplicar recálculo em ${itemsWithChanges.length} ${itemsWithChanges.length === 1 ? "item" : "itens"}`}
            </Button>
          </Form>
        </>
      )}
    </div>
  );
}

// ─── apply results panel ──────────────────────────────────────────────────────

function ApplyPanel({ bulk }: { bulk: BulkRecalculateResult }) {
  const { totals, results } = bulk;
  const hasChanges = totals.updated > 0;
  const hasErrors = totals.errors > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Entradas atualizadas" value={totals.updated} highlight={totals.updated > 0} />
        <StatBox label="Sem alteração" value={totals.skipped} />
        <StatBox label="Erros" value={totals.errors} highlight={totals.errors > 0} />
      </div>

      {!hasChanges && !hasErrors ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">Nenhuma entrada foi alterada.</p>
          <p className="mt-1 text-xs text-slate-500">
            Os valores já estavam corretamente normalizados com a configuração atual.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results
            .filter((r) => r.updated > 0 || r.errors > 0)
            .map((r) => (
              <div key={r.itemId} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <a
                    href={`/admin/items/${r.itemId}/costs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-slate-800 hover:underline hover:text-blue-600"
                  >
                    {r.name}
                  </a>
                  {r.updated > 0 && (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      {r.updated} atualizada{r.updated !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {r.errors > 0 && (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                      {r.errors} erro{r.errors !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                {r.log.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {r.log.map((line, i) => (
                      <li key={i} className="font-mono text-[11px] text-slate-500">{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

          {results.every((r) => r.updated === 0 && r.errors === 0) && (
            <p className="text-sm text-slate-500">Todos os itens já estavam corretos.</p>
          )}
        </div>
      )}

      <Form method="post">
        <input type="hidden" name="_action" value="scan" />
        <Button type="submit" variant="outline">
          Verificar novamente
        </Button>
      </Form>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function RecalculateCostsPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const payload = (actionData as any)?.payload;
  const phase = payload?.phase ?? "idle";
  const scan: ScanResult | null = payload?.scan ?? null;
  const bulk: BulkRecalculateResult | null = payload?.bulk ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Ferramentas</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Recálculo de custos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Corrige entradas de histórico de custo que foram gravadas com unidade de compra (ex.: CX, KG)
          antes de a configuração de conversão estar completa. O sistema re-normaliza cada entrada para
          a unidade de consumo atual do item usando as conversões definidas em{" "}
          <code className="rounded bg-slate-100 px-1 text-xs font-mono">ItemPurchaseConversion</code>.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Apenas entradas vinculadas a movimentos de estoque (<code className="rounded bg-slate-100 px-1 font-mono">referenceType = "stock-movement"</code>)
          são processadas. Registros manuais e snapshots de ficha de custo não são modificados.
        </p>
      </div>

      {phase === "idle" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 space-y-3">
            <SectionTitle>Como funciona</SectionTitle>
            <ol className="list-decimal pl-4 space-y-1.5 text-sm text-slate-600">
              <li>
                <strong>Verificar</strong> — analisa todos os insumos ativos e identifica entradas cujo
                custo normalizado pela configuração atual difere do valor armazenado.
              </li>
              <li>
                <strong>Revisar</strong> — examine a tabela de itens afetados e confira que as conversões
                ({" "}<code className="rounded bg-slate-100 px-1 text-xs font-mono">ItemPurchaseConversion</code>) estão
                corretas antes de aplicar.
              </li>
              <li>
                <strong>Aplicar</strong> — atualiza os valores de custo e sincroniza o custo atual.
                Somente itens com diferença detectada são processados.
              </li>
            </ol>
          </div>

          <Form method="post">
            <input type="hidden" name="_action" value="scan" />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Verificando…" : "Verificar itens"}
            </Button>
          </Form>
        </div>
      )}

      {phase === "scanned" && scan && (
        <>
          <SectionTitle>Resultado da verificação</SectionTitle>
          <ScanPanel scan={scan} submitting={submitting} />
        </>
      )}

      {phase === "done" && bulk && (
        <>
          <SectionTitle>Resultado do recálculo</SectionTitle>
          <ApplyPanel bulk={bulk} />
        </>
      )}
    </div>
  );
}
