import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { normalizeCounts, getAvailableDoughSizes, getDoughStock, saveDoughStock, type DoughStockSnapshot } from "~/domain/kds/dough-stock.server";
import { defaultSizeCounts, type SizeCounts } from "~/domain/kds";
import { todayLocalYMD, ymdToDateInt, ymdToUtcNoon } from "~/domain/kds";
import { NumericInput } from "~/components/numeric-input/numeric-input";

export const meta: MetaFunction = () => [{ title: "KDS | Estoque de Massa" }];

type LoaderData = {
  dateStr: string;
  sizes: Awaited<ReturnType<typeof getAvailableDoughSizes>>;
  stock: DoughStockSnapshot | null;
};

export async function loader({ params }: LoaderFunctionArgs) {
  const dateStr = params.date ?? todayLocalYMD();
  const dateInt = ymdToDateInt(dateStr);

  const [sizes, stock] = await Promise.all([
    getAvailableDoughSizes(),
    getDoughStock(dateInt),
  ]);

  return json<LoaderData>({ dateStr, sizes, stock });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const form = await request.formData();
  const dateStr = String(form.get("date") ?? params.date ?? todayLocalYMD());
  const dateInt = ymdToDateInt(dateStr);
  const intent = String(form.get("_action") || "save");

  const manualCounts = normalizeCounts({
    F: form.get("adjustF"),
    M: form.get("adjustM"),
    P: form.get("adjustP"),
    I: form.get("adjustI"),
    FT: form.get("adjustFT"),
  } as any);

  const counts = intent === "reset" ? defaultSizeCounts() : manualCounts;
  const adjustment = counts; // saldo manual define o estoque atual

  const snapshot = await saveDoughStock(dateInt, ymdToUtcNoon(dateStr), counts, adjustment);

  return json({ ok: true, stock: snapshot });
}

export default function EstoqueMassaPage() {
  const { dateStr, sizes, stock } = useLoaderData<typeof loader>();
  const fx = useFetcher<{ ok: boolean; stock: DoughStockSnapshot }>();
  const navigate = useNavigate();

  const [draftManual, setDraftManual] = useState<SizeCounts>(stock?.effective ?? stock?.base ?? defaultSizeCounts());

  useEffect(() => {
    setDraftManual(stock?.effective ?? stock?.base ?? defaultSizeCounts());
  }, [stock, dateStr]);

  useEffect(() => {
    if (fx.data?.ok && fx.data.stock) {
      setDraftManual(fx.data.stock.effective);
    }
  }, [fx.data]);

  const inputs = useMemo(() => sizes.map((s) => s.key), [sizes]);

  function onChangeManual(key: keyof SizeCounts, value: string) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    setDraftManual((prev) => ({ ...prev, [key]: safe }));
  }

  const effective = useMemo<SizeCounts>(() => ({ ...draftManual }), [draftManual]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 mt-6">
      <header className="space-y-2">
        <div className="text-xs text-slate-500">Data</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-lg font-semibold">{dateStr}</div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Selecionar dia</span>
            <input
              type="date"
              value={dateStr}
              onChange={(event) => {
                const nextDate = event.target.value;
                if (nextDate) {
                  navigate(`/admin/kds/atendimento/${nextDate}/estoque-massa`);
                }
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
            />
          </label>
        </div>
      </header>

      <fx.Form method="post" className="space-y-4 ">
        <input type="hidden" name="date" value={dateStr} />

        <div className="flex flex-col gap-4">
          <section className="space-y-2">
            <div className="flex flex-col gap-0.5">
              <div className="text-sm font-semibold">Saldo manual</div>
              <p className="text-sm text-slate-600">Defina o saldo atual. Use quando o número real de discos mudar (perdas, queima, doações, etc.).</p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3">
              {inputs.map((k) => {
                const size = sizes.find((s) => s.key === k)!;
                return (
                  <label key={k} className="flex flex-col gap-2 rounded-lg border-0 p-0 sm:border sm:p-3 bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{size.label}</span>
                      <span className="text-xs text-slate-500">{size.abbr || size.key}</span>
                    </div>
                    <NumericInput
                      name={`adjust${k}`}
                      value={draftManual[k]}
                      onChange={(e) => onChangeManual(k, e.target.value)}
                      inputMode="numeric"
                      className="h-12 text-center text-2xl font-mono"
                    />
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Saldo atual (manual)</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {inputs.map((k) => {
              const size = sizes.find((s) => s.key === k)!;
              return (
                <span key={k} className="rounded-full bg-white border px-3 py-1 text-sm font-semibold">
                  {size.abbr || size.key}: {effective[k]}
                </span>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="submit"
            name="_action"
            value="reset"
            variant="destructive"
            disabled={fx.state !== "idle"}
            className="w-full text-base h-11"
          >
            {fx.state !== "idle" && fx.formData?.get("_action") === "reset" ? "Zerando…" : "Zerar estoque"}
          </Button>

          <Button
            type="submit"
            name="_action"
            value="save"
            disabled={fx.state !== "idle"}
            className="w-full text-base h-11"
          >
            {fx.state !== "idle" && fx.formData?.get("_action") === "save" ? "Salvando…" : "Salvar estoque"}
          </Button>
        </div>

        {fx.data?.ok && (
          <div className="text-sm text-emerald-700 text-center">Estoque atualizado.</div>
        )}
      </fx.Form>

      <Separator />

      <section className="space-y-2">
        <div className="text-sm font-semibold">Dica</div>
        <p className="text-sm text-slate-600">Atualize o saldo sempre que houver perda, queima ou reposicao; o grid do atendimento usa esses numeros para avisar o time.</p>
      </section>
    </div>
  );
}
