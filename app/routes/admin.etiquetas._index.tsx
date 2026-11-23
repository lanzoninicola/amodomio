import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Search, Printer, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createFoodLabel, getLabelingSettings, listLabelingItems, listRecentFoodLabels, markFoodLabelPrint } from "~/domain/labeling/labeling.server";
import { authenticator } from "~/domain/auth/google.server";
import { buildEscPosFoodLabel, shelfLifeLabel, type FoodLabelRecord } from "../../shared/labeling/food-label";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw new Response("Não autorizado", { status: 401 });
  const [items, labels, settings] = await Promise.all([listLabelingItems(), listRecentFoodLabels(), getLabelingSettings()]);
  return json({ items, labels, settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (!user) throw new Response("Não autorizado", { status: 401 });
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent === "create") {
    const label = await createFoodLabel({ itemId: String(form.get("itemId") || ""), copies: Number(form.get("copies")) || 1,
      operatorUserId: String((user as any).id || "") || null, operatorName: String((user as any).name || (user as any).email || "") || null });
    return json({ intent, label, settings: await getLabelingSettings() });
  }
  if (intent === "print-result") {
    const label = await markFoodLabelPrint(String(form.get("id") || ""), form.get("printed") === "true", String(form.get("error") || ""));
    return json({ intent, label });
  }
  return json({ message: "Ação inválida." }, { status: 400 });
}

async function printWithQz(label: FoodLabelRecord, settings: Awaited<ReturnType<typeof getLabelingSettings>>) {
  const qz = (await import("qz-tray")).default as any;
  if (!qz.websocket.isActive()) {
    const options = settings.qzHost && settings.qzHost !== "localhost" ? { host: settings.qzHost } : undefined;
    await qz.websocket.connect(options);
  }
  const printer = await qz.printers.find(settings.printerName);
  const config = qz.configs.create(printer, { encoding: "Cp850" });
  const data = buildEscPosFoodLabel(label, settings);
  for (let copy = 0; copy < label.copies; copy += 1) await qz.print(config, data);
}

export default function LabelsPage() {
  const { items, labels: initialLabels, settings } = useLoaderData<typeof loader>();
  const create = useFetcher<typeof action>();
  const result = useFetcher<typeof action>();
  const [query, setQuery] = useState("");
  const [copies, setCopies] = useState(1);
  const [message, setMessage] = useState("");
  const [labels, setLabels] = useState(initialLabels);
  const filtered = useMemo(() => items.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [items, query]);

  useEffect(() => {
    const payload = create.data as any;
    if (create.state !== "idle" || payload?.intent !== "create" || !payload.label) return;
    const label = payload.label as FoodLabelRecord;
    setLabels((current) => [label as any, ...current.filter((row) => row.id !== label.id)]);
    setMessage("Enviando para a Tanca TP-620...");
    void printWithQz(label, payload.settings || settings).then(() => {
      setMessage("Etiqueta impressa.");
      result.submit({ intent: "print-result", id: label.id, printed: "true" }, { method: "post" });
    }).catch((error) => {
      const text = error instanceof Error ? error.message : String(error);
      setMessage(`Não foi possível imprimir: ${text}`);
      result.submit({ intent: "print-result", id: label.id, printed: "false", error: text }, { method: "post" });
    });
  }, [create.state, create.data]);

  return <div className="space-y-6 p-4 md:p-6">
    <div><h1 className="text-2xl font-bold">Etiquetas de manipulação</h1><p className="text-muted-foreground">Escolha um item e imprima pela {settings.printerName}.</p></div>
    <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
      <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><Input className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar item" /></div>
      <div className="flex items-center gap-2"><Button variant="outline" onClick={() => setCopies(Math.max(1, copies - 1))}>−</Button><span className="min-w-20 text-center font-semibold">{copies} via{copies > 1 ? "s" : ""}</span><Button variant="outline" onClick={() => setCopies(Math.min(20, copies + 1))}>+</Button></div>
    </div>
    {message ? <div className="rounded-lg bg-slate-900 px-4 py-3 text-white">{message}</div> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((item) => <button key={item.id} disabled={create.state !== "idle"} onClick={() => create.submit({ intent: "create", itemId: item.id, copies: String(copies) }, { method: "post" })}
        className="min-h-32 rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-slate-900 disabled:opacity-50">
        <div className="flex justify-between gap-3"><strong className="text-lg">{item.LabelingConfig?.labelName || item.name}</strong><Printer className="h-6 w-6"/></div>
        <p className="mt-3 text-sm text-muted-foreground">Validade: {shelfLifeLabel(item.LabelingConfig!.shelfLifeMinutes)}</p>
        <p className="text-sm text-muted-foreground">{item.LabelingConfig?.conservation}</p>
      </button>)}
    </div>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Últimas etiquetas</h2>{labels.slice(0, 10).map((label) => <div key={label.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3"><div><strong>{label.itemName}</strong><p className="text-xs text-muted-foreground">{new Date(label.manipulatedAt).toLocaleString("pt-BR")}</p></div><span className="text-sm">{label.printStatus === "printed" ? "Impressa" : label.printStatus === "failed" ? "Falhou" : "Enviando"}</span></div>)}</section>
  </div>;
}
