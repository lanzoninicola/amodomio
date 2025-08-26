import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, defer } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Await } from "@remix-run/react";
import * as React from "react";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import prismaClient from "~/lib/prisma/client.server";

// -------------------------------
// Types
// -------------------------------

type FinancialSummary = {
  id: string;
  isSnapshot: boolean;
  description: string | null;
  receitaBrutaAmount: number;
  receitaLiquidaAmount: number;
  custoFixoAmount: number;
  custoFixoPerc: number; // calculado e persistido
  custoVariavelAmount: number;
  custoVariavelPerc: number; // calculado e persistido
  pontoEquilibrioAmount: number; // calculado e persistido
  receitaBrutaDia01Perc: number; // qua
  receitaBrutaDia02Perc: number; // qui
  receitaBrutaDia03Perc: number; // sex
  receitaBrutaDia04Perc: number; // sab
  receitaBrutaDia05Perc: number; // dom
  ticketMedio: number;
  createdAt: string;
  updatedAt: string;
};

// -------------------------------
// Loader (com streaming via defer)
// -------------------------------

export async function loader({ request }: LoaderFunctionArgs) {
  const currentPromise = await prismaClient.financialSummary.findFirst({
    where: { isSnapshot: false },
    orderBy: { createdAt: "desc" },
  });

  const snapshotsPromise = await prismaClient.financialSummary.findMany({
    where: { isSnapshot: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return defer({ current: currentPromise, snapshots: snapshotsPromise });
}

// -------------------------------
// Action
// -------------------------------

type ActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");

  const num = (k: string, def = 0) => {
    const v = form.get(k);
    if (v == null || v === "") return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  try {
    if (intent === "deleteSnapshot") {
      const id = String(form.get("snapshotId"));
      await prismaClient.financialSummary.delete({ where: { id } });
      return json({ ok: true, message: "Snapshot removido." } satisfies ActionData);
    }

    const receitaBase = String(form.get("receitaBase") || "LIQUIDA");
    const receitaBrutaAmount = num("receitaBrutaAmount");
    const receitaLiquidaAmount = num("receitaLiquidaAmount");
    const custoFixoAmount = num("custoFixoAmount");
    const custoVariavelAmount = num("custoVariavelAmount");
    const ticketMedio = num("ticketMedio");

    const receitaBaseValor = receitaBase === "LIQUIDA" ? receitaLiquidaAmount : receitaBrutaAmount;
    const custoFixoPerc = receitaBaseValor > 0 ? custoFixoAmount / receitaBaseValor : 0;
    const custoVariavelPerc = receitaBaseValor > 0 ? custoVariavelAmount / receitaBaseValor : 0;
    const pontoEquilibrioAmount = 1 - custoVariavelPerc !== 0
      ? custoFixoAmount / (1 - custoVariavelPerc)
      : 0;

    const receitaBrutaDia01Perc = num("receitaBrutaDia01Perc");
    const receitaBrutaDia02Perc = num("receitaBrutaDia02Perc");
    const receitaBrutaDia03Perc = num("receitaBrutaDia03Perc");
    const receitaBrutaDia04Perc = num("receitaBrutaDia04Perc");
    const receitaBrutaDia05Perc = num("receitaBrutaDia05Perc");

    const baseData = {
      receitaBrutaAmount,
      receitaLiquidaAmount,
      custoFixoAmount,
      custoFixoPerc,
      custoVariavelAmount,
      custoVariavelPerc,
      pontoEquilibrioAmount,
      receitaBrutaDia01Perc,
      receitaBrutaDia02Perc,
      receitaBrutaDia03Perc,
      receitaBrutaDia04Perc,
      receitaBrutaDia05Perc,
      ticketMedio,
    } as const;

    if (intent === "save") {
      const existing = await prismaClient.financialSummary.findFirst({
        where: { isSnapshot: false },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        await prismaClient.financialSummary.update({
          where: { id: existing.id },
          data: { ...baseData, isSnapshot: false },
        });
      } else {
        await prismaClient.financialSummary.create({
          data: { ...baseData, isSnapshot: false, description: null },
        });
      }
      return json({ ok: true, message: "Resumo salvo." } satisfies ActionData);
    }

    if (intent === "snapshot") {
      const description = String(form.get("description") || "Snapshot");
      await prismaClient.financialSummary.create({
        data: { ...baseData, isSnapshot: true, description },
      });
      return json({ ok: true, message: "Snapshot criado." } satisfies ActionData);
    }

    return json({ ok: false, message: "Intent desconhecido." } satisfies ActionData, { status: 400 });
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: "Erro ao processar a ação." } satisfies ActionData, { status: 500 });
  }
}

// -------------------------------
// Client Page (com React.Suspense + <Await>)
// -------------------------------

export default function AdminFinanceiroResumoFinanceiro() {
  const data = useLoaderData<typeof loader>();
  const action = useActionData<ActionData>();
  const nav = useNavigation();

  const [receitaBase, setReceitaBase] = React.useState<"LIQUIDA" | "BRUTA">("LIQUIDA");

  // Estado local; será hidratado quando 'current' resolver
  const [state, setState] = React.useState(() => ({
    receitaBrutaAmount: 0,
    receitaLiquidaAmount: 0,
    custoFixoAmount: 0,
    custoVariavelAmount: 0,
    receitaBrutaDia01Perc: 0.18,
    receitaBrutaDia02Perc: 0.19,
    receitaBrutaDia03Perc: 0.21,
    receitaBrutaDia04Perc: 0.22,
    receitaBrutaDia05Perc: 0.20,
    ticketMedio: 0,
    description: "",
  }));

  const receitaBaseValor = receitaBase === "LIQUIDA" ? state.receitaLiquidaAmount : state.receitaBrutaAmount;
  const custoFixoPerc = receitaBaseValor > 0 ? state.custoFixoAmount / receitaBaseValor : 0;
  const custoVariavelPerc = receitaBaseValor > 0 ? state.custoVariavelAmount / receitaBaseValor : 0;
  const pontoEquilibrioAmount = 1 - custoVariavelPerc !== 0 ? state.custoFixoAmount / (1 - custoVariavelPerc) : 0;

  const somaPercDias = (
    state.receitaBrutaDia01Perc +
    state.receitaBrutaDia02Perc +
    state.receitaBrutaDia03Perc +
    state.receitaBrutaDia04Perc +
    state.receitaBrutaDia05Perc
  );

  const saving = nav.state !== "idle";

  const onNum = (k: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value.replace(",", "."));
    setState(s => ({ ...s, [k]: Number.isFinite(v) ? v : 0 }));
  };

  const onPerc = (k: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value.replace(",", "."));
    setState(s => ({ ...s, [k]: Number.isFinite(v) ? v : 0 }));
  };

  return (
    <div className="container mx-auto max-w-6xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Resumo Financeiro</h1>
        {saving && (
          <Badge variant="secondary" className="gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</Badge>
        )}
      </div>

      {action && (
        <Alert variant={action.ok ? "default" : "destructive"}>
          <AlertTitle>{action.ok ? "Sucesso" : "Erro"}</AlertTitle>
          <AlertDescription>{action.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Base & Totais</CardTitle>
        </CardHeader>
        <React.Suspense fallback={<CardContent><div className="text-sm opacity-70">Carregando resumo atual...</div></CardContent>}>
          <Await resolve={data.current}>
            {(current: Partial<FinancialSummary> | null) => {
              React.useEffect(() => {
                if (current) {
                  setState((s) => ({
                    ...s,
                    receitaBrutaAmount: current.receitaBrutaAmount ?? s.receitaBrutaAmount,
                    receitaLiquidaAmount: current.receitaLiquidaAmount ?? s.receitaLiquidaAmount,
                    custoFixoAmount: current.custoFixoAmount ?? s.custoFixoAmount,
                    custoVariavelAmount: current.custoVariavelAmount ?? s.custoVariavelAmount,
                    receitaBrutaDia01Perc: current.receitaBrutaDia01Perc ?? s.receitaBrutaDia01Perc,
                    receitaBrutaDia02Perc: current.receitaBrutaDia02Perc ?? s.receitaBrutaDia02Perc,
                    receitaBrutaDia03Perc: current.receitaBrutaDia03Perc ?? s.receitaBrutaDia03Perc,
                    receitaBrutaDia04Perc: current.receitaBrutaDia04Perc ?? s.receitaBrutaDia04Perc,
                    receitaBrutaDia05Perc: current.receitaBrutaDia05Perc ?? s.receitaBrutaDia05Perc,
                    ticketMedio: current.ticketMedio ?? s.ticketMedio,
                  }));
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [current?.id]);

              return (
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Base para % dos custos</Label>
                    <Select value={receitaBase} onValueChange={(v) => setReceitaBase(v as any)} name="receitaBase">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a base" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LIQUIDA">Receita Líquida</SelectItem>
                        <SelectItem value="BRUTA">Receita Bruta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ticketMedio">Ticket médio (R$)</Label>
                    <Input id="ticketMedio" name="ticketMedio" inputMode="decimal" value={state.ticketMedio}
                      onChange={onNum("ticketMedio")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receitaBrutaAmount">Receita Bruta (mês)</Label>
                    <Input id="receitaBrutaAmount" name="receitaBrutaAmount" inputMode="decimal" value={state.receitaBrutaAmount}
                      onChange={onNum("receitaBrutaAmount")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receitaLiquidaAmount">Receita Líquida (mês)</Label>
                    <Input id="receitaLiquidaAmount" name="receitaLiquidaAmount" inputMode="decimal" value={state.receitaLiquidaAmount}
                      onChange={onNum("receitaLiquidaAmount")} />
                  </div>

                  <Separator className="col-span-full" />

                  <div className="space-y-2">
                    <Label htmlFor="custoFixoAmount">Custo Fixo (R$)</Label>
                    <Input id="custoFixoAmount" name="custoFixoAmount" inputMode="decimal" value={state.custoFixoAmount}
                      onChange={onNum("custoFixoAmount")} />
                  </div>
                  <div className="space-y-2">
                    <Label>CF% (auto)</Label>
                    <Input readOnly value={(custoFixoPerc * 100).toFixed(2) + "%"} />
                    <input type="hidden" name="custoFixoPerc" value={custoFixoPerc} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custoVariavelAmount">Custo Variável (R$)</Label>
                    <Input id="custoVariavelAmount" name="custoVariavelAmount" inputMode="decimal" value={state.custoVariavelAmount}
                      onChange={onNum("custoVariavelAmount")} />
                  </div>
                  <div className="space-y-2">
                    <Label>CV% (auto)</Label>
                    <Input readOnly value={(custoVariavelPerc * 100).toFixed(2) + "%"} />
                    <input type="hidden" name="custoVariavelPerc" value={custoVariavelPerc} />
                  </div>

                  <div className="space-y-2">
                    <Label>Ponto de equilíbrio (auto)</Label>
                    <Input readOnly value={pontoEquilibrioAmount.toFixed(2)} />
                    <input type="hidden" name="pontoEquilibrioAmount" value={pontoEquilibrioAmount} />
                  </div>
                </CardContent>
              );
            }}
          </Await>
        </React.Suspense>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>% Receita Bruta por dia (somar 100%)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Quarta (%)</Label>
            <Input name="receitaBrutaDia01Perc" inputMode="decimal"
              value={(state.receitaBrutaDia01Perc * 100).toString()}
              onChange={(e) => onPerc("receitaBrutaDia01Perc")({
                ...e,
                target: { ...e.target, value: String(Number(e.target.value.replace(",", ".")) / 100) },
              } as any)} />
          </div>
          <div className="space-y-2">
            <Label>Quinta (%)</Label>
            <Input name="receitaBrutaDia02Perc" inputMode="decimal"
              value={(state.receitaBrutaDia02Perc * 100).toString()}
              onChange={(e) => onPerc("receitaBrutaDia02Perc")({
                ...e,
                target: { ...e.target, value: String(Number(e.target.value.replace(",", ".")) / 100) },
              } as any)} />
          </div>
          <div className="space-y-2">
            <Label>Sexta (%)</Label>
            <Input name="receitaBrutaDia03Perc" inputMode="decimal"
              value={(state.receitaBrutaDia03Perc * 100).toString()}
              onChange={(e) => onPerc("receitaBrutaDia03Perc")({
                ...e,
                target: { ...e.target, value: String(Number(e.target.value.replace(",", ".")) / 100) },
              } as any)} />
          </div>
          <div className="space-y-2">
            <Label>Sábado (%)</Label>
            <Input name="receitaBrutaDia04Perc" inputMode="decimal"
              value={(state.receitaBrutaDia04Perc * 100).toString()}
              onChange={(e) => onPerc("receitaBrutaDia04Perc")({
                ...e,
                target: { ...e.target, value: String(Number(e.target.value.replace(",", ".")) / 100) },
              } as any)} />
          </div>
          <div className="space-y-2">
            <Label>Domingo (%)</Label>
            <Input name="receitaBrutaDia05Perc" inputMode="decimal"
              value={(state.receitaBrutaDia05Perc * 100).toString()}
              onChange={(e) => onPerc("receitaBrutaDia05Perc")({
                ...e,
                target: { ...e.target, value: String(Number(e.target.value.replace(",", ".")) / 100) },
              } as any)} />
          </div>
          <div className="col-span-full">
            <Alert variant={Math.abs(somaPercDias - 1) < 0.001 ? "default" : "destructive"}>
              <AlertTitle>Soma atual: {(somaPercDias * 100).toFixed(2)}%</AlertTitle>
              <AlertDescription>
                {Math.abs(somaPercDias - 1) < 0.001
                  ? "Perfeito: soma = 100%."
                  : "Ajuste os percentuais para totalizar 100%."}
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Salvar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Salvar como válido</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="save" />
              <input type="hidden" name="receitaBase" value={receitaBase} />
              <input type="hidden" name="receitaBrutaAmount" value={state.receitaBrutaAmount} />
              <input type="hidden" name="receitaLiquidaAmount" value={state.receitaLiquidaAmount} />
              <input type="hidden" name="custoFixoAmount" value={state.custoFixoAmount} />
              <input type="hidden" name="custoVariavelAmount" value={state.custoVariavelAmount} />
              <input type="hidden" name="receitaBrutaDia01Perc" value={state.receitaBrutaDia01Perc} />
              <input type="hidden" name="receitaBrutaDia02Perc" value={state.receitaBrutaDia02Perc} />
              <input type="hidden" name="receitaBrutaDia03Perc" value={state.receitaBrutaDia03Perc} />
              <input type="hidden" name="receitaBrutaDia04Perc" value={state.receitaBrutaDia04Perc} />
              <input type="hidden" name="receitaBrutaDia05Perc" value={state.receitaBrutaDia05Perc} />
              <input type="hidden" name="ticketMedio" value={state.ticketMedio} />

              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando</> : "Salvar"}
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>Criar snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="snapshot" />
              <input type="hidden" name="receitaBase" value={receitaBase} />
              <input type="hidden" name="receitaBrutaAmount" value={state.receitaBrutaAmount} />
              <input type="hidden" name="receitaLiquidaAmount" value={state.receitaLiquidaAmount} />
              <input type="hidden" name="custoFixoAmount" value={state.custoFixoAmount} />
              <input type="hidden" name="custoVariavelAmount" value={state.custoVariavelAmount} />
              <input type="hidden" name="receitaBrutaDia01Perc" value={state.receitaBrutaDia01Perc} />
              <input type="hidden" name="receitaBrutaDia02Perc" value={state.receitaBrutaDia02Perc} />
              <input type="hidden" name="receitaBrutaDia03Perc" value={state.receitaBrutaDia03Perc} />
              <input type="hidden" name="receitaBrutaDia04Perc" value={state.receitaBrutaDia04Perc} />
              <input type="hidden" name="receitaBrutaDia05Perc" value={state.receitaBrutaDia05Perc} />
              <input type="hidden" name="ticketMedio" value={state.ticketMedio} />

              <div className="space-y-2">
                <Label>Descrição do snapshot</Label>
                <Textarea name="description" placeholder="Ex.: Fechamento agosto com reajuste do queijo" />
              </div>

              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando</> : "Criar snapshot"}
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Lista de snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
        </CardHeader>
        <React.Suspense fallback={<CardContent><div className="text-sm opacity-70">Carregando snapshots...</div></CardContent>}>
          <Await resolve={data.snapshots}>
            {(snapshots: Partial<FinancialSummary>[]) => {

              console.log({ snapshots })

              return (
                <CardContent className="space-y-4">
                  {(!snapshots || snapshots.length === 0) && (
                    <p className="text-sm opacity-70">Nenhum snapshot ainda.</p>
                  )}

                  {snapshots?.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{s.description || "Snapshot"}</div>
                        <div className="text-xs opacity-70">{new Date(String(s.createdAt)).toLocaleString()}</div>
                        <div className="text-xs opacity-70">PE: R$ {Number(s.pontoEquilibrioAmount ?? 0).toFixed(2)} · CF% {(Number(s.custoFixoPerc ?? 0) * 100).toFixed(1)}% · CV% {(Number(s.custoVariavelPerc ?? 0) * 100).toFixed(1)}%</div>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteSnapshot" />
                        <input type="hidden" name="snapshotId" value={String(s.id)} />
                        <Button variant="destructive" size="sm">Excluir</Button>
                      </Form>
                    </div>
                  ))}
                </CardContent>
              )
            }}
          </Await>
        </React.Suspense>
      </Card>
    </div>
  );
}
