import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { normalizeCounts, getAvailableDoughSizes, getDoughStock, saveDoughStock } from "~/domain/kds/dough-stock.server";
import { defaultSizeCounts, type SizeCounts } from "~/domain/kds";
import { todayLocalYMD, ymdToDateInt, ymdToUtcNoon } from "~/domain/kds";
import { NumericInput } from "~/components/numeric-input/numeric-input";

export const meta: MetaFunction = () => [{ title: "KDS | Estoque de Massa" }];

type LoaderData = {
  dateStr: string;
  sizes: Awaited<ReturnType<typeof getAvailableDoughSizes>>;
  stock: SizeCounts | null;
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

  const baseCounts = normalizeCounts({
    F: form.get("stockF"),
    M: form.get("stockM"),
    P: form.get("stockP"),
    I: form.get("stockI"),
    FT: form.get("stockFT"),
  } as any);

  const counts = intent === "reset" ? defaultSizeCounts() : baseCounts;

  await saveDoughStock(dateInt, ymdToUtcNoon(dateStr), counts);

  return json({ ok: true, stock: counts });
}

export default function EstoqueMassaPage() {
  const { dateStr, sizes, stock } = useLoaderData<typeof loader>();
  const fx = useFetcher<{ ok: boolean; stock: SizeCounts }>();

  const [draft, setDraft] = useState<SizeCounts>(stock ?? defaultSizeCounts());

  useEffect(() => {
    setDraft(stock ?? defaultSizeCounts());
  }, [stock, dateStr]);

  useEffect(() => {
    if (fx.data?.ok && fx.data.stock) {
      setDraft(fx.data.stock);
    }
  }, [fx.data]);

  const inputs = useMemo(() => sizes.map((s) => s.key), [sizes]);

  function onChange(key: keyof SizeCounts, value: string) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    setDraft((prev) => ({ ...prev, [key]: safe }));
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="space-y-1">
        <div className="text-xs text-slate-500">Data</div>
        <div className="text-lg font-semibold">{dateStr}</div>
        <p className="text-sm text-slate-600">Informe o total de discos prontos por tamanho assim que finalizar o boleamento. Essa tela foi pensada para o operador no celular.</p>
      </header>

      <fx.Form method="post" className="space-y-3">
        <input type="hidden" name="date" value={dateStr} />

        <div className="grid grid-cols-2 gap-3">
          {inputs.map((k) => {
            const size = sizes.find((s) => s.key === k)!;
            return (
              <label key={k} className="flex flex-col gap-2 rounded-lg border p-3 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{size.label}</span>
                  <span className="text-xs text-slate-500">{size.abbr || size.key}</span>
                </div>
                <NumericInput
                  name={`stock${k}`}
                  value={draft[k]}
                  onChange={(e) => onChange(k, e.target.value)}
                  inputMode="numeric"
                  className="h-12 text-center text-xl font-mono"
                />
              </label>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="submit"
            name="_action"
            value="save"
            disabled={fx.state !== "idle"}
            className="w-full text-base h-11"
          >
            {fx.state !== "idle" && fx.formData?.get("_action") === "save" ? "Salvando…" : "Salvar estoque"}
          </Button>

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
        </div>

        {fx.data?.ok && (
          <div className="text-sm text-emerald-700 text-center">Estoque atualizado.</div>
        )}
      </fx.Form>

      <Separator />

      <section className="space-y-2">
        <div className="text-sm font-semibold">Dica</div>
        <p className="text-sm text-slate-600">Você pode ajustar os valores a qualquer momento; a barra flutuante no grid do atendimento usa esses números para avisar o time.</p>
      </section>
    </div>
  );
}
